#!/usr/bin/env python3
"""FORZA's persistent CPU-only Pocket TTS Farsi v2 worker.
JSON lines on stdin/stdout; logs exclusively on stderr.
The reference is the first 5 seconds of the user-selected generated hello.wav.
"""
import base64
import contextlib
import io
import json
import os
import sys
import gc
import ctypes
import numpy as np
from pathlib import Path

ROOT = Path.cwd()
ENGINE_ROOT = ROOT / "vendor" / "persian_tts"
sys.path.insert(0, str(ENGINE_ROOT / "scripts"))
from tts_onnx import OnnxTts
# Railway's 1 GB RAM cannot accommodate upstream's 4-way synthesis.
# Force strictly serial generation before constructing any ONNX sessions.
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor as _OriginalPool
class _SerialPool(_OriginalPool):
    def __init__(self, max_workers=None, *args, **kwargs):
        super().__init__(max_workers=1, *args, **kwargs)
concurrent.futures.ThreadPoolExecutor = _SerialPool
import soundfile as sf

REFERENCE = ROOT / "public" / "forza-pocket-reference.wav"
GREETING = ROOT / "public" / "forza-greeting-bootstrap.wav"
VOICE_STATE = ENGINE_ROOT / "forza_voice_state.npz"
WELCOME = "سلام، به صنعت پیش خوش آمدید. من فورزا هستم و برای راهنمایی شما آماده‌ام."


def emit(data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def render(engine, text):
    # Upstream synthesize_text prints phonemes: stdout is reserved for JSON frames.
    with contextlib.redirect_stdout(sys.stderr):
        audio = engine.synthesize_text(text, str(REFERENCE), mode="pack")
    if len(audio) < 100:
        raise ValueError("empty_audio")
    stream = io.BytesIO()
    sf.write(stream, audio, engine.sample_rate, format="WAV", subtype="PCM_16")
    result = stream.getvalue()
    if len(result) > 5_000_000:
        raise ValueError("audio_too_large")
    return result


def release_unused_memory():
    gc.collect()
    try:
        ctypes.CDLL(None).malloc_trim(0)
    except (AttributeError, OSError):
        pass


class MemoryBoundTts(OnnxTts):
    def synthesize(self, *args, **kwargs):
        # synthesize_text has already phonemised every sentence. Release G2P
        # sessions BEFORE waveform generation, whose KV state peaks here.
        # Keeping both resident exceeds the shared 1 GB service on long turns.
        if hasattr(self, "_g2p"):
            del self._g2p
            release_unused_memory()
        return super().synthesize(*args, **kwargs)


def main():
    if not REFERENCE.is_file():
        raise RuntimeError("missing_pocket_voice_reference")
    building = "--greeting" in sys.argv
    if not building:
        if not VOICE_STATE.is_file():
            raise RuntimeError("missing_precomputed_voice_state")
        os.environ["FORZA_POCKET_PRECOMPUTED_VOICE"] = "1"
    engine = MemoryBoundTts()
    engine.VOICE_MEMO_MAX = 1
    if building:
        # Persist only this selected voice's conditioning; never user speech.
        with contextlib.redirect_stdout(sys.stderr):
            cache, offset = engine.voice_cache(str(REFERENCE))
        np.savez(VOICE_STATE, cache=cache, offset=np.array(offset))
        GREETING.write_bytes(render(engine, WELCOME))
        print("Pocket FORZA greeting generated:", GREETING.stat().st_size, file=sys.stderr)
        return
    with np.load(VOICE_STATE, allow_pickle=False) as state:
        key = (str(REFERENCE.resolve()), REFERENCE.stat().st_mtime)
        engine._voice_memo[key] = (state["cache"], int(state["offset"]))
    # G2P is loaded on demand and released before waveform generation.
    emit({"type": "ready", "model": "pocket-tts-farsi-v2-onnx"})
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            rid = request.get("id")
            phrase = request.get("text")
            if not isinstance(phrase, str) or not phrase.strip() or len(phrase) > 220:
                emit({"id": rid, "error": "invalid_text"})
                continue
            wav = render(engine, phrase.strip())
            emit({"id": rid, "audio": base64.b64encode(wav).decode("ascii")})
            del wav
            release_unused_memory()
        except Exception as exc:
            print("[FORZA Pocket] synthesis error:", repr(exc)[:240], file=sys.stderr)
            emit({"id": request.get("id") if isinstance(request, dict) else None, "error": "synthesis_failed"})


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("[FORZA Pocket] worker failed:", repr(exc)[:300], file=sys.stderr)
        sys.exit(1)
