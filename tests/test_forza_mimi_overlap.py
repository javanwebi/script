#!/usr/bin/env python3
"""Mocked exact-PCM test for experimental FORZA same-model CPU overlap."""
import importlib.util
import unittest
from pathlib import Path

import numpy as np

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "forza_pocket_overlap.py"
spec = importlib.util.spec_from_file_location("forza_pocket_overlap", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
MimiOverlap = module.MimiOverlap


class DeterministicMimi:
    def run(self, _unused, feeds):
        latent = feeds["latent"]
        old_state = feeds["state0"]
        if latent[0, 0, 0] < -100:
            raise ValueError("fake_onnx_error")
        wav = np.repeat(latent, 2, axis=2) + old_state.reshape(1, 1, 1)
        return [wav.astype(np.float32), old_state + 1]


class ModelFixture:
    def __init__(self):
        self.dec_init = [np.zeros((1,), dtype=np.float32)]
        self.dec_in = ["latent", "state0"]
        self.dec_out_small = [1]
        self.dec_out_kv = []
        self.small_slots = [0]
        self.cache_slots = []
        self.steps_per_latent = 1
        self.emb_std = np.float32(1)
        self.emb_mean = np.float32(0)
        self.ldim = 2
        self.s_dec = DeterministicMimi()


def sequential(engine, latents):
    state = [a.copy() for a in engine.dec_init]
    result = []
    for latent in latents:
        un = (latent.reshape(1, 1, engine.ldim) * engine.emb_std + engine.emb_mean).astype(np.float32)
        res = engine.s_dec.run(None, {"latent": un, "state0": state[0]})
        result.append(res[0])
        state[0] = res[1]
    return np.concatenate(result, axis=2)[0, 0]


class MimiOverlapTest(unittest.TestCase):
    def test_identical_sample_values_and_order_for_40_latents(self):
        engine = ModelFixture()
        latents = [np.array([[[i / 10., i / 5.]]], dtype=np.float32) for i in range(40)]
        original = sequential(engine, latents)
        pipeline = MimiOverlap(engine)
        for latent in latents:
            pipeline.add(latent)
        overlapped = pipeline.collect(len(latents))
        self.assertTrue(np.array_equal(original, overlapped))
        self.assertFalse(pipeline.worker.is_alive())

    def test_eos_probe_frame_is_discarded_without_altering_previous_samples(self):
        engine = ModelFixture()
        latents = [np.array([[[i, i + 1]]], dtype=np.float32) for i in range(10)]
        original = sequential(engine, latents[:9])
        pipeline = MimiOverlap(engine)
        for latent in latents:
            pipeline.add(latent)
        self.assertTrue(np.array_equal(original, pipeline.collect(9)))

    def test_pipeline_drains_after_decoder_exception_without_deadlock(self):
        engine = ModelFixture()
        pipeline = MimiOverlap(engine)
        latents = [np.array([[[-1000., -1000.]]], dtype=np.float32) for _ in range(8)]
        for latent in latents:
            pipeline.add(latent)
        with self.assertRaisesRegex(ValueError, "fake_onnx_error"):
            pipeline.collect(len(latents))
        self.assertFalse(pipeline.worker.is_alive())


if __name__ == "__main__":
    unittest.main()
