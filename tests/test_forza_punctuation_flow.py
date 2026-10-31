#!/usr/bin/env python3
"""Test punctuation-only voice normalization without loading ONNX/G2P weights."""
import ast
from pathlib import Path
import re
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "forza_pocket_worker.py"
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
selected = []
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        isinstance(t, ast.Name) and t.id in {"_SENTENCE_DOT", "_FLOW_PUNCTUATION"}
        for t in node.targets
    ):
        selected.append(node)
    if isinstance(node, ast.FunctionDef) and node.name == "continuous_persian_speech_text":
        selected.append(node)
scope = {"re": re}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(SOURCE), "exec"), scope)
spoken = scope["continuous_persian_speech_text"]

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

    def test_unbroken_is_configurable_and_does_not_persist_wav(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertIn('UNBROKEN_SPEECH = os.environ.get("FORZA_TTS_UNBROKEN", "1") == "1"', source)
        self.assertIn('jobs.append((chunk, 0.0 if UNBROKEN_SPEECH else gap))', source)
        self.assertIn('engine._compress_pauses(audio, max_pause=0.16, keep=0.035)', source)
        self.assertIn('stream = io.BytesIO()', source)

if __name__ == "__main__":
    unittest.main()
