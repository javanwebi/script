#!/usr/bin/env python3
"""Generate PRIVATE licensed Pocket-teacher WAVs for a future FORZA Piper student.

Only run with the original checksum-verified Pocket image in an isolated,
networkless Docker container. Never sends customer prompts, saves user audio,
or accesses live FORZA APIs. Training WAVs are intentionally saved privately.
"""
import argparse
import csv
import hashlib
import io
import os
from pathlib import Path
import sys
import time
import wave

MAX_PROMPT_CHARS = 220
ORIGINAL_RATE = 24000
TRAIN_RATE = 22050
SELECTED_REFERENCE_SHA = "31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833"


def read_prompts(path: Path, limit: int):
    if limit not in (1, 5, 728):
        raise ValueError("limit_must_be_1_5_or_728")
    if not path.is_file() or path.is_symlink():
        raise ValueError("prompts_file_not_regular")
    texts = path.read_text(encoding="utf-8-sig").splitlines()
    if len(texts) not in (368, 728):
        raise ValueError("expected_368_legacy_or_728_extended_prompts")
    if limit == 728 and len(texts) != 728:
        raise ValueError("full_requires_728_extended_prompts")
    if len(set(texts)) != len(texts):
        raise ValueError("duplicate_prompts")
    if any(not 8 <= len(text) <= MAX_PROMPT_CHARS or
           "|" in text or "\x00" in text or not any("\u0600" <= ch <= "\u06ff" for ch in text)
           for text in texts):
        raise ValueError("invalid_prompts")
    return texts[:limit]


def verify_reference(reference: Path):
    if not reference.is_file() or reference.is_symlink():
        raise ValueError("missing_selected_reference")
    sha = hashlib.sha256(reference.read_bytes()).hexdigest()
    if sha != SELECTED_REFERENCE_SHA:
        raise ValueError("wrong_reference_voice")
    return sha


def resample_wav_in_memory(wav_data: bytes):
    """Resample Pocket 24 kHz mono PCM16 to Piper 22.05 kHz using polyphase FIR."""
    import numpy as np
    from scipy.signal import resample_poly

    with wave.open(io.BytesIO(wav_data), "rb") as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (
            1, 2, ORIGINAL_RATE, "NONE"
        ):
            raise ValueError("unexpected_teacher_wav_format")
        src = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
    if len(src) < ORIGINAL_RATE:
        raise ValueError("too_short_teacher_wav")
    # Fraction 22050/24000 = 147/160, polyphase low-pass avoids aliasing.
    filtered = resample_poly(src.astype(np.float32) / 32768.0, 147, 160)
    target = np.clip(np.rint(filtered * 32768.0), -32768, 32767).astype("<i2")
    seconds = len(target) / TRAIN_RATE
    if seconds < 1 or seconds > 20:
        raise ValueError("teacher_duration_out_of_training_bounds")
    if np.max(np.abs(target.astype(np.int32))) < 128:
        raise ValueError("teacher_audio_silent")
    if float(np.mean(np.abs(target.astype(np.int32)) >= 32760)) > 0.02:
        raise ValueError("teacher_audio_clipped")
    stream = io.BytesIO()
    with wave.open(stream, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(TRAIN_RATE)
        output.writeframes(target.tobytes())
    return stream.getvalue(), seconds


def atomic_write_unreplaceable(path: Path, data: bytes):
    """Output must be new; refuse to replace any existing training WAV."""
    with path.open("xb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())


def atomic_manifest(path: Path, entries):
    """Only a manifest of completed WAVs is written; no partial row."""
    temp = path.with_name(".metadata.tmp")
    if temp.exists() or temp.is_symlink():
        raise ValueError("stale_metadata_tmp_remove_manually")
    with temp.open("x", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="|", lineterminator="\n")
        writer.writerows(entries)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def read_existing_manifest(path: Path):
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle, delimiter="|"))
    if any(len(row) != 2 for row in rows):
        raise ValueError("invalid_existing_manifest")
    return [tuple(row) for row in rows]


