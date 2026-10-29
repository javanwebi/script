#!/usr/bin/env python3
"""Private FORZA Persian male TTS sidecar using Pocket TTS Farsi v2."""
import io
import json
import logging
import os
import tempfile
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from sokhanvar import Sokhanvar

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger("forza-pocket")
PORT = int(os.getenv("PORT", "8080"))
TOKEN = os.getenv("FORZA_POCKET_TOKEN", "")
VOICE = Path(os.getenv("FORZA_POCKET_VOICE", "/voices/forza-male-reference.wav"))
CONFIG = Path("/srv/sokhanvar.yaml")
MAX_CHARS = 220
MAX_WAV_BYTES = 5_000_000
if not TOKEN:
    raise RuntimeError("FORZA_POCKET_TOKEN must be configured")
if not VOICE.is_file():
    raise RuntimeError(f"Missing male voice reference: {VOICE}. Mount the provided WAV privately.")
CONFIG.write_text(
    "backend: pocket_tts_farsi\n"
    "model: mehdi-hf/pocket-tts-farsi-v2\n"
    "language: fa\n"
    f"reference_audio: {VOICE}\n"
    "output_dir: /tmp/forza-pocket\n",
    encoding="utf-8",
)
Path("/tmp/forza-pocket").mkdir(parents=True, exist_ok=True)
LOG.info("Loading Pocket TTS Farsi v2 with male reference; first startup may download models")
speaker = Sokhanvar.from_yaml(str(CONFIG))
lock = threading.Lock()
cache = {}
GREETING = "سلام، به صنعت پیش خوش آمدید. من فورزا هستم و برای راهنمایی شما آماده‌ام."

def render(text):
    with lock:
        if text in cache:
            return cache[text]
        with tempfile.TemporaryDirectory(prefix="forza-pocket-") as tmp:
            out = str(Path(tmp) / "speech.wav")
            speaker.synthesize(text, out)
            wav = Path(out).read_bytes()
        if len(wav) < 44 or len(wav) > MAX_WAV_BYTES or wav[:4] != b"RIFF" or wav[8:12] != b"WAVE":
            raise ValueError("invalid_wav")
        if len(cache) >= 32:
            cache.pop(next(iter(cache)))
        cache[text] = wav
        return wav

class Handler(BaseHTTPRequestHandler):
    def json(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != "/health":
            return self.json(404, {"error": "not_found"})
        if self.headers.get("Authorization") != "Bearer " + TOKEN:
            return self.json(401, {"error": "unauthorized"})
        self.json(200, {"ok": True, "voice": "pocket-farsi-v2-male"})

    def do_POST(self):
        if self.path != "/synthesize":
            return self.json(404, {"error": "not_found"})
        if self.headers.get("Authorization") != "Bearer " + TOKEN:
            return self.json(401, {"error": "unauthorized"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 2048:
                return self.json(400, {"error": "invalid_body"})
            obj = json.loads(self.rfile.read(size))
            text = obj.get("text")
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARS:
                return self.json(400, {"error": "invalid_text"})
            wav = render(text.strip())
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("X-Forza-Voice", "pocket-farsi-v2-male")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(wav)))
            self.end_headers()
            self.wfile.write(wav)
        except Exception:
            LOG.exception("Pocket TTS synthesis failed")
            try:
                self.json(503, {"error": "synthesis_unavailable"})
            except (BrokenPipeError, ConnectionResetError):
                pass

if __name__ == "__main__":
    # Pre-render greeting to reduce wait after particle animation.
    try:
        render(GREETING)
    except Exception:
        LOG.exception("Greeting warmup failed; server stays available for diagnostics")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
