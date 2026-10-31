#!/usr/bin/env python3
"""No-Piper-dependency tests for the real private Amir source and framing."""
import ast
import io
import re
import struct
import sys
import wave
import unittest
from pathlib import Path
from types import SimpleNamespace

SOURCE=Path(__file__).resolve().parents[1]/"scripts"/"forza_amir_voice_http.py"
text=SOURCE.read_text(encoding="utf-8")
tree=ast.parse(text)
wanted={"spoken_text","synthesize_complete"}
selected=[]
for node in tree.body:
    if isinstance(node,ast.FunctionDef) and node.name in wanted:
        selected.append(node)
    if isinstance(node,ast.Assign) and any(
        isinstance(target,ast.Name) and target.id in {"PUNCTUATION","MAX_WAV_BYTES"}
        for target in node.targets
    ):
        selected.append(node)
namespace={"io":io,"wave":wave,"re":re,"ValueError":ValueError}
exec(compile(ast.Module(body=selected,type_ignores=[]),str(SOURCE),"exec"),namespace)
spoken=namespace["spoken_text"]
synthesize=namespace["synthesize_complete"]

class MockEngine:
    def synthesize(self,value):
        assert "!" not in value
        for _ in range(2):
            yield SimpleNamespace(
                audio_int16_bytes=b"\x00\x01"*22050,
                sample_channels=1,sample_width=2,sample_rate=22050)

class AmirVoiceTest(unittest.TestCase):
    def test_read_without_period_or_comma_silences(self):
        self.assertEqual(spoken("سلام. فورزا، آماده است!"),"سلام فورزا آماده است")
        self.assertEqual(spoken("تسمه SPA-1250 و قطر 12.7 میلی‌متر."),
                         "تسمه SPA-1250 و قطر 12.7 میلی‌متر")

    def test_entire_answer_returns_one_valid_wav_in_memory(self):
        namespace["engine"]=MockEngine()
        wav=synthesize("سلام! پاسخ کامل.")
        self.assertTrue(wav.startswith(b"RIFF"))
        self.assertEqual(wav[8:12],b"WAVE")
        with wave.open(io.BytesIO(wav),"rb") as source:
            self.assertEqual(source.getframerate(),22050)
            self.assertEqual(source.getnchannels(),1)
            self.assertEqual(source.getnframes(),44100)
        frame=struct.pack("<I",len(wav))+wav
        self.assertEqual(struct.unpack("<I",frame[:4])[0],len(wav))
        self.assertEqual(frame[4:],wav)

    def test_production_auth_and_transient_policy(self):
        self.assertIn('FORZA_VOICE_TOKEN',text)
        self.assertIn("hmac.compare_digest",text)
        self.assertIn("synthesis_slot",text)
        self.assertIn('"application/x-forza-wav-frames"',text)
        self.assertIn("io.BytesIO()",text)
        self.assertNotIn("write_bytes(",text)
        self.assertNotIn("open('/tmp/",text)
        self.assertNotIn("audio_cache",text)

if __name__=="__main__":
    unittest.main()
