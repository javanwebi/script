#!/usr/bin/env python3
"""No model files or private audio needed: test custom FORZA voice pilot safety."""
import importlib.util
import io
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gate = load("scripts/forza_custom_voice_dataset_gate.py", "forza_dataset_gate")
bench = load("scripts/forza_piper_custom_benchmark.py", "forza_custom_bench")
corpus = load("scripts/forza_custom_corpus_prompts.py", "forza_custom_corpus")


def make_wav(path, *, rate=22050, silent=False):
    frames = [0 if silent else (3000 if i % 2 else -3000) for i in range(int(rate * 1.5))]
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(struct.pack(f"<{len(frames)}h", *frames))


class VoiceDataTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.audio = self.root / "wav"
        self.audio.mkdir()
        for name in ("a.wav", "b.wav"):
            make_wav(self.audio / name)
        self.manifest = self.root / "metadata.csv"
        self.manifest.write_text(
            "a.wav|سلام این صدای فورزا است\n"
            "b.wav|شماره فنی تسمه صنعتی را اعلام کنید\n", encoding="utf-8"
        )

    def check(self):
        return gate.inspect_dataset(self.manifest, self.audio,
                                    min_clips=2, min_minutes=0.04)

    def test_valid_private_dataset(self):
        result = self.check()
        self.assertEqual(result["clips"], 2)
        self.assertTrue(result["read_only"])
        self.assertFalse(result["customer_audio_saved"])

    def test_missing_audio_fails_closed(self):
        (self.audio / "b.wav").unlink()
        with self.assertRaisesRegex(gate.DatasetError, "missing_wav"):
            self.check()

    def test_silent_wav_rejected(self):
        make_wav(self.audio / "b.wav", silent=True)
        with self.assertRaisesRegex(gate.DatasetError, "silent"):
            self.check()

    def test_wrong_rate_rejected(self):
        make_wav(self.audio / "b.wav", rate=24000)
        with self.assertRaisesRegex(gate.DatasetError, "wrong_sample_rate"):
            self.check()

    def test_unsafe_paths_rejected(self):
        self.manifest.write_text("../outside.wav|سلام فورزا\n", encoding="utf-8")
        with self.assertRaisesRegex(gate.DatasetError, "unsafe_filename"):
            gate.inspect_dataset(self.manifest, self.audio, min_clips=1, min_minutes=0)


class AudioChunk:
    sample_rate = 22050
    sample_width = 2
    sample_channels = 1
    audio_int16_bytes = struct.pack("<1000h", *([1500] * 1000))


class Voice:
    def synthesize(self, text):
        self.text = text
        yield AudioChunk()
        yield AudioChunk()


class CorpusPromptsTest(unittest.TestCase):
    def test_728_public_prompts_preserve_original_368_prefix(self):
        import itertools
        phrases = list(corpus.phrases())
        old = list(corpus.SPECIAL) + [
            template.format(part=part, sector=sector)
            for part, sector, template in itertools.product(
                corpus.PARTS, corpus.SECTORS, corpus.TEMPLATES)
        ]
        self.assertEqual(len(old), 368)
        self.assertEqual(phrases[:368], old)
        self.assertEqual(corpus.TOTAL_PROMPTS, 728)
        self.assertEqual(len(phrases), 728)
        self.assertEqual(len(set(phrases)), 728)
        self.assertTrue(all(any(0x0600 <= ord(ch) <= 0x06FF for ch in text) for text in phrases))


class CpuBenchmarkTest(unittest.TestCase):
    def test_one_full_wav_is_in_memory(self):
        voice = Voice()
        metrics = bench.render_full_wav(voice, "سلام، FORZA! 3.25 میلی متر.")
        self.assertEqual(metrics["wav_count"], 1)
        self.assertEqual(metrics["internal_chunks"], 2)
        self.assertGreater(metrics["wav_bytes"], 4000)
        self.assertEqual(len(metrics["wav_sha256"]), 64)
        self.assertIn("3.25", voice.text)
        self.assertNotIn("!", voice.text)

    def test_bad_audio_rejected(self):
        class Empty:
            def synthesize(self, text):
                return iter([])
        with self.assertRaisesRegex(ValueError, "empty_audio"):
            bench.render_full_wav(Empty(), "سلام")

    def test_shell_syntax_and_no_live_mutation(self):
        paths = (
            "ops/forza-piper-custom-train-gpu.sh",
            "ops/forza-piper-custom-export-gpu.sh",
            "ops/forza-piper-custom-cpu-gate-vps.sh",
        )
        for path in paths:
            with self.subTest(path=path):
                subprocess.run(["bash", "-n", str(ROOT / path)],
                               capture_output=True, check=True)
                src = (ROOT / path).read_text(encoding="utf-8")
                for forbidden in ("docker stop forza-voice", "docker restart forza-voice",
                                  "docker rm -f forza-voice", "docker system prune",
                                  "docker volume rm"):
                    self.assertNotIn(forbidden, src)


if __name__ == "__main__":
    unittest.main()
