#!/usr/bin/env python3
"""Test punctuation-only voice normalization without loading ONNX/G2P weights."""
import ast
import io
from pathlib import Path
import re
import unittest
import wave

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "forza_pocket_worker.py"
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
selected = []
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        isinstance(t, ast.Name) and t.id in {"_SENTENCE_DOT", "_FLOW_PUNCTUATION"}
        for t in node.targets
    ):
        selected.append(node)
    if isinstance(node, ast.FunctionDef) and node.name in {
        "continuous_persian_speech_text", "continuous_sentence_units",
        "render_full_answer_wav",
    }:
        selected.append(node)
scope = {"re": re, "io": io, "wave": wave, "UNBROKEN_SPEECH": True}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(SOURCE), "exec"), scope)
spoken = scope["continuous_persian_speech_text"]
units = scope["continuous_sentence_units"]
combine = scope["render_full_answer_wav"]

class UnbrokenVoiceTest(unittest.TestCase):
    def test_sentence_and_phrase_marks_are_not_read_as_pauses(self):
        self.assertEqual(
            spoken("سلام. به صنعت پیش خوش آمدید، من فورزا هستم! کمک می‌کنم؟"),
            "سلام به صنعت پیش خوش آمدید من فورزا هستم کمک می‌کنم",
        )

    def test_preserve_industrial_code_and_decimal_measurement(self):
        self.assertEqual(
            spoken("تسمه SPA-1250، عرض 12.7 میلی‌متر. کد 6202ZZ."),
            "تسمه SPA-1250 عرض 12.7 میلی‌متر کد 6202ZZ",
        )

    def test_remove_semicolon_colon_parenthetical_silence(self):
        self.assertEqual(
            spoken("اول: انتخاب کالا؛ دوم (ارسال). پایان."),
            "اول انتخاب کالا دوم ارسال پایان",
        )

    def test_complete_reply_is_normalized_before_sentence_splitting(self):
        seen = []
        def split_sentences(value):
            seen.append(value)
            return re.split(r"(?<=[.!؟])\s+", value)
        original = "سلام، من فورزا هستم. کد 6202ZZ چیست؟ عرض 12.7 میلی‌متر!"
        result = units(original, split_sentences)
        self.assertEqual(seen, [spoken(original)])
        self.assertEqual(len(result), 1)
        self.assertIn("12.7", result[0])
        self.assertIn("6202ZZ", result[0])

    def test_optional_one_frame_full_wav_has_no_frame_transport_gaps(self):
        def packet(samples):
            with io.BytesIO() as store:
                with wave.open(store, "wb") as out:
                    out.setnchannels(1)
                    out.setsampwidth(2)
                    out.setframerate(24000)
                    out.writeframes(samples)
                return store.getvalue()
        frame1 = packet(b"\x01\x00" * 24000)
        frame2 = packet(b"\x02\x00" * 12000)
        scope["render_chunks"] = lambda engine, text: iter((frame1, frame2))
        class Engine: sample_rate = 24000
        result = combine(Engine(), "سلام، این متن کامل است.")
        with wave.open(io.BytesIO(result), "rb") as wav_file:
            self.assertEqual(wav_file.getframerate(), 24000)
            self.assertEqual(wav_file.getnframes(), 36000)
            self.assertEqual(wav_file.readframes(24000), b"\x01\x00" * 24000)
            self.assertEqual(wav_file.readframes(12000), b"\x02\x00" * 12000)
        self.assertEqual(len(result), 44 + 36000 * 2)

    def test_unbroken_is_configurable_and_does_not_persist_wav(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertIn('UNBROKEN_SPEECH = os.environ.get("FORZA_TTS_UNBROKEN", "1") == "1"', source)
        self.assertIn('jobs.append((chunk, 0.0 if UNBROKEN_SPEECH else gap))', source)
        self.assertIn('engine._compress_pauses(audio, max_pause=0.16, keep=0.035)', source)
        self.assertIn('stream = io.BytesIO()', source)
        self.assertIn('for sentence in continuous_sentence_units(text, split_sentences):', source)
        self.assertIn('spoken = continuous_persian_speech_text(text) if UNBROKEN_SPEECH else text', source)
        http = (SOURCE.parent / "forza_voice_http.py").read_text(encoding="utf-8")
        self.assertIn('FULL_ANSWER_WAV = os.environ.get("FORZA_TTS_FULL_ANSWER_WAV", "0") == "1"', http)
        self.assertIn('iter((render_full_answer_wav(engine, phrase),))', http)

if __name__ == "__main__":
    unittest.main()
