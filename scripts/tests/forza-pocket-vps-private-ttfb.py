#!/usr/bin/env python3
"""Measure actual FIRST WAV arrival from inside the private Pocket container.

Reads the private service's own FORZA_VOICE_TOKEN from its environment, rather
than leaking a token to the app container or printing it to CLI/logs.
The ONLY text requested is built-in, fixed sample text; no data persisted.
"""
import http.client
import io
import json
import os
import struct
import sys
import time
import wave

EXPECTED_VOICE = "pocket-farsi-v2"
SAMPLES = [
    ("short", "لطفاً کد فنی قطعه را بفرمایید."),
    ("medium", "برای بررسی تسمه صنعتی، کد و مشخصات روی قطعه را بفرمایید تا بتوانم محصول مناسب را پیشنهاد کنم."),
]


def read_exact(response, length):
    """HTTPResponse decodes transfer chunks. Never allocate unbounded WAV."""
    if length > 8_000_000 or length < 1:
        raise ValueError("invalid_frame_size")
    block = response.read(length)
    if len(block) != length:
        raise ValueError("truncated_frame")
    return block


def wav_ms(blob):
    if not (blob[:4] == b"RIFF" and blob[8:12] == b"WAVE"):
        raise ValueError("invalid_wav_signature")
    with wave.open(io.BytesIO(blob), "rb") as handle:
        if (handle.getnchannels() != 1 or
            handle.getframerate() != 24000 or
            handle.getsampwidth() != 2 or
            handle.getcomptype() != "NONE"):
            raise ValueError("not_original_pocket_pcm_format")
        frames = handle.getnframes()
        if frames < 100:
            raise ValueError("empty_wav")
        return frames / 24.0


def post_stream(port, token, text):
    payload = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    conn = http.client.HTTPConnection("::1", port, timeout=155)
    begin = time.monotonic()
    try:
        conn.request("POST", "/speak-stream", body=payload, headers={
            "Content-Type": "application/json",
            "X-Forza-Voice-Token": token,
        })
        response = conn.getresponse()
        headers_ms = (time.monotonic() - begin) * 1000
        if response.status != 200:
            status = response.status
            raw = response.read(1024)
            try:
                code = json.loads(raw).get("error", "unknown")
            except (ValueError, AttributeError):
                code = "non_json"
            raise RuntimeError("http_%s_%s" % (status, str(code)[:60]))
        if response.getheader("X-Forza-Voice") != EXPECTED_VOICE:
            raise RuntimeError("wrong_voice_header")
        if "application/x-forza-wav-frames" not in (response.getheader("Content-Type") or ""):
            raise RuntimeError("wrong_content_type")
        first_ms = None
        frames = 0
        audio_ms = 0.0
        bytes_received = 0
        while True:
            header = response.read(4)
            if not header:
                break
            if len(header) != 4:
                raise RuntimeError("truncated_length")
            (size,) = struct.unpack("<I", header)
            if size < 44 or size > 8_000_000:
                raise RuntimeError("invalid_frame_length")
            frame = read_exact(response, size)
            bytes_received += size + 4
            if bytes_received > 32_000_000:
                raise RuntimeError("stream_too_large")
            audio_ms += wav_ms(frame)
            frames += 1
            if first_ms is None:
                first_ms = (time.monotonic() - begin) * 1000
            if frames > 256:
                raise RuntimeError("too_many_frames")
        if frames == 0:
            raise RuntimeError("no_wav_frames")
        elapsed = (time.monotonic() - begin) * 1000
        return dict(first_ms=round(first_ms), total_ms=round(elapsed),
                    headers_ms=round(headers_ms), frames=frames,
                    audio_seconds=round(audio_ms / 1000, 3),
                    rtf=round(elapsed / audio_ms, 3),
                    bytes=bytes_received)
    finally:
        conn.close()


def main():
    token = os.environ.get("FORZA_VOICE_TOKEN", "")
    if not token:
        print("FORZA_POCKET_VPS_ERROR route=private_short code=private_token_missing")
        return 1
    port = int(os.environ.get("PORT", "8080"))
    extended = os.environ.get("FORZA_PROBE_EXTENDED") == "1"
    print("FORZA_POCKET_VPS_PRIVATE_START original_voice=pocket-farsi-v2 no_audio_disk_writes=1", flush=True)
    errors = 0
    samples = SAMPLES if extended else SAMPLES[:1]
    for name, sample in samples:
        label = "private_" + name
        try:
            data = post_stream(port, token, sample)
            print("FORZA_POCKET_VPS_RESULT route=%s first_ms=%d headers_ms=%d total_ms=%d "
                  "audio_seconds=%.3f rtf=%.3f frames=%d bytes=%d pass_1000ms=%d" %
                  (label, data["first_ms"], data["headers_ms"], data["total_ms"],
                   data["audio_seconds"], data["rtf"], data["frames"],
                   data["bytes"], int(data["first_ms"] < 1000)), flush=True)
        except Exception as exc:
            errors += 1
            code = str(exc).replace(" ", "_")[:80]
            print("FORZA_POCKET_VPS_ERROR route=%s code=%s" % (label, code), flush=True)
    print("FORZA_POCKET_VPS_PRIVATE_DONE tests=%d errors=%d" %
          (len(samples), errors), flush=True)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
