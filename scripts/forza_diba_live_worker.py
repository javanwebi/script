#!/usr/bin/env python3
"""RAM-only multiplexed Persian Diba/Vosk streaming worker for FORZA.

Protocol: newline-delimited JSON commands (start/audio/end/cancel). Audio is
16 kHz mono signed little-endian PCM16 encoded as base64. One model is shared
by many independent KaldiRecognizer sessions in this process; no audio or
transcript is written to disk.
"""
import base64
import binascii
import json
import os
import sys
from pathlib import Path

MODEL_PATH = Path(os.environ.get("FORZA_STT_DIBA_MODEL_PATH", "/opt/diba-stt/model"))
MAX_STREAMS = max(1, min(16, int(os.environ.get("FORZA_STT_LIVE_SESSIONS_PER_WORKER", "10"))))
MAX_CHUNK_B64 = 96_000
MAX_PCM_BYTES = 48_000


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def text_from_result(raw, field):
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return ""
    return str(value.get(field) or "").strip()


def process_command(model, streams, request, recognizer_type):
    command = str(request.get("type") or "")
    stream_id = str(request.get("streamId") or "")[:80]
    if not stream_id:
        return [{"type": "error", "code": "stream_id_required"}]

    if command == "start":
        if stream_id in streams:
            return [{"type": "started", "streamId": stream_id}]
        if len(streams) >= MAX_STREAMS:
            return [{"type": "error", "streamId": stream_id, "code": "worker_stream_capacity"}]
        recognizer = recognizer_type(model, 16000)
        recognizer.SetWords(False)
        streams[stream_id] = recognizer
        return [{"type": "started", "streamId": stream_id}]

    recognizer = streams.get(stream_id)
    if recognizer is None:
        return [{"type": "error", "streamId": stream_id, "code": "stream_not_found"}]

    if command == "audio":
        encoded = request.get("pcmBase64")
        if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_CHUNK_B64:
            return [{"type": "error", "streamId": stream_id, "code": "invalid_pcm_chunk"}]
        try:
            pcm = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            return [{"type": "error", "streamId": stream_id, "code": "invalid_pcm_chunk"}]
        if not pcm or len(pcm) > MAX_PCM_BYTES or len(pcm) % 2:
            return [{"type": "error", "streamId": stream_id, "code": "invalid_pcm_chunk"}]

        events = []
        if recognizer.AcceptWaveform(pcm):
            final_text = text_from_result(recognizer.Result(), "text")
            if final_text:
                events.append({"type": "final", "streamId": stream_id, "text": final_text})
        partial_text = text_from_result(recognizer.PartialResult(), "partial")
        if partial_text:
            events.append({"type": "partial", "streamId": stream_id, "text": partial_text})
        return events

    if command == "end":
        final_text = text_from_result(recognizer.FinalResult(), "text")
        streams.pop(stream_id, None)
        return ([{"type": "final", "streamId": stream_id, "text": final_text}]
                if final_text else []) + [{"type": "ended", "streamId": stream_id}]

    if command == "cancel":
        streams.pop(stream_id, None)
        return [{"type": "ended", "streamId": stream_id}]

    return [{"type": "error", "streamId": stream_id, "code": "unknown_stream_command"}]


def main():
    if not (MODEL_PATH / "am").is_dir() or not (MODEL_PATH / "conf").is_dir():
        emit({"type": "fatal", "code": "diba_model_missing"})
        return 2

    from vosk import Model, SetLogLevel, KaldiRecognizer
    SetLogLevel(-1)
    model = Model(str(MODEL_PATH))
    streams = {}
    emit({"type": "ready", "provider": "diba-vosk", "sampleRate": 16000})

    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            if not isinstance(request, dict):
                emit({"type": "error", "code": "invalid_request"})
                continue
            for event in process_command(model, streams, request, KaldiRecognizer):
                emit(event)
        except Exception as error:
            # Never expose exception messages: decoder errors can contain data.
            stream_id = str(request.get("streamId") or "")[:80] if isinstance(request, dict) else ""
            emit({"type": "error", "streamId": stream_id,
                  "code": type(error).__name__[:48] or "diba_stream_worker_error"})

    streams.clear()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
