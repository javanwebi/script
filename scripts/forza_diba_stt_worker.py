#!/usr/bin/env python3
"""Persistent, RAM-only Persian Diba/Vosk transcription worker for FORZA.

Input is line-delimited JSON on stdin. WebM/WAV audio is decoded by ffmpeg
through pipes only; no customer recording or transcript is written to disk.
"""
import base64
import binascii
import json
import os
import subprocess
import sys
from pathlib import Path

MODEL_PATH = Path(os.environ.get("FORZA_STT_DIBA_MODEL_PATH", "/opt/diba-stt/model"))
MAX_AUDIO_B64 = 8_000_000
MAX_PCM_BYTES = 16000 * 2 * 45


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def decode_audio(raw):
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000",
            "-f", "s16le", "pipe:1",
        ],
        input=raw,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        timeout=12,
        check=False,
    )
    if proc.returncode != 0 or len(proc.stdout) < 3200:
        raise ValueError("audio_decode_failed")
    if len(proc.stdout) > MAX_PCM_BYTES:
        raise ValueError("audio_too_long")
    return proc.stdout


def transcribe(model, encoded):
    if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_AUDIO_B64:
        raise ValueError("invalid_audio")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("invalid_audio")
    if not raw or len(raw) > 6_000_000:
        raise ValueError("invalid_audio")
    pcm = decode_audio(raw)

    from vosk import KaldiRecognizer
    recognizer = KaldiRecognizer(model, 16000)
    recognizer.SetWords(False)
    segments = []
    # 125 ms PCM windows keep the recognizer's endpointing responsive.
    for offset in range(0, len(pcm), 4000):
        chunk = pcm[offset:offset + 4000]
        if recognizer.AcceptWaveform(chunk):
            result = json.loads(recognizer.Result())
            phrase = str(result.get("text") or "").strip()
            if phrase:
                segments.append(phrase)
    final = json.loads(recognizer.FinalResult())
    phrase = str(final.get("text") or "").strip()
    if phrase:
        segments.append(phrase)
    return " ".join(segments).strip()


def main():
    if not (MODEL_PATH / "am").is_dir() or not (MODEL_PATH / "conf").is_dir():
        emit({"type": "fatal", "code": "diba_model_missing"})
        return 2

    from vosk import Model, SetLogLevel
    SetLogLevel(-1)
    model = Model(str(MODEL_PATH))
    emit({"type": "ready", "provider": "diba-vosk", "sampleRate": 16000})

    for line in sys.stdin:
        request_id = ''
        try:
            request = json.loads(line)
            request_id = str(request.get("id") or "")[:80]
            text = transcribe(model, request.get("audioBase64"))
            emit({"id": request_id, "ok": True, "text": text})
        except ValueError as error:
            code = str(error)
            if code not in ("audio_decode_failed", "audio_too_long", "invalid_audio"):
                code = "audio_invalid"
            emit({"id": request_id if "request_id" in locals() else "", "ok": False, "code": code})
        except subprocess.TimeoutExpired:
            emit({"id": request_id if "request_id" in locals() else "", "ok": False, "code": "audio_decode_timeout"})
        except Exception as error:
            # Never expose exception messages: decoders may include input data.
            emit({"id": request_id if "request_id" in locals() else "", "ok": False,
                  "code": type(error).__name__[:48] or "stt_worker_error"})


if __name__ == "__main__":
    raise SystemExit(main())
