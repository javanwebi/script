#!/usr/bin/env python3
"""Exercise the actual Pocket render_chunks scheduler without ONNX models.

Extract the last with-ThreadPoolExecutor AST from the worker. Synthetic jobs
verify first-frame priority prevents other FlowLM steps from competing before
the first WAV gets yielded, while preserving every subsequent frame in order.
"""
import ast
import concurrent.futures
from pathlib import Path
import sys
import textwrap
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "scripts/forza_pocket_worker.py").read_text("utf8")
TREE = ast.parse(SOURCE)
FUNC = next(n for n in TREE.body
            if isinstance(n, ast.FunctionDef) and n.name == "render_chunks")
POOL_WITH = next(n for n in FUNC.body
                 if isinstance(n, ast.With) and
                 "ThreadPoolExecutor" in ast.unparse(n.items[0].context_expr))


def make_driver(priority, concurrency):
    code = "def stream(jobs, generate, engine, ThreadPoolExecutor, time, sys):\n"
    code += f"    FIRST_FRAME_PRIORITY = {priority!r}\n"
    code += f"    PARALLEL_CHUNKS = {concurrency!r}\n"
    code += textwrap.indent(ast.unparse(POOL_WITH), "    ") + "\n"
    env = {}
    exec(compile(code, "<Pocket real scheduler>", "exec"), env)
    return env["stream"]


class Sp:
    @staticmethod
    def encode(text, out_type=int):
        return [1] * len(text.split())


class Engine:
    sp = Sp()


class FirstFramePriorityTest(unittest.TestCase):
    def test_first_wav_yielded_before_another_flowlm_job_can_start(self):
        starts = []
        jobs = [("اول", 0), ("دوم", 0), ("سوم", 0)]
        def generate(index):
            starts.append(index)
            return b"wav-" + str(index).encode()
        iterate = make_driver(True, 2)(
            jobs, generate, Engine(), concurrent.futures.ThreadPoolExecutor,
            time, sys,
        )
        try:
            self.assertEqual(next(iterate), b"wav-0")
            self.assertEqual(starts, [0])
            self.assertEqual(list(iterate), [b"wav-1", b"wav-2"])
            self.assertEqual(sorted(starts), [0, 1, 2])
        finally:
            iterate.close()

    def test_priority_single_job_and_no_dropped_words(self):
        for n in [1, 2, 3, 8]:
            with self.subTest(jobs=n):
                jobs = [("token " + str(i), 0) for i in range(n)]
                frames = list(make_driver(True, 1)(
                    jobs, lambda i: bytes([i]), Engine(),
                    concurrent.futures.ThreadPoolExecutor, time, sys,
                ))
                self.assertEqual(frames, [bytes([i]) for i in range(n)])

    def test_default_nonpriority_speech_still_produces_all_frames(self):
        jobs = [(str(i), 0) for i in range(4)]
        frames = list(make_driver(False, 2)(
            jobs, lambda i: bytes([i]), Engine(),
            concurrent.futures.ThreadPoolExecutor, time, sys,
        ))
        self.assertEqual(frames, [bytes([i]) for i in range(4)])

    def test_original_speaker_and_three_quality_retries_retained(self):
        benchmark = (ROOT / "ops/forza-voice-faststart-benchmark-vps.sh").read_text()
        for expected in (
            "31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",
            "forza_voice_state.npz",
            "FORZA_TTS_FIRST_FRAME_PRIORITY",
            "FORZA_TTS_STREAM_FIRST_TOKENS",
            "FORZA_TTS_OVERLAP_MIMI",
            "FORZA_TTS_RETRY_ATTEMPTS=3",
            "FORZA_CPU_INTRA=1",
            "FORZA_FASTSTART_BENCH_PASS",
        ):
            self.assertIn(expected, benchmark)
        self.assertIn('FIRST_FRAME_PRIORITY = os.environ.get("FORZA_TTS_FIRST_FRAME_PRIORITY", "0") == "1"', SOURCE)
        for forbidden in ("docker restart", "docker stop", "docker volume rm"):
            self.assertNotIn(forbidden, benchmark)


if __name__ == "__main__":
    unittest.main()
