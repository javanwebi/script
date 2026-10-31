#!/usr/bin/env python3
"""Deterministic RNG for exact same-speaker, same-latent CPU A/B tests."""
import unittest
from pathlib import Path

import numpy as np


class RepeatablePocketTest(unittest.TestCase):
    def test_each_worker_seed_is_repeatable_and_order_independent(self):
        def job_seed(seed, index):
            return int(np.random.SeedSequence([seed, index]).
                       generate_state(1, dtype=np.uint64)[0])
        first = [job_seed(123456789, index) for index in range(20)]
        second = [job_seed(123456789, index) for index in reversed(range(20))]
        self.assertEqual(first, list(reversed(second)))
        self.assertEqual(len(set(first)), len(first))
        self.assertNotEqual(job_seed(123456789, 0), job_seed(123456788, 0))
        self.assertTrue(np.array_equal(
            np.random.default_rng(first[0]).standard_normal(40),
            np.random.default_rng(second[-1]).standard_normal(40),
        ))

    def test_seed_opt_in_only_and_original_weight_fingerprint_protected(self):
        base = Path(__file__).resolve().parents[1]
        worker = (base / "scripts/forza_pocket_worker.py").read_text()
        gate = (base / "ops/forza-pocket-cpu-gate-after-amir-vps.sh").read_text()
        self.assertIn('TTS_TEST_SEED = int(_TEST_SEED_RAW) if _TEST_SEED_RAW else None', worker)
        self.assertIn('if _TEST_SEED_RAW and not TTS_STAGE_PROFILE:', worker)
        self.assertIn('TTS_TEST_SEED is None', worker)
        self.assertIn('np.random.SeedSequence([TTS_TEST_SEED, i])', worker)
        self.assertIn('FORZA_TTS_TEST_SEED=$FORZA_GATE_FIXED_SEED', gate)
        self.assertIn("wav_sha256=", gate)
        self.assertIn("customer_wav_saved=0", gate)
        self.assertIn(
            "31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",
            gate
        )


if __name__ == "__main__":
    unittest.main()
