#!/usr/bin/env python3
"""Offline safety tests; no Pocket model, private voice, GPU or WAV samples."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "teacher", ROOT / "scripts/forza_pocket_teacher_dataset.py")
teacher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(teacher)


class TeacherCorpusTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.prompts = self.root / "prompts.txt"
        self.prompts.write_text(
            "\n".join("سلام این یک متن آزمایش شماره " + str(i) for i in range(368)) + "\n",
            encoding="utf-8"
        )

    def test_one_five_and_full_known_prompt_count(self):
        self.assertEqual(len(teacher.read_prompts(self.prompts, 1)), 1)
        self.assertEqual(len(teacher.read_prompts(self.prompts, 5)), 5)
        self.assertEqual(len(teacher.read_prompts(self.prompts, 368)), 368)

    def test_reject_missing_and_bad_prompt_sets(self):
        self.prompts.write_text("سلام یک جمله\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "expected_exactly_368"):
            teacher.read_prompts(self.prompts, 5)

    def test_reject_duplicate_text(self):
        self.prompts.write_text(("سلام فورزا در این جمله\n") * 368, encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate_prompts"):
            teacher.read_prompts(self.prompts, 5)

    def test_reject_unsupported_limit(self):
        with self.assertRaisesRegex(ValueError, "limit_must_be"):
            teacher.read_prompts(self.prompts, 2)

    def test_atomic_manifest_and_non_overwrite(self):
        manifest = self.root / "metadata.csv"
        teacher.atomic_manifest(manifest, [("forza_0001.wav", "سلام فورزا")])
        self.assertEqual(teacher.read_existing_manifest(manifest),
                         [("forza_0001.wav", "سلام فورزا")])
        wav = self.root / "forza_0001.wav"
        teacher.atomic_write_unreplaceable(wav, b"example audio bytes")
        with self.assertRaises(FileExistsError):
            teacher.atomic_write_unreplaceable(wav, b"overwrite attempt")
        self.assertEqual(wav.read_bytes(), b"example audio bytes")

    def test_reference_identity_rejected(self):
        reference = self.root / "reference.wav"
        reference.write_bytes(b"bad_reference")
        with self.assertRaisesRegex(ValueError, "wrong_reference_voice"):
            teacher.verify_reference(reference)

    def test_runner_safe(self):
        script = ROOT / "ops/forza-pocket-teacher-corpus-vps.sh"
        subprocess.run(["bash", "-n", str(script)], check=True, capture_output=True)
        source = script.read_text(encoding="utf-8")
        for required in ("--one) LIMIT=1; MODE=one", "--network none", "--read-only", "--cpus=1",
                         "selected_voice_sha256", "FORZA_TEACHER_PILOT_APPROVED",
                         "FORZA_TEACHER_TRAINING_RIGHTS", "FORZA_TEACHER_VPS_PASS"):
            self.assertIn(required, source)
        for forbidden in ("docker stop forza-voice", "docker restart forza-voice",
                          "docker rm -f forza-voice", "docker volume rm",
                          "sanatpish-deploy", "git reset --hard"):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
