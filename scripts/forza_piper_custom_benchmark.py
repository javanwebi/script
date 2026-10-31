#!/usr/bin/env python3
"""Read-only CPU benchmark of a separately trained FORZA Piper ONNX voice.

Synthesizes each *complete* Persian response in memory and reports full-WAV
latency, RTF and memory. No WAV, PCM, transcript, or customer speech saved.
Only fixed public synthetic test phrases, never customer text.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import resource
import sys
import time
import wave

SAMPLES = (
    "سلام من فورزا هستم و برای راهنمایی انتخاب قطعات صنعتی آماده هستم",
    "برای انتخاب تسمه صنعتی مناسب شماره فنی و مشخصات دستگاه را بفرمایید تا موجودی و گزینه‌های سازگار را بررسی کنم",
    "بلبرینگ شش هزار و دویست و دو زد زد و تسمه اس پی آ هزار و دویست و پنجاه برای دستگاه بسته بندی",
    "ما در صنعت پیش قطعات خطوط کاشی و سرامیک نساجی و صنایع غذایی را بررسی می‌کنیم",
    "اگر قطعه مورد نیاز شما در کاتالوگ موجود نباشد می‌توانید درخواست ساخت اختصاصی ثبت کنید",
    "برای مشخص کردن اندازه دقیق قطر شفت و عرض تسمه لازم است مشخصات فنی را اعلام کنید",
)
PUNCT = re.compile(r"[،,؛;:!?؟…—–\[\]{}()]")
SENTENCE_DOT = re.compile(r"(?<!\d)\.|\.(?!\d)")


def continuous_spoken_text(text):
    """No punctuation-induced sentence gaps. Preserve decimal dots and codes."""
    return " ".join(PUNCT.sub(" ", SENTENCE_DOT.sub(" ", text)).split())


def render_full_wav(voice, text):
    """The ENTIRE waveform is assembled into one WAV in RAM, no file writes."""
    if len(text) > 800:
        raise ValueError("text_too_long")
    spoken = continuous_spoken_text(text)
    started = time.perf_counter()
    first_ms = None
    pcm = bytearray()
    rate = width = channels = None
    chunks = 0
    for part in voice.synthesize(spoken):
        now = time.perf_counter()
        if first_ms is None:
            first_ms = (now - started) * 1000
            rate, width, channels = (part.sample_rate, part.sample_width,
                                     part.sample_channels)
        if (part.sample_rate, part.sample_width, part.sample_channels) != (rate, width, channels):
            raise ValueError("inconsistent_audio_format")
        if rate < 16000 or width != 2 or channels != 1:
            raise ValueError("unexpected_audio_format")
        block = part.audio_int16_bytes
        if not block:
            continue
        pcm.extend(block)
        chunks += 1
        if len(pcm) > 10_000_000:
            raise ValueError("audio_too_large")
    if not pcm:
        raise ValueError("empty_audio")
    wav_stream = io.BytesIO()
    with wave.open(wav_stream, "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(width)
        output.setframerate(rate)
        output.writeframes(pcm)
    wav = wav_stream.getvalue()
    elapsed_ms = (time.perf_counter() - started) * 1000
    audio_seconds = len(pcm) / (rate * width * channels)
    return {"first_audio_ms": round(first_ms), "complete_wav_ms": round(elapsed_ms),
            "audio_seconds": round(audio_seconds, 2),
            "rtf": round(elapsed_ms / (audio_seconds * 1000), 4),
            "wav_sha256": hashlib.sha256(wav).hexdigest(),
            "wav_bytes": len(wav), "internal_chunks": chunks, "wav_count": 1}


def benchmark(model: Path, target_rtf: float):
    from piper import PiperVoice

    config = Path(str(model) + ".json")
    if not model.is_file() or not config.is_file():
        raise ValueError("missing_onnx_or_json_config")
    with config.open(encoding="utf-8") as handle:
        cfg = json.load(handle)
    code = cfg.get("language", {}).get("code", "")
    espeak = cfg.get("espeak", {}).get("voice", "")
    if code not in ("fa", "fa_IR") and espeak not in ("fa", "fa-ir", "fa_IR"):
        raise ValueError("not_a_persian_piper_model")
    loaded = time.perf_counter()
    voice = PiperVoice.load(str(model), config_path=str(config))
    load_ms = (time.perf_counter() - loaded) * 1000
    # Warm-up excluded from answer timing but reported separately.
    warm = render_full_wav(voice, "سلام من فورزا هستم")
    results = []
    print(f"FORZA_CUSTOM_PIPER_READY load_ms={load_ms:.0f} warmup_ms={warm['complete_wav_ms']} bytes={model.stat().st_size}", flush=True)
    for idx, sample in enumerate(SAMPLES, 1):
        row = render_full_wav(voice, sample)
        row["sample"] = idx
        row["speed_pass"] = int(row["rtf"] <= target_rtf)
        results.append(row)
        print("FORZA_CUSTOM_PIPER_RESULT " + " ".join(f"{k}={v}" for k, v in row.items()), flush=True)
    ordered = sorted(x["rtf"] for x in results)
    # Nearest-rank p95 with n=6; all samples must pass to qualify.
    p95 = ordered[max(0, int(__import__("math").ceil(0.95 * len(ordered))) - 1)]
    max_peak_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    status = int(all(x["speed_pass"] for x in results))
    print(f"FORZA_CUSTOM_PIPER_GATE target_rtf={target_rtf} p95_rtf={p95:.4f} pass_speed={status} peak_rss_kib={max_peak_kb} production_deployed=0 human_voice_review_required=1")
    return 0 if status else 3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--target-rtf", type=float, default=0.335)
    args = parser.parse_args()
    if not 0.05 <= args.target_rtf <= 2.0:
        parser.error("invalid target RTF")
    try:
        return benchmark(args.model, args.target_rtf)
    except (ValueError, OSError) as exc:
        print(f"FORZA_CUSTOM_PIPER_ABORT {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
