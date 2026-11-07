#!/usr/bin/env python3
"""Private low-memory Piper gyro (Nima in karim23657 demo) for FORZA.

Wire-compatible with /speak and /speak-stream on the previous Pocket worker.
Each *complete* response is synthesized once and sent as one gap-free PCM WAV
frame. No customer WAV, transcript or PCM is written to disk or stored in a cache.
"""
import concurrent.futures
from concurrent.futures.process import BrokenProcessPool
import multiprocessing
import hmac
from collections import deque
import io
import json
import os
import re
import socket
import signal
import select
import struct
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from piper import PiperVoice

MODEL = Path(os.environ.get("FORZA_NIMA_MODEL", "/app/voice/fa_IR-gyro-medium.onnx"))
VOICE_ID = "piper-nima-gyro-medium"
ACK_TEXT = "متوجه شدم، بررسی می‌کنم."
ack_wav = None
MAX_TEXT_CHARS = 1000
MAX_REQUEST_BYTES = 8192
MAX_WAV_BYTES = 8_000_000
# Bounded FIFO admission across isolated CPU workers. Default stays one worker;
# the upgraded VPS helper chooses a measured, resource-bounded larger pool.
queue_condition = threading.Condition()
queue_waiters = deque()
def bounded_int(name, default, minimum, maximum):
    try:
        return max(minimum, min(maximum, int(os.environ.get(name, default))))
    except (TypeError, ValueError):
        return default


WORKER_COUNT = bounded_int("FORZA_NIMA_WORKERS", 1, 1, 8)
queue_busy = 0
MAX_WAITING_TOTAL = bounded_int("FORZA_NIMA_MAX_PENDING", max(2, WORKER_COUNT*4), WORKER_COUNT, 64)
MAX_QUEUE_WAIT_SEC = 2.5
engine = None
inference_pool = None
pool_ready = False


def acquire_inference(disconnected):
    global queue_busy
    ticket = object()
    begin = time.monotonic()
    with queue_condition:
        if len(queue_waiters) + queue_busy >= MAX_WAITING_TOTAL:
            return None, "voice_busy"
        queue_waiters.append(ticket)
        while True:
            if disconnected():
                queue_waiters.remove(ticket)
                queue_condition.notify_all()
                return None, "client_gone"
            if queue_waiters[0] is ticket and queue_busy < WORKER_COUNT:
                queue_waiters.popleft()
                queue_busy += 1
                return round((time.monotonic() - begin) * 1000), None
            remaining = MAX_QUEUE_WAIT_SEC - (time.monotonic() - begin)
            if remaining <= 0:
                queue_waiters.remove(ticket)
                queue_condition.notify_all()
                return None, "voice_queue_timeout"
            queue_condition.wait(min(0.1, remaining))


def release_inference():
    global queue_busy
    with queue_condition:
        queue_busy = max(0, queue_busy-1)
        queue_condition.notify_all()

# Keep decimals and part numbers intact while suppressing punctuation-induced
# silence in the *spoken copy* only. The original LLM answer stays on screen.
PUNCTUATION = re.compile(r"[،,؛;:!?؟…—–\[\]{}()]|(?<!\d)\.|\.(?!\d)")


def spoken_text(value):
    # Defense in depth: even a non-FORZA caller must never make the male
    # speaker recite Markdown markers or bare URLs. Do not alter part codes.
    value = re.sub(r"(?i)(?:https?://|www\.)\S+", " ", value)
    value = re.sub(r"(?<=\d)\s*\*\s*(?=\d)", " در ", value)
    value = re.sub(r"[*\x60#]", " ", value)
    return " ".join(PUNCTUATION.sub(" ", value).split())


def generation_error_diagnostics(exc):
    """Non-content error identity for ONNX/Piper failures.

    Never log the exception message: phonemizers may include user words in it.
    The final Python traceback frame (module basename and line) is sufficient
    to distinguish a Piper/phonemizer issue from ONNX or WAV generation.
    """
    kind = re.sub(r"[^A-Za-z0-9_]", "_", type(exc).__name__)[:64]
    module = re.sub(r"[^A-Za-z0-9_]", "_",
                    type(exc).__module__.split(".")[-1])[:64]
    trace = exc.__traceback__
    while trace and trace.tb_next:
        trace = trace.tb_next
    site = "unknown"
    if trace:
        filename = re.sub(r"[^A-Za-z0-9_.-]", "_",
                          Path(trace.tb_frame.f_code.co_filename).name)[:64]
        site = "%s:%d" % (filename, trace.tb_lineno)
    cause = re.sub(r"[^A-Za-z0-9_]", "_",
                   type(exc.__cause__).__name__ if exc.__cause__ else "none")[:64]
    return "type=%s module=%s cause=%s site=%s" % (kind, module, cause, site)


