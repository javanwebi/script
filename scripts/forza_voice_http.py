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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from forza_pocket_worker import (
    MemoryBoundTts, REFERENCE, VOICE_STATE, render, render_chunks,
    render_full_answer_wav, release_unused_memory,
)
from g2p_onnx import OnnxG2P

MAX_TEXT_CHARS = 1000
# Explicit opt-in only. Whole-answer WAV removes transport underflow but on
# current VPS incurs the FULL generation delay before the first audible byte.
# This is not a workaround for the user's strict <=1000ms generation goal.
FULL_ANSWER_WAV = os.environ.get("FORZA_TTS_FULL_ANSWER_WAV", "0") == "1"
MAX_REQUEST_BYTES = 8192
synthesis_slot = threading.BoundedSemaphore(value=1)
# One active synthesis plus one bounded waiting request; reject excess load cleanly.
synthesis_queue = threading.BoundedSemaphore(value=2)
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

    # Keep Persian G2P sessions resident on the 2-GiB VPS profile. The old
    # path unloaded them after every phrase and paid the ONNX load cost again.
    if instance.KEEP_G2P:
        g2p_started = time.monotonic()
        instance._g2p = OnnxG2P(instance.dir)
        print("[FORZA voice profile] g2p_ready_ms=%d resident=1" % (
            (time.monotonic() - g2p_started) * 1000), flush=True)

    # Warm the same progressive path before /health becomes ready. Cold
    # ONNX/G2P initialization is paid at container startup, not on first call.
    warmup_setting = os.environ.get("FORZA_TTS_WARMUP")
    if warmup_setting == "1" or (
        warmup_setting is None and instance.KEEP_ACOUSTIC and instance.KEEP_G2P
    ):
        if not instance.KEEP_ACOUSTIC:
            raise RuntimeError("forza_warmup_requires_resident_acoustic")
        warm_started = time.monotonic()
        for _ in render_chunks(instance, "سلام، من فورزا هستم."):
            pass
        print("[FORZA voice profile] warmup_ms=%d resident_g2p=%d" % (
            (time.monotonic() - warm_started) * 1000, int(instance.KEEP_G2P)),
            flush=True)

    engine = instance
    release_unused_memory()
    print("[FORZA voice] Pocket Farsi v2 engine and selected voice ready resident_g2p=%d" %
          int(instance.KEEP_G2P), flush=True)



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
                # Both branches must return closable generators: finally
                # calls frames.close() even if the client disconnects.
                def one_complete_frame():
                    yield render_full_answer_wav(engine, phrase)
                frames = (one_complete_frame() if FULL_ANSWER_WAV
                          else render_chunks(engine, phrase))
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
                last_frame_sent = None
                import itertools
                for wav in itertools.chain((first,), frames):
                    frame = struct.pack("<I", len(wav)) + wav
                    self.wfile.write(("%x\r\n" % len(frame)).encode("ascii"))
                    self.wfile.write(frame + b"\r\n")
                    self.wfile.flush()
                    now = time.monotonic()
                    if count == 0:
                        print("[FORZA voice stream] first_chunk_ms=%s bytes=%s" %
                              (int((now - started) * 1000), len(wav)), flush=True)
                    else:
                        print("[FORZA voice stream] inter_chunk_gap_ms=%s index=%s" %
                              (int((now - last_frame_sent) * 1000), count + 1), flush=True)
                    last_frame_sent = now
                    count += 1
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
                print("[FORZA voice stream] full_answer_wav=%d chunks=%s total_ms=%s" %
                      (int(FULL_ANSWER_WAV), count, int((time.monotonic() - started) * 1000)), flush=True)
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

        if not synthesis_queue.acquire(blocking=False):
            self.reply(503, {"error": "voice_busy"})
            return
        if not synthesis_slot.acquire(timeout=90):
            synthesis_queue.release()
            self.reply(503, {"error": "voice_queue_timeout"})
            return
        started = time.monotonic()
        try:
            # Generated customer audio is transient, never kept in a response cache.
            # Original customer contract: ONE WAV for the complete answer.
            # The resident, unbroken option synthesizes each bounded internal
            # neural unit first, stitches all PCM in RAM without forced
            # sentence/phrase pauses, then returns one playable WAV. No
            # network/HTTP chunk gaps, no stored user speech and no new voice.
            # Remains opt-in for the existing live worker until CPU/quality
            # benchmarks prove it is an improvement.
            audio = (render_full_answer_wav(engine, phrase)
                     if FULL_ANSWER_WAV else render(engine, phrase))
            self.reply(200, audio, "audio/wav")
            print("[FORZA voice] generated chars=%s bytes=%s ms=%s full_answer_wav=%d" % (
                len(phrase), len(audio), int((time.monotonic() - started) * 1000),
                int(FULL_ANSWER_WAV)), flush=True)
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
