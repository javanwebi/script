#!/usr/bin/env python3
"""Strict static safety gates for experimental KV G2P research only."""
import ast
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
BASH=(ROOT/"ops/forza-pocket-g2p-kv-architecture-probe-vps.sh").read_text()
PY=(ROOT/"scripts/forza_g2p_kv_cpu_probe.py").read_text()

class KVProbeGuard(unittest.TestCase):
    def test_syntax(self):
        ast.parse(PY)
        subprocess.run(["bash", "-n", str(ROOT/"ops/forza-pocket-g2p-kv-architecture-probe-vps.sh")],
                       check=True)
    def test_exact_original_voice_verified_and_isolated(self):
        self.assertIn("31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",BASH)
        self.assertIn("SOURCE_KIND=verified-stopped-pocket",BASH)
        self.assertIn("--network none --cpus=2",BASH)
        self.assertIn("--read-only --tmpfs /tmp",BASH)
        self.assertIn("FORZA_G2P_KV_PROBE_START",BASH)
        self.assertIn("FORZA_G2P_KV_FINISHED",BASH)
        self.assertIn("--local-dir /probe/hf",BASH)
        # hf download treats positional strings as exact filenames and then
        # ignores --include, giving the user a 404 for a literal ONNX glob.
        self.assertIn("download \"$MODEL\" --include 'onnx/g2p_*_kv.onnx*'",BASH)
        self.assertNotIn(" 'onnx/g2p_decoder_kv.onnx*'",BASH)
        self.assertNotIn(" 'onnx/g2p_encoder_kv.onnx*'",BASH)
        for forbidden in (
            'docker restart "$LIVE"', 'docker stop "$LIVE"', 'docker rm -f "$LIVE"',
            'docker rename "$LIVE"', 'docker restart "$SITE"',
            'docker stop "$SITE"', 'docker system prune',
            'docker volume rm', 'writeFileSync(', 'sf.write(', 'wave.open('
        ):
            self.assertNotIn(forbidden, BASH)
    def test_same_phonemes_not_approximation(self):
        for expected in ("class CachedG2P(OnnxG2P)", "self.s_enc = session(",
                         "self.s_dec = session(", "timed_phonemes(",
                         "phonemise(phrase, keep_ezafe=True)",
                         "matches != len(PHRASES)", "candidate_ms >= baseline_ms",
                         "FORZA_G2P_KV_REJECT", "FORZA_G2P_KV_INCOMPATIBLE",
                         "missing_matching_present_for", "no_exact_encoder_cross_kv_match",
                         "production_unchanged=1"):
            self.assertIn(expected, PY)
        self.assertNotIn("synthesize_audio(", PY)
        self.assertNotIn("tofile(", PY)
        self.assertNotIn("wav.write", PY)
        self.assertGreaterEqual(PY.count('"'), 50)
    def test_no_promotion_in_probe(self):
        self.assertNotIn("FORZA_TTS_USE_KV_G2P", BASH)
        self.assertNotIn("FORZA_TTS_USE_KV_G2P", PY)
        self.assertNotIn("docker run -d", BASH)
        self.assertNotIn("exec docker restart", BASH)

if __name__ == "__main__":
    unittest.main()
