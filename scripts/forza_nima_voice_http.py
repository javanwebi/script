#!/usr/bin/env python3
"""Private low-memory Piper gyro (Nima in karim23657 demo) for FORZA.

Wire-compatible with /speak and /speak-stream on the previous Pocket worker.
Each *complete* response is synthesized once and sent as one gap-free PCM WAV
frame. No customer WAV, transcript or PCM is written to disk or stored in a cache.
"""
import hmac
import io
import json
import os
import re
import socket
import struct
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from piper import PiperVoice

MODEL = Path("/app/voice/fa_IR-gyro-medium.onnx")
VOICE_ID = "piper-nima-gyro-medium"
MAX_TEXT_CHARS = 1000
MAX_REQUEST_BYTES = 8192
MAX_WAV_BYTES = 8_000_000
synthesis_slot = threading.BoundedSemaphore(1)
synthesis_queue = threading.BoundedSemaphore(2)
engine = None

# Keep decimals and part numbers intact while suppressing punctuation-induced
# silence in the *spoken copy* only. The original LLM answer stays on screen.
PUNCTUATION = re.compile(r"[،,؛;:!?؟…—–\[\]{}()]|(?<!\d)\.|\.(?!\d)")


def spoken_text(value):
    return " ".join(PUNCTUATION.sub(" ", value).split())


def synthesize_complete(text):
    """Create a single PCM WAV in memory; never introduce per-clause gaps."""
    spoken = spoken_text(text)
    if not spoken:
        raise ValueError("empty_spoken_text")
    output = io.BytesIO()
    configured = False
    with wave.open(output, "wb") as target:
        for part in engine.synthesize(spoken):
            if not configured:
                target.setnchannels(part.sample_channels)
                target.setsampwidth(part.sample_width)
                target.setframerate(part.sample_rate)
                configured = True
            target.writeframes(part.audio_int16_bytes)
            if output.tell() > MAX_WAV_BYTES:
                raise ValueError("audio_too_large")
    wav = output.getvalue()
    if not (44 < len(wav) <= MAX_WAV_BYTES and wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"):
        raise ValueError("invalid_wav")
    return wav


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ForzaNima/1.0"

    def log_message(self, format, *args):
        print("[FORZA Nima]", format % args, file=sys.stderr, flush=True)

    def respond(self, status, payload, content_type="application/json"):
        if isinstance(payload, dict):
            payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if content_type != "application/json":
            self.send_header("X-Forza-Voice", VOICE_ID)
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def do_GET(self):
        if self.path == "/health":
            self.respond(200 if engine is not None else 503, {
                "ok": engine is not None, "voice": VOICE_ID,
                "generated_audio_persisted": False,
            })
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self):
        if self.path not in ("/speak", "/speak-stream"):
            self.respond(404, {"error": "not_found"})
            return
        token = os.environ.get("FORZA_VOICE_TOKEN", "")
        if not token:
            self.respond(503, {"error": "missing_voice_token"})
            return
        if not hmac.compare_digest(self.headers.get("X-Forza-Voice-Token", ""), token):
            self.respond(403, {"error": "forbidden"})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self.respond(415, {"error": "json_required"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_REQUEST_BYTES:
                raise ValueError("bad_length")
            payload = json.loads(self.rfile.read(size))
            phrase = payload.get("text")
            if not isinstance(phrase, str):
                raise ValueError("bad_text")
            phrase = " ".join(phrase.strip().split())
            if not 0 < len(phrase) <= MAX_TEXT_CHARS:
                raise ValueError("bad_text")
        except (ValueError, UnicodeError, AttributeError, json.JSONDecodeError):
            self.respond(400, {"error": "invalid_text"})
            return

        if not synthesis_queue.acquire(blocking=False):
            self.respond(503, {"error": "voice_busy"})
            return
        if not synthesis_slot.acquire(timeout=30):
            synthesis_queue.release()
            self.respond(503, {"error": "voice_queue_timeout"})
            return
        start = time.monotonic()
        try:
            wav = synthesize_complete(phrase)
            if self.path == "/speak-stream":
                # The browser's existing framing parser accepts a single
                # complete WAV, which cannot underrun between model segments.
                self.respond(200, struct.pack("<I", len(wav)) + wav,
                             "application/x-forza-wav-frames")
            else:
                self.respond(200, wav, "audio/wav")
            print("[FORZA_AMIR_PRODUCTION] chars=%d ms=%d wav_bytes=%d" % (
                len(phrase), (time.monotonic() - start) * 1000, len(wav)
            ), flush=True)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as exc:
            print("[FORZA Nima] generation_error=%s" % type(exc).__name__,
                  file=sys.stderr, flush=True)
            if not self.wfile.closed:
                try:
                    self.respond(503, {"error": "voice_unavailable"})
                except (BrokenPipeError, ConnectionResetError):
                    self.close_connection = True
        finally:
            synthesis_slot.release()
            synthesis_queue.release()


class PrivateServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    request_queue_size = 16


def main():
    global engine
    if not MODEL.is_file() or not (MODEL.parent / (MODEL.name + ".json")).is_file():
        raise RuntimeError("nima_model_missing")
    engine = PiperVoice.load(str(MODEL), config_path=str(MODEL) + ".json")
    # Warm ONNX before accepting first customer; do not retain waveform.
    for _ in engine.synthesize("سلام، من فورزا هستم"):
        pass
    print("[FORZA Nima] ready voice=%s warmed=1 no_audio_files=1" % VOICE_ID,
          flush=True)
    port = int(os.environ.get("PORT", "8080"))
    PrivateServer(("::", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
