#!/usr/bin/env python3
"""Private Railway speech worker: same Pocket Farsi v2 model and selected greeting voice.

Only the public Node API may proxy to this service. Do not create a public domain.
Serve one synthesis at a time to keep ONNX KV allocations bounded on small instances.
"""
import json
import struct
import os
import socket
import sys
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from forza_pocket_worker import (
    MemoryBoundTts, REFERENCE, VOICE_STATE, render, render_chunks, release_unused_memory,
)

MAX_TEXT_CHARS = 220
MAX_REQUEST_BYTES = 2048
MAX_CACHED_RESPONSES = 8
synthesis_slot = threading.BoundedSemaphore(value=1)
# One active synthesis plus one bounded waiting request; reject excess load cleanly.
synthesis_queue = threading.BoundedSemaphore(value=2)
audio_cache = OrderedDict()
cache_lock = threading.Lock()
engine = None


def start_engine():
    global engine
    if not REFERENCE.is_file() or not VOICE_STATE.is_file():
        raise RuntimeError("missing_selected_voice_or_precomputed_state")
    os.environ["FORZA_POCKET_PRECOMPUTED_VOICE"] = "1"
    instance = MemoryBoundTts()
    instance.VOICE_MEMO_MAX = 1
    with np.load(VOICE_STATE, allow_pickle=False) as state:
        key = (str(REFERENCE.resolve()), REFERENCE.stat().st_mtime)
        instance._voice_memo[key] = (state["cache"], int(state["offset"]))
    engine = instance
    release_unused_memory()
    print("[FORZA voice] Pocket Farsi v2 engine and selected voice ready", flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "ForzaVoice/1.1"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        print("[FORZA voice HTTP]", format % args, file=sys.stderr, flush=True)

    def reply(self, code, payload, content_type="application/json"):
        if isinstance(payload, dict):
            payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path == "/health":
            self.reply(200 if engine is not None else 503, {
                "ok": engine is not None,
                "voice": "pocket-farsi-v2",
                "selected_reference": "forza-pocket-reference.wav",
            })
            return
        self.reply(404, {"error": "not_found"})

    def do_POST(self):
        if self.path not in ("/speak", "/speak-stream"):
            self.reply(404, {"error": "not_found"})
            return
        expected = os.environ.get("FORZA_VOICE_TOKEN", "")
        if expected:
            import hmac
            if not hmac.compare_digest(self.headers.get("X-Forza-Voice-Token", ""), expected):
                self.reply(403, {"error": "forbidden"})
                return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self.reply(415, {"error": "json_required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.reply(400, {"error": "invalid_length"})
            return
        if not (0 < length <= MAX_REQUEST_BYTES):
            self.reply(413, {"error": "request_too_large"})
            return
        try:
            body = json.loads(self.rfile.read(length))
            phrase = body.get("text")
            if not isinstance(phrase, str):
                raise ValueError("missing_text")
            phrase = " ".join(phrase.strip().split())
            if not phrase or len(phrase) > MAX_TEXT_CHARS:
                raise ValueError("invalid_text")
        except (ValueError, UnicodeError, AttributeError):
            self.reply(400, {"error": "invalid_text"})
            return

        # An uncached stream holds the same single-inference semaphore as
        # /speak. Existing clients keep receiving the original full WAV.
        if self.path == "/speak-stream":
            if not synthesis_queue.acquire(blocking=False):
                self.reply(503, {"error": "voice_busy"})
                return
            if not synthesis_slot.acquire(timeout=90):
                synthesis_queue.release()
                self.reply(503, {"error": "voice_queue_timeout"})
                return
            started = time.monotonic()
            headers_sent = False
            frames = None
            try:
                frames = render_chunks(engine, phrase)
                first = next(frames)
                # Wait for a *real* generated chunk before sending headers,
                # so FIRST_BYTE measures audible ready-to-play data.
                self.send_response(200)
                self.send_header("Content-Type", "application/x-forza-wav-frames")
                self.send_header("Transfer-Encoding", "chunked")
                self.send_header("Cache-Control", "no-store, no-transform")
                self.send_header("X-Forza-Voice", "pocket-farsi-v2")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                headers_sent = True
                count = 0
                import itertools
                for wav in itertools.chain((first,), frames):
                    frame = struct.pack("<I", len(wav)) + wav
                    self.wfile.write(("%x\r\n" % len(frame)).encode("ascii"))
                    self.wfile.write(frame + b"\r\n")
                    self.wfile.flush()
                    count += 1
                    if count == 1:
                        print("[FORZA voice stream] first_chunk_ms=%s bytes=%s" %
                              (int((time.monotonic() - started) * 1000), len(wav)), flush=True)
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
                print("[FORZA voice stream] chunks=%s total_ms=%s" %
                      (count, int((time.monotonic() - started) * 1000)), flush=True)
            except (BrokenPipeError, ConnectionResetError):
                self.close_connection = True
            except Exception as exc:
                print("[FORZA voice stream] error=%s" % type(exc).__name__,
                      file=sys.stderr, flush=True)
                if not headers_sent:
                    self.reply(503, {"error": "voice_unavailable"})
                else:
                    # A truncated framed response must fail client decoding.
                    self.close_connection = True
            finally:
                if frames is not None:
                    frames.close()
                synthesis_slot.release()
                synthesis_queue.release()
                release_unused_memory()
            return

        with cache_lock:
            cached = audio_cache.get(phrase)
            if cached:
                audio_cache.move_to_end(phrase)
        if cached:
            self.reply(200, cached, "audio/wav")
            return
        if not synthesis_queue.acquire(blocking=False):
            self.reply(503, {"error": "voice_busy"})
            return
        if not synthesis_slot.acquire(timeout=90):
            synthesis_queue.release()
            self.reply(503, {"error": "voice_queue_timeout"})
            return
        started = time.monotonic()
        try:
            with cache_lock:
                cached = audio_cache.get(phrase)
            if cached:
                self.reply(200, cached, "audio/wav")
                return
            audio = render(engine, phrase)
            with cache_lock:
                audio_cache[phrase] = audio
                if len(audio_cache) > MAX_CACHED_RESPONSES:
                    audio_cache.popitem(last=False)
            self.reply(200, audio, "audio/wav")
            print("[FORZA voice] generated chars=%s bytes=%s ms=%s" % (
                len(phrase), len(audio), int((time.monotonic() - started) * 1000)),
                flush=True)
        except Exception as exc:
            print("[FORZA voice] synthesis_error=%s" % type(exc).__name__, file=sys.stderr, flush=True)
            self.reply(503, {"error": "voice_unavailable"})
        finally:
            synthesis_slot.release()
            synthesis_queue.release()
            release_unused_memory()


class IPv6HTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    request_queue_size = 16


if __name__ == "__main__":
    start_engine()
    port = int(os.environ.get("PORT", "8080"))
    server = IPv6HTTPServer(("::", port), Handler)
    print("[FORZA voice] listening on :: port=%s (private network only)" % port, flush=True)
    server.serve_forever()
