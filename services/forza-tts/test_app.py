"""Contract tests for the private Mana Piper speech service (without model weights)."""
import io
import os
import sys
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi.testclient import TestClient
import app as tts


class FakePiperVoice:
    def synthesize_wav(self, text, output):
        assert isinstance(text, str) and text.strip()
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(22050)
        output.writeframes(b"\x00\x00" * 2205)


class SpeechTests(unittest.TestCase):
    def setUp(self):
        self.previous_voice = tts.VOICE
        tts.VOICE = FakePiperVoice()
        self.token = patch.dict(os.environ, {"FORZA_TTS_TOKEN": "test-private-secret"})
        self.token.start()
        self.client = TestClient(tts.app)

    def tearDown(self):
        self.client.close()
        self.token.stop()
        tts.VOICE = self.previous_voice

    def test_ready_only_when_engine_loaded(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        tts.VOICE = None
        self.assertEqual(self.client.get("/health").status_code, 503)

    def test_requires_private_token(self):
        payload = {"input": "سلام دنیا"}
        self.assertEqual(self.client.post("/v1/audio/speech", json=payload).status_code, 401)
        self.assertEqual(self.client.post("/v1/audio/speech", json=payload,
            headers={"Authorization": "Bearer wrong"}).status_code, 401)

    def test_returns_binary_wav_and_supports_multiple_turns(self):
        for text in ["سلام، به صنعت پیش خوش آمدید.", "کد فنی تسمه را بفرمایید."]:
            r = self.client.post("/v1/audio/speech", json={
                "model": "mana-piper-fa", "voice": "mana-fa-ir",
                "input": text, "response_format": "wav"
            }, headers={"Authorization": "Bearer test-private-secret"})
            self.assertEqual(r.status_code, 200, r.text)
            self.assertIn("audio/wav", r.headers["content-type"])
            self.assertEqual(r.content[:4], b"RIFF")
            with wave.open(io.BytesIO(r.content), "rb") as wav:
                self.assertEqual(wav.getnchannels(), 1)
                self.assertGreater(wav.getnframes(), 2000)

    def test_rejects_wrong_voice_and_malformed_text(self):
        h = {"Authorization": "Bearer test-private-secret"}
        self.assertEqual(self.client.post("/v1/audio/speech", json={
            "input": "سلام", "voice": "another-voice"
        }, headers=h).status_code, 400)
        self.assertEqual(self.client.post("/v1/audio/speech", json={
            "input": ""
        }, headers=h).status_code, 422)


if __name__ == "__main__":
    unittest.main()
