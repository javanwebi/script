#!/usr/bin/env python3
"""Offline validation for private Pocket VPS test. No real TTS API calls."""
import importlib.util
import io
import json
from pathlib import Path
import struct
import wave
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "forza_private_probe",
    ROOT / "scripts/tests/forza-pocket-vps-private-ttfb.py",
)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def pcm_wav(frames=24000, rate=24000):
    mem = io.BytesIO()
    with wave.open(mem, "wb") as w:
        w.setnchannels(1)
        w.setframerate(rate)
        w.setsampwidth(2)
        w.writeframes(b"\x00\x00" * frames)
    return mem.getvalue()


class OriginalVoiceProbeTest(unittest.TestCase):
    def test_wave_duration_and_guardrails(self):
        self.assertAlmostEqual(mod.wav_ms(pcm_wav()), 1000.0)
        self.assertAlmostEqual(mod.wav_ms(pcm_wav(12000)), 500.0)
        with self.assertRaisesRegex(ValueError, "not_original_pocket_pcm_format"):
            mod.wav_ms(pcm_wav(rate=16000))
        with self.assertRaisesRegex(ValueError, "invalid_wav_signature"):
            mod.wav_ms(b"invalid WAV data" * 10)

    def test_exact_length_read_in_memory_only(self):
        buf = io.BytesIO(b"\x00" * 44)
        self.assertEqual(len(mod.read_exact(buf, 44)), 44)
        with self.assertRaisesRegex(ValueError, "invalid_frame_size"):
            mod.read_exact(buf, 10_000_000)
        with self.assertRaisesRegex(ValueError, "truncated_frame"):
            mod.read_exact(io.BytesIO(b"short"), 44)

    def test_wrapper_uses_voice_own_token_and_internal_port(self):
        source = (ROOT / "ops/forza-pocket-live-ttfb-vps.sh").read_text()
        node = (ROOT / "scripts/tests/forza-pocket-vps-ttfb.cjs").read_text()
        py = (ROOT / "scripts/tests/forza-pocket-vps-private-ttfb.py").read_text()
        self.assertIn('"$VOICE" python -', source)
        self.assertIn('FORZA_PROBE_MODE=proxy', source)
        self.assertIn('"$SITE" node -', source)
        self.assertIn("FORZA_POCKET_VPS_PROXY_FOUND", node)
        self.assertIn("'/api/health'", node)
        self.assertIn("['3000'", node) if False else None
        self.assertIn("'3000', '3001'", node)
        self.assertIn('os.environ.get("FORZA_VOICE_TOKEN"', py)
        self.assertIn('http.client.HTTPConnection("::1"', py)
        self.assertIn("FORZA_POCKET_VPS_RESULT route=", py)
        self.assertNotIn('FORZA_VOICE_TOKEN=$', source)
        for forbidden in (
            'docker restart', 'docker stop', 'docker rm', 'docker build',
            'docker volume rm', 'docker system prune', 'docker image rm',
            'npm install', 'pip install',
        ):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
