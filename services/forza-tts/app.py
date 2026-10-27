"""FORZA private Persian TTS service — Mana Piper ONNX (MIT model).

Only the Express backend can request speech using a private Bearer token.
The model is baked into the container and loaded once at startup.
"""
from __future__ import annotations

import hmac
import io
import logging
import os
import threading
import time
import wave
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("forza-tts")
MODEL_PATH = Path(os.environ.get("MANA_MODEL_PATH", "/opt/models/fa_IR-mana-medium.onnx"))
VOICE_ID = "mana-fa-ir"
MODEL_ID = "mana-piper-fa"
MAX_INPUT = 800
SYNTH_LOCK = threading.Lock()
VOICE = None


class SpeechRequest(BaseModel):
    model: str = MODEL_ID
    input: str = Field(min_length=1, max_length=MAX_INPUT)
    voice: str = VOICE_ID
    response_format: str = "wav"


def check_auth(authorization: str | None) -> None:
    expected = os.environ.get("FORZA_TTS_TOKEN", "")
    # Require a dedicated secret so the model is not exposed as an open proxy.
    if not expected or not authorization or not hmac.compare_digest(
        authorization, "Bearer " + expected
    ):
        raise HTTPException(status_code=401, detail="unauthorized")


def generate_wav(text: str) -> bytes:
    if VOICE is None:
        raise RuntimeError("tts_engine_not_ready")
    buff = io.BytesIO()
    with SYNTH_LOCK:
        with wave.open(buff, "wb") as wav:
            VOICE.synthesize_wav(text, wav)
    audio = buff.getvalue()
    if len(audio) < 44 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
        raise RuntimeError("invalid_wav_generated")
    return audio


@asynccontextmanager
async def lifespan(app: FastAPI):
    global VOICE
    if not MODEL_PATH.is_file() or not MODEL_PATH.with_suffix(".onnx.json").is_file():
        raise RuntimeError("Mana Piper model assets missing")
    if not os.environ.get("FORZA_TTS_TOKEN"):
        raise RuntimeError("FORZA_TTS_TOKEN must be configured before serving speech")
    from piper import PiperVoice
    started = time.monotonic()
    VOICE = PiperVoice.load(str(MODEL_PATH))
    # Prewarm the real Persian synthesis and its espeak-ng path, not a fake health status.
    warm = await run_in_threadpool(generate_wav, "سلام، من فورزا هستم.")
    app.state.warmup_ms = round((time.monotonic() - started) * 1000)
    logger.info("mana_piper_ready warmup_ms=%s wav_bytes=%s", app.state.warmup_ms, len(warm))
    try:
        yield
    finally:
        VOICE = None


app = FastAPI(title="FORZA private Mana Persian Piper TTS", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    if VOICE is None:
        raise HTTPException(status_code=503, detail="model_not_ready")
    return {"ready": True, "engine": MODEL_ID, "voice": VOICE_ID}


@app.post("/v1/audio/speech")
async def speech(request: SpeechRequest, authorization: str | None = Header(default=None)):
    check_auth(authorization)
    if request.model != MODEL_ID or request.voice != VOICE_ID or request.response_format != "wav":
        raise HTTPException(status_code=400, detail="unsupported_model_voice_or_format")
    text = request.input.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty_speech")
    begin = time.monotonic()
    try:
        wav_audio = await run_in_threadpool(generate_wav, text)
    except Exception:
        logger.exception("tts_generation_error")
        raise HTTPException(status_code=503, detail="speech_generation_failed")
    logger.info("synthesis_ms=%s bytes=%s", round((time.monotonic() - begin) * 1000), len(wav_audio))
    return Response(content=wav_audio, media_type="audio/wav", headers={
        "Cache-Control": "no-store",
        "X-TTS-Engine": MODEL_ID,
    })
