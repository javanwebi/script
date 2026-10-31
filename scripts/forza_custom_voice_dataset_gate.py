#!/usr/bin/env python3
"""Fail-closed private dataset quality gate for a custom FORZA Piper voice.

The CSV and WAVs must be local to the authorized training machine.
Does NOT copy, upload, synthesize, or save user/customer audio.
CSV format (current piper1-gpl): sample.wav|matching Persian transcript
"""
import argparse
import array
import csv
import json
import math
from pathlib import Path
import re
import sys
import wave

SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.wav$", re.I)


class DatasetError(ValueError):
    pass


def inspect_wav(path: Path, sample_rate: int, min_seconds: float, max_seconds: float):
    try:
        with wave.open(str(path), "rb") as wav:
            if wav.getcomptype() != "NONE" or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                raise DatasetError("must_be_mono_pcm16")
            if wav.getframerate() != sample_rate:
                raise DatasetError("wrong_sample_rate")
            frames = wav.getnframes()
            duration = frames / sample_rate
            if not min_seconds <= duration <= max_seconds:
                raise DatasetError("outside_duration_range")
            if frames <= 0:
                raise DatasetError("empty_wav")
            # Sample beginning, middle and end. No waveforms are retained.
            samples = []
            count = min(frames, sample_rate // 4)
            for offset in (0, max(0, frames // 2 - count // 2), max(0, frames - count)):
                wav.setpos(offset)
                pcm = array.array("h")
                pcm.frombytes(wav.readframes(count))
                if sys.byteorder != "little":
                    pcm.byteswap()
                samples.extend(pcm)
            if not samples:
                raise DatasetError("empty_pcm")
            peak = max(abs(x) for x in samples)
            if peak < 128:
                raise DatasetError("silent_or_extremely_low_level")
            clipping_ratio = sum(abs(x) >= 32760 for x in samples) / len(samples)
            if clipping_ratio > 0.02:
                raise DatasetError("heavy_clipping")
            return duration
    except (EOFError, wave.Error, OSError) as exc:
        raise DatasetError("unreadable_wav") from exc


def inspect_dataset(csv_path: Path, audio_dir: Path, *, min_clips: int = 300,
                    min_minutes: float = 30.0, sample_rate: int = 22050,
                    min_seconds: float = 1.0, max_seconds: float = 20.0):
    if not csv_path.is_file():
        raise DatasetError("missing_metadata_csv")
    if not audio_dir.is_dir():
        raise DatasetError("missing_audio_dir")
    if min_clips < 1 or min_minutes < 0:
        raise DatasetError("invalid_thresholds")
    root = audio_dir.resolve()
    names = set()
    issues = []
    seconds = 0.0
    rows = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
        for row in csv.reader(stream, delimiter="|"):
            rows += 1
            if len(row) != 2:
                issues.append(f"row_{rows}:expected_filename_pipe_text")
                continue
            filename, text = row
            filename = filename.strip()
            text = text.strip()
            if not SAFE_NAME.fullmatch(filename) or filename in (".", ".."):
                issues.append(f"row_{rows}:unsafe_filename")
                continue
            if filename.casefold() in names:
                issues.append(f"row_{rows}:duplicate_filename")
                continue
            names.add(filename.casefold())
            # Do not echo private transcript; only verify length and characters.
            if not 4 <= len(text) <= 400 or "\x00" in text:
                issues.append(f"row_{rows}:invalid_transcript_length")
                continue
            if not any("\u0600" <= ch <= "\u06ff" for ch in text):
                issues.append(f"row_{rows}:no_persian_text")
                continue
            path = (root / filename).resolve()
            if not path.is_relative_to(root) or path.is_symlink():
                issues.append(f"row_{rows}:unsafe_audio_path")
                continue
            if not path.is_file():
                issues.append(f"row_{rows}:missing_wav")
                continue
            try:
                seconds += inspect_wav(path, sample_rate, min_seconds, max_seconds)
            except DatasetError as exc:
                issues.append(f"row_{rows}:{exc}")
    if rows < min_clips:
        issues.append(f"too_few_clips:{rows}<{min_clips}")
    if seconds < min_minutes * 60:
        issues.append(f"too_few_minutes:{seconds / 60:.1f}<{min_minutes}")
    if issues:
        raise DatasetError(";".join(issues[:20]) + (f";and_{len(issues)-20}_more" if len(issues) > 20 else ""))
    return {"clips": rows, "audio_minutes": round(seconds / 60, 2),
            "sample_rate_hz": sample_rate, "mono_pcm16": True,
            "read_only": True, "customer_audio_saved": False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True, type=Path)
    p.add_argument("--audio-dir", required=True, type=Path)
    p.add_argument("--min-clips", type=int, default=300)
    p.add_argument("--min-minutes", type=float, default=30.0)
    p.add_argument("--sample-rate", type=int, default=22050, choices=[22050])
    args = p.parse_args()
    try:
        result = inspect_dataset(args.csv, args.audio_dir,
                                 min_clips=args.min_clips,
                                 min_minutes=args.min_minutes,
                                 sample_rate=args.sample_rate)
    except DatasetError as exc:
        print("FORZA_CUSTOM_DATASET_REJECT " + str(exc), file=sys.stderr)
        return 2
    print("FORZA_CUSTOM_DATASET_PASS " + json.dumps(result, ensure_ascii=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
