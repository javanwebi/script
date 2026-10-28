"""Standalone low-resource Persian voice API for FORZA. Does not change the website."""
import asyncio
import base64
import io
import os
import secrets
import subprocess
import threading
import wave
from tempfile import NamedTemporaryFile
from pathlib import Path

import httpx
from diba_stt import DibaSTT
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from piper import PiperVoice
from pydantic import BaseModel, Field

app = FastAPI(title="FORZA Persian Voice API", docs_url=None, redoc_url=None)
MODEL_PATH = Path(os.getenv("PIPER_MODEL", "/opt/voices/fa_IR-amir-medium.onnx"))
DIBA_MODEL = os.getenv("DIBA_MODEL", "fa-small")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
VOICE_TOKEN = os.getenv("FORZA_VOICE_TOKEN", "")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
MAX_INPUT_BYTES = 2_000_000
MAX_TEXT_LENGTH = 750
voice = None
recognizer = None
tts_lock = threading.Lock()
stt_lock = threading.Lock()


class SpeechInput(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)


class ChatInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def authorized(x_voice_token: str | None = Header(default=None)) -> None:
    if not VOICE_TOKEN:
        raise HTTPException(503, "Voice authentication is not configured")
    if not x_voice_token or not secrets.compare_digest(x_voice_token, VOICE_TOKEN):
        raise HTTPException(401, "Unauthorized")


def get_tts():
    global voice
    with tts_lock:
        if voice is None:
            voice = PiperVoice.load(str(MODEL_PATH), use_cuda=False)
        return voice


def synthesize(text: str) -> bytes:
    text = text.strip()
    if not text or len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(422, "Text must contain 1-750 characters")
    with tts_lock:
        v = get_voice_unlocked()
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as output:
            v.synthesize_wav(text, output)
        return buffer.getvalue()


def get_voice_unlocked():
    global voice
    if voice is None:
        voice = PiperVoice.load(str(MODEL_PATH), use_cuda=False)
    return voice


def recognize_sync(data: bytes) -> str:
    global recognizer
    conversion = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
         "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
        input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=20, check=False,
    )
    if conversion.returncode != 0 or not conversion.stdout:
        raise ValueError("Invalid audio format")
    with wave.open(io.BytesIO(conversion.stdout), "rb") as wav:
        if wav.getnframes() > 16_000 * 20:
            raise ValueError("Audio must be 20 seconds or less")
    with stt_lock:
        if recognizer is None:
            recognizer = DibaSTT(DIBA_MODEL)
        with NamedTemporaryFile(suffix=".wav", delete=True) as file:
            file.write(conversion.stdout)
            file.flush()
            result = recognizer.transcribe(file.name)
    if isinstance(result, dict):
        return str(result.get("text") or "").strip()
    return str(result or "").strip()


async def read_transcript(audio: UploadFile) -> str:
    data = await audio.read(MAX_INPUT_BYTES + 1)
    if len(data) > MAX_INPUT_BYTES:
        raise HTTPException(413, "Audio too large (max 2 MB)")
    try:
        return await asyncio.to_thread(recognize_sync, data)
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Audio decoding timed out")
    except ValueError as error:
        raise HTTPException(422, str(error))
    except Exception as error:
        print(f"STT unavailable: {type(error).__name__}: {error}", flush=True)
        raise HTTPException(503, "STT model not available")


async def ask_gemini(text: str) -> str:
    if not GEMINI_KEY:
        raise HTTPException(503, "Gemini API key is not configured")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": text}]}],
            "generationConfig": {"maxOutputTokens": 320}}
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(endpoint, headers={"x-goog-api-key": GEMINI_KEY}, json=body)
        response.raise_for_status()
        data = response.json()
        text_parts = []
        for candidate in data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if isinstance(part.get("text"), str):
                    text_parts.append(part["text"])
        result = "\n".join(text_parts).strip()
        if not result:
            raise HTTPException(502, "Gemini returned no text")
        return result
    except httpx.HTTPStatusError as error:
        print(f"Gemini status: {error.response.status_code}", flush=True)
        raise HTTPException(502, f"Gemini returned HTTP {error.response.status_code}")
    except httpx.RequestError:
        raise HTTPException(502, "Gemini connection unavailable")


@app.get("/health")
def health():
    return {
        "status": "online",
        "tts_model_file": MODEL_PATH.is_file(),
        "stt_model": DIBA_MODEL,
        "stt_loaded": recognizer is not None,
        "gemini_configured": bool(GEMINI_KEY),
    }


@app.post("/v1/tts", dependencies=[Depends(authorized)])
async def tts(request: SpeechInput):
    audio = await asyncio.to_thread(synthesize, request.text)
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@app.post("/v1/stt", dependencies=[Depends(authorized)])
async def stt(audio: UploadFile = File(...)):
    text = await read_transcript(audio)
    return {"text": text, "language": "fa"}


@app.post("/v1/chat", dependencies=[Depends(authorized)])
async def chat(request: ChatInput):
    return {"text": await ask_gemini(request.text), "model": GEMINI_MODEL}


@app.post("/v1/converse", dependencies=[Depends(authorized)])
async def converse(audio: UploadFile = File(...)):
    transcript = await read_transcript(audio)
    if not transcript:
        raise HTTPException(422, "No speech detected")
    reply = await ask_gemini(
        "به فارسی و کوتاه پاسخ بده. پرسش کاربر: " + transcript
    )
    # This route returns one complete WAV; use incremental /v1/tts later for live playback.
    wav = await asyncio.to_thread(synthesize, reply[:MAX_TEXT_LENGTH])
    return {
        "transcript": transcript,
        "reply": reply,
        "audio_wav_base64": base64.b64encode(wav).decode("ascii"),
    }
