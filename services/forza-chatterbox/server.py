#!/usr/bin/env python3
"""Offline Persian Chatterbox TTS sidecar for FORZA.

The Persian t3 checkpoint is loaded ONCE. All requests use that checkpoint;
the stock multilingual model does not support Persian. Keep this service on a
private network. No API calls are made during synthesis after model download.
"""
import io
import json
import logging
import os
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import torch
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file as load_safetensors
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("forza-chatterbox")
MODEL_REPO = "Thomcles/Chatterbox-TTS-Persian-Farsi"
GREETING = "سلام، به صنعت پیش خوش آمدید. من فورزا هستم و برای راهنمایی شما آماده‌ام."
TOKEN = os.environ.get("FORZA_CHATTERBOX_TOKEN", "")
DEVICE = os.environ.get("FORZA_CHATTERBOX_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MAX_CHARS = 220
MAX_WAV_BYTES = 5_000_000

# Avoid CPU oversubscription on small machines.
torch.set_num_threads(max(1, int(os.environ.get("FORZA_CHATTERBOX_THREADS", "2"))))
LOG.info("Loading Persian Chatterbox on %s", DEVICE)
model = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
checkpoint = os.environ.get("FORZA_CHATTERBOX_WEIGHTS") or hf_hub_download(
    repo_id=MODEL_REPO, filename="t3_fa.safetensors",
    token=os.environ.get("HF_TOKEN") or None,
)
model.t3.load_state_dict(load_safetensors(checkpoint, device="cpu"), strict=True)
model.t3.to(DEVICE).eval()
LOG.info("Persian checkpoint loaded: %s", MODEL_REPO)
lock = threading.Lock()
cache = {}
CACHE_LIMIT = 32


def render(text):
    with lock, torch.inference_mode():
        if text in cache:
            return cache[text]
        # Persian finetune requires language_id=None; fa is not in upstream
        # multilingual language ID mapping.
        audio = model.generate(text, language_id=None)
        samples = audio.detach().float().cpu().numpy().reshape(-1)
        samples = np.clip(samples, -1.0, 1.0)
        pcm = (samples * 32767).astype("<i2").tobytes()
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(model.sr)
            wav.writeframes(pcm)
        data = output.getvalue()
        if len(data) < 44 or len(data) > MAX_WAV_BYTES:
            raise ValueError("wav_size_out_of_range")
        if len(cache) >= CACHE_LIMIT:
            cache.pop(next(iter(cache)))
        cache[text] = data
        return data


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {"ok": True, "voice": "chatterbox-persian", "device": DEVICE})
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/synthesize":
            return self.respond(404, {"error": "not_found"})
        if TOKEN and self.headers.get("Authorization") != "Bearer " + TOKEN:
            return self.respond(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                return self.respond(400, {"error": "invalid_body"})
            payload = json.loads(self.rfile.read(length))
            phrase = payload.get("text", "")
            if not isinstance(phrase, str) or not phrase.strip() or len(phrase) > MAX_CHARS:
                return self.respond(400, {"error": "invalid_text"})
            data = render(phrase.strip())
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("X-Forza-Voice", "chatterbox-persian")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            LOG.exception("Chatterbox synthesis failed")
            try:
                self.respond(503, {"error": "synthesis_unavailable"})
            except (BrokenPipeError, ConnectionResetError):
                pass

    def log_message(self, fmt, *args):
        LOG.info("%s %s", self.address_string(), fmt % args)


if __name__ == "__main__":
    # Pre-render the welcome so 100% particle completion never waits for
    # first inference. The readiness check is served only after startup.
    render(GREETING)
    LOG.info("FORZA greeting pre-rendered")
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