def synthesize_complete(text, disconnected=lambda: False):
    """Create a PCM WAV in RAM; stop after an inference chunk if peer left."""
    spoken = spoken_text(text)
    if not spoken:
        raise ValueError("empty_spoken_text")
    output = io.BytesIO()
    configured = False
    with wave.open(output, "wb") as target:
        for part in engine.synthesize(spoken):
            if disconnected():
                raise InterruptedError("voice_client_disconnected")
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


def initialize_engine(ready=None):
    """One warmed, single-threaded ONNX session per isolated process.

    OMP_NUM_THREADS alone does not bound ONNX Runtime's default thread pool.
    Avoid multiplying every CPU core by every concurrent customer session.
    """
    global engine
    import onnxruntime
    from piper.config import PiperConfig
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.execution_mode = onnxruntime.ExecutionMode.ORT_SEQUENTIAL
    with open(str(MODEL)+".json", encoding="utf-8") as config:
        engine = PiperVoice(config=PiperConfig.from_dict(json.load(config)),
                            session=onnxruntime.InferenceSession(str(MODEL), sess_options=options,
                                                                 providers=["CPUExecutionProvider"]))
    for _ in engine.synthesize("سلام، من فورزا هستم"):
        pass
    if ready is not None:
        ready.put(os.getpid())


def worker_identity():
    return os.getpid()


def synthesize_request(text, disconnected):
    if inference_pool is None:
        return synthesize_complete(text, disconnected)
    future = inference_pool.submit(synthesize_complete, text)
    gone = False
    while True:
        if disconnected():
            gone = True
            # A queued job can be removed; an already-running native ONNX call
            # cannot be preempted safely. Keep its capacity lease until it ends.
            future.cancel()
        try:
            wav = future.result(timeout=0.05)
            if gone:
                raise InterruptedError("voice_client_disconnected")
            return wav
        except concurrent.futures.TimeoutError:
            continue
        except concurrent.futures.CancelledError:
            raise InterruptedError("voice_client_disconnected")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = 10
    server_version = "ForzaNima/1.0"

    def log_message(self, format, *args):
        print("[FORZA Nima]", format % args, file=sys.stderr, flush=True)

    def respond(self, status, payload, content_type="application/json", timings=None):
        if isinstance(payload, dict):
            payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if content_type != "application/json":
            self.send_header("X-Forza-Voice", VOICE_ID)
            if timings:
                self.send_header("X-Forza-Queue-Ms", str(timings[0]))
                self.send_header("X-Forza-Inference-Ms", str(timings[1]))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def client_disconnected(self):
        """Check at queue boundaries/chunk boundaries without reading payload."""
        try:
            # Socket timeouts make Python wait before recv(), even with
            # MSG_DONTWAIT. Poll readability first; an open idle peer is normal.
            if not select.select([self.connection], [], [], 0)[0]:
                return False
            return self.connection.recv(
                1, socket.MSG_PEEK | socket.MSG_DONTWAIT
            ) == b""
        except BlockingIOError:
            return False
        except OSError:
            return True

    def do_GET(self):
        if self.path == "/ack":
            token = os.environ.get("FORZA_VOICE_TOKEN", "")
            if not token or not hmac.compare_digest(self.headers.get("X-Forza-Voice-Token", ""), token):
                self.respond(403, {"error": "forbidden"})
                return
            if ack_wav is None:
                self.respond(503, {"error": "ack_not_ready"})
                return
            # A single pre-generated Nima acknowledgement covers model/STT
            # latency while the real answer is being generated. It is held in
            # RAM only and is never regenerated per customer turn.
            self.respond(200, ack_wav, "audio/wav", (0, 0))
        elif self.path == "/health":
            self.respond(200 if engine is not None or pool_ready else 503, {
                "ok": engine is not None or pool_ready, "voice": VOICE_ID,
                "workers": WORKER_COUNT, "active": queue_busy, "waiting": len(queue_waiters),
                "max_pending": MAX_WAITING_TOTAL, "onnx_threads_per_worker": 1,
                "ack_ready": ack_wav is not None,
                "generated_audio_persisted": False,
            })
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self):
        global pool_ready
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

        queue_ms, queue_error = acquire_inference(self.client_disconnected)
        if queue_error:
            if queue_error != "client_gone":
                print("[FORZA_NIMA_REJECT] reason=%s" % queue_error,
                      file=sys.stderr, flush=True)
                self.respond(503, {"error": queue_error})
            return
        start = time.monotonic()
        try:
            wav = synthesize_request(phrase, self.client_disconnected)
            inference_ms = round((time.monotonic() - start) * 1000)
            timings = (queue_ms, inference_ms)
            if self.path == "/speak-stream":
                # The browser's existing framing parser accepts a single
                # complete WAV, which cannot underrun between model segments.
                self.respond(200, struct.pack("<I", len(wav)) + wav,
                             "application/x-forza-wav-frames", timings)
            else:
                self.respond(200, wav, "audio/wav", timings)
            print("[FORZA_NIMA_PRODUCTION] queue_ms=%d inference_ms=%d wav_bytes=%d chars=%d" % (
                queue_ms, inference_ms, len(wav), len(phrase)
            ), flush=True)
        except BrokenProcessPool:
            # A native worker crash poisons the whole executor. Do not keep
            # advertising healthy service forever: let Docker's restart policy
            # recreate and warm the private pool. No partial WAV was sent.
            pool_ready = False
            print("[FORZA_NIMA_FATAL] pool_broken restart_required=1", file=sys.stderr, flush=True)
            self.respond(503, {"error": "voice_unavailable"})
            os.kill(os.getpid(), signal.SIGTERM)
        except (BrokenPipeError, ConnectionResetError, InterruptedError):
            self.close_connection = True
        except Exception as exc:
            # A production Error type alone is not actionable. Report safe
            # exception identity and source location without exception text,
            # phonemes, transcripts, audio or private runtime paths.
            print("[FORZA Nima] generation_error=%s %s queue_ms=%d inference_elapsed_ms=%d chars=%d" % (
                type(exc).__name__, generation_error_diagnostics(exc),
                queue_ms, round((time.monotonic()-start)*1000), len(phrase)
            ), file=sys.stderr, flush=True)
            if not self.wfile.closed:
                try:
                    self.respond(503, {"error": "voice_unavailable"})
                except (BrokenPipeError, ConnectionResetError):
                    self.close_connection = True
        finally:
            release_inference()


class PrivateServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    request_queue_size = 16


def main():
    global engine, inference_pool, pool_ready, ack_wav
    def stop_service(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop_service)
    if not MODEL.is_file() or not (MODEL.parent / (MODEL.name + ".json")).is_file():
        raise RuntimeError("nima_model_missing")
    if WORKER_COUNT == 1:
        initialize_engine()
    else:
        context = multiprocessing.get_context("spawn")
        ready = context.Queue()
        inference_pool = concurrent.futures.ProcessPoolExecutor(
            max_workers=WORKER_COUNT, mp_context=context,
            initializer=initialize_engine, initargs=(ready,))
        probes = [inference_pool.submit(worker_identity) for _ in range(WORKER_COUNT)]
        deadline = time.monotonic()+90
        try:
            for _ in range(WORKER_COUNT):
                ready.get(timeout=max(0.1, deadline-time.monotonic()))
            for probe in probes:
                probe.result(timeout=max(0.1, deadline-time.monotonic()))
            pool_ready = True
        except BaseException:
            inference_pool.shutdown(wait=False, cancel_futures=True)
            raise
    # Pre-generate one short Nima acknowledgement during service warm-up.
    # This removes the first-inference delay from the beginning of every
    # customer turn without pretending it is the technical answer.
    ack_started = time.monotonic()
    try:
        ack_wait, ack_error = acquire_inference(lambda: False)
        if ack_error:
            raise RuntimeError(ack_error)
        try:
            ack_wav = synthesize_request(ACK_TEXT, lambda: False)
        finally:
            release_inference()
        print("[FORZA_NIMA_ACK] ready=1 warm_ms=%d bytes=%d" % (
            round((time.monotonic()-ack_started)*1000), len(ack_wav)), flush=True)
    except Exception as exc:
        ack_wav = None
        print("[FORZA_NIMA_ACK] ready=0 type=%s" % type(exc).__name__,
              file=sys.stderr, flush=True)

    print("[FORZA Nima] ready voice=%s warmed=1 no_audio_files=1" % VOICE_ID,
          flush=True)
    port = int(os.environ.get("PORT", "8080"))
    bind = os.environ.get("FORZA_NIMA_BIND", "::")
    PrivateServer.address_family = socket.AF_INET6 if ":" in bind else socket.AF_INET
    try:
        PrivateServer((bind, port), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if inference_pool is not None:
            inference_pool.shutdown(wait=True, cancel_futures=True)


if __name__ == "__main__":
    main()