def run(args):
    prompts = read_prompts(args.prompts, args.limit)
    reference = Path("/app/public/forza-pocket-reference.wav")
    sha = verify_reference(reference)
    if args.rights_confirmed != "yes":
        raise ValueError("teacher_distillation_rights_not_confirmed")
    if args.output.is_symlink():
        raise ValueError("output_symlink")
    output = args.output.resolve()
    root = Path("/work").resolve()
    expected_folder = {1: "one", 5: "pilot", 728: "full"}[args.limit]
    if output != root / expected_folder:
        raise ValueError("invalid_output_path")
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    wav_dir = output / "wav"
    wav_dir.mkdir(mode=0o700, exist_ok=True)
    if wav_dir.is_symlink():
        raise ValueError("wav_directory_symlink")
    if output.stat().st_mode & 0o077 or wav_dir.stat().st_mode & 0o077:
        raise ValueError("private_permissions_required")
    manifest = output / "metadata.csv"
    existing = read_existing_manifest(manifest)
    if len(existing) > args.limit:
        raise ValueError("existing_manifest_too_long")
    for index, (name, text) in enumerate(existing, start=1):
        expected = (f"forza_{index:04d}.wav", prompts[index - 1])
        if (name, text) != expected:
            raise ValueError("existing_manifest_mismatch")
        if not (wav_dir / name).is_file() or (wav_dir / name).is_symlink():
            raise ValueError("existing_manifest_wav_missing")
    # Reuse the original worker's precomputed speaker-conditioning path.
    # This flag must be present before importing/constructing OnnxTts.
    os.environ["FORZA_POCKET_PRECOMPUTED_VOICE"] = "1"
    # Never touch live container nor use text from customer traffic.
    sys.path.insert(0, "/app/scripts")
    import forza_pocket_worker as pocket
    import numpy as np

    if not pocket.VOICE_STATE.is_file():
        raise ValueError("original_voice_state_missing")
    if not pocket.REFERENCE.is_file():
        raise ValueError("original_reference_missing")
    import contextlib
    with np.load(pocket.VOICE_STATE, allow_pickle=False) as state:
        cache, offset = state["cache"], int(state["offset"])
    engine = pocket.MemoryBoundTts()
    engine.VOICE_MEMO_MAX = 1
    engine._voice_memo[(str(pocket.REFERENCE.resolve()), pocket.REFERENCE.stat().st_mtime)] = (cache, offset)
    print(f"FORZA_TEACHER_START selected_ref_sha256={sha} limit={args.limit} existing={len(existing)} cpu_only=1 network=none live_unchanged=1", flush=True)
    for index in range(len(existing) + 1, args.limit + 1):
        name = f"forza_{index:04d}.wav"
        dest = wav_dir / name
        if dest.exists() or dest.is_symlink():
            raise ValueError("untracked_existing_wav_no_overwrite")
        phrase = prompts[index - 1]
        started = time.monotonic()
        wav = pocket.render(engine, phrase)
        train_wav, duration = resample_wav_in_memory(wav)
        del wav
        atomic_write_unreplaceable(dest, train_wav)
        existing.append((name, phrase))
        atomic_manifest(manifest, existing)
        print(f"FORZA_TEACHER_CLIP index={index} seconds={duration:.2f} elapsed_ms={int((time.monotonic()-started)*1000)} wav_bytes={len(train_wav)} file={name}", flush=True)
        del train_wav
        # The model is CPU-heavy: yield resources to the live website.
        time.sleep(1.0)
    print(f"FORZA_TEACHER_DONE clips={len(existing)} model_voice_unchanged=1 private_wav_saved=1 customer_audio_saved=0 live_unchanged=1", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int, choices=[1, 5, 728], required=True)
    parser.add_argument("--rights-confirmed", default="")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as exc:
        # Don't leak a customer prompt or secret in log messages.
        print(f"FORZA_TEACHER_ABORT type={type(exc).__name__} reason={str(exc)[:90]}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
