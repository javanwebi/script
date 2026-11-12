#!/usr/bin/env python3
"""Isolated post-EOS FlowLM-step reduction must preserve every retained latent."""
import ast
from pathlib import Path
import unittest

import numpy as np

WORKER = Path(__file__).resolve().parents[1] / "scripts/forza_pocket_worker.py"
tree = ast.parse(WORKER.read_text(encoding="utf-8"))
cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "MemoryBoundTts")
method = next(n for n in cls.body
              if isinstance(n, ast.FunctionDef) and n.name == "_generate_chunk_with_early_eos")
namespace = {"np": np, "TTS_EOS_SHORT": 5, "TTS_EOS_LONG": 3}
exec(compile(ast.Module(body=[method], type_ignores=[]), str(WORKER), "exec"), namespace)
generate = namespace["_generate_chunk_with_early_eos"]


class Tokenizer:
    def encode(self, text, out_type=int):
        return [1, 2, 3, 4, 5, 6]


class FakePocket:
    def __init__(self):
        self.ldim = 4
        self.dim = 4
        self.temp = 1.0
        self.tps_est = 3.0
        self.gen_pad = 4.0
        self.frame_rate = 10.0
        self.sp = Tokenizer()
        self.lut = np.zeros((7, 4), dtype=np.float32)
        self.calls = 0

    def _flow_step(self, seq, text_emb, offset, noise, cache):
        self.calls += 1
        value = np.full((1, 1, 4), self.calls, dtype=np.float32)
        # Emit EOS in second latent iteration (initial text prefill is ignored).
        eos = np.array([self.calls >= 4])
        return value, eos, cache, offset + 1


class EosTailTest(unittest.TestCase):
    def test_original_default_and_two_frame_tail_share_identical_latent_prefix(self):
        base = FakePocket()
        namespace["TTS_EOS_SHORT"] = 5
        left, _, _ = generate(base, None, 0, "سلام من فورزا هستم",
                              rng=np.random.default_rng(12345))
        fast = FakePocket()
        namespace["TTS_EOS_SHORT"] = 2
        right, _, _ = generate(fast, None, 0, "سلام من فورزا هستم",
                               rng=np.random.default_rng(12345))
        self.assertEqual(len(left) - len(right), 3)
        self.assertEqual(base.calls - fast.calls, 3)
        for a, b in zip(left[:len(right)], right):
            np.testing.assert_array_equal(a, b)

    def test_no_eos_detected_does_not_drop_frames(self):
        class NeverEOS(FakePocket):
            def _flow_step(self, *args):
                lat, eos, cache, offset = super()._flow_step(*args)
                return lat, np.array([False]), cache, offset
        namespace["TTS_EOS_SHORT"] = 5
        left, _, _ = generate(NeverEOS(), None, 0, "سلام من فورزا هستم",
                              rng=np.random.default_rng(12345))
        namespace["TTS_EOS_SHORT"] = 1
        right, _, _ = generate(NeverEOS(), None, 0, "سلام من فورزا هستم",
                               rng=np.random.default_rng(12345))
        self.assertEqual(len(left), len(right))
        for a, b in zip(left, right):
            np.testing.assert_array_equal(a, b)

    def test_guarded_and_unchanged_production_default(self):
        source = WORKER.read_text(encoding="utf-8")
        self.assertIn('FORZA_TTS_EOS_SHORT", "5"', source)
        self.assertIn('FORZA_TTS_EOS_LONG", "3"', source)
        self.assertIn("eos_tail_tuning_requires_isolated_profiling", source)
        self.assertIn("else super()._generate_chunk(*args, **kwargs)", source)
        self.assertIn("FORZA_TTS_TEST_SEED", source)
        gate = (WORKER.parent.parent / "ops/forza-pocket-cpu-gate-after-amir-vps.sh").read_text()
        self.assertIn("FORZA_GATE_EOS_SHORT", gate)
        self.assertIn("FORZA_GATE_FIXED_SEED", gate)
        self.assertIn("wav_sha256=", gate)
        self.assertIn("customer_wav_saved=0", gate)


if __name__ == "__main__":
    unittest.main()
