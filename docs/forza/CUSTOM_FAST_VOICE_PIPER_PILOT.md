# FORZA Fast Custom Voice — Phase 1 (Piper VITS, Persian, CPU inference)

Status: **training not yet run; NO trained custom ONNX model exists in this repo.**
This is a guarded pilot, NOT a deployment or 12.8x speed claim.
Original Pocket and selected speaker reference remain untouched.

## Objective / acceptance

- Preserve the *perceived male voice identity* of the chosen FORZA Pocket speaker as closely as authorized audio permits. A new VITS/Piper model will **not** be waveform-identical to Pocket, even with good recordings.
- Benchmark a full one-request Persian answer as **one complete WAV** in memory, with no punctuation-based speech pauses added by our application.
- Target: **RTF <=0.335** on the exact VPS CPU and an appropriate 6–10 s reference audio, separately measure full-WAV response latency, first audio, memory and repeatable p95. This is an aspirational gate, not proven.
- Correct Persian and technical codes: SPA-1250, 6202ZZ, diameters, units, numbers. Speech quality and identity must be assessed by human listening independently of the speed gate.
- NEVER write customer TTS WAV, microphone audio or transcripts. Training data is a separate, manually curated, licensed set of *speaker* recordings; it is never taken from customer conversation logs.

## Why a new model?

Measured original Pocket FlowLM/Mimi can require 32.676 seconds for 7.63 seconds audio; an Amir Piper voice achieved an RTF near 0.335 in a separate benchmark. KV-cached Pocket G2P improved 6.827x for G2P alone, not whole audio. The new architecture trades exact generated voice fidelity for much faster non-autoregressive synthesis. It requires training and may not meet the target without further CPU optimizations.

## Real prerequisite: a licensed voice dataset

Current selected Pocket reference is **only five seconds**. It is insufficient to demonstrate the requested same-identity high-quality voice. Gather many clean utterances in the same target voice with exact matching Persian transcripts, legally licensed **for re-training/distillation and commercial use** (especially if synthesized from Pocket). Do not assume that permission to *use* a TTS voice permits model training. Record speaker consent where relevant.

The gate enforces a **pilot minimum** of 300 utterances / 30 minutes, not a guarantee. More clean, diverse utterances (e.g. 1–2 h) improve the chance of a usable voice. Review recordings and transcripts manually; the manifest gate cannot determine speaker identity, correct word pronunciation, or dataset rights.

On a **separate GPU training box**, privately prepare a directory OUTSIDE the GitHub checkout:

```text
/private/forza-voice-data/
  metadata.csv                 # UTF-8, no header, filename|exact speech
  wav/
    forza_0001.wav              # MONO PCM16, 22050 Hz, 1–20 sec
    forza_0002.wav
    ...
```

Example manifest (for format illustration, NOT a real dataset):
```text
forza_0001.wav|سلام من فورزا هستم و برای راهنمایی شما آماده هستم
forza_0002.wav|برای بررسی تسمه شماره فنی دستگاه را اعلام کنید
```

Use ffmpeg for offline conversion of authorized input audio (never convert customer's audio). Example:
```bash
ffmpeg -nostdin -i /private/source/forza_0001.wav -ar 22050 -ac 1 -c:a pcm_s16le /private/forza-voice-data/wav/forza_0001.wav
```

Validate WITHOUT uploading or copying audio:
```bash
python3 scripts/forza_custom_voice_dataset_gate.py \
  --csv /private/forza-voice-data/metadata.csv \
  --audio-dir /private/forza-voice-data/wav
```

## Training with official piper1-gpl

Use an **independent NVIDIA GPU machine**, not the low-RAM production Ubuntu VPS. Follow current upstream installation at https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/TRAINING.md, including build requirements, creating `.venv` and `./build_monotonic_align.sh`. Record exact training repo commit, dependencies and audio rights before running. Piper is GPL-3.0; review compliance of software redistribution and all checkpoint/model/data-specific terms independently.

Choose a license-compatible **medium** quality Piper checkpoint and store it privately (not in GitHub). Its provenance/license must be reviewed.

```bash
export FORZA_APP_DIR=/path/to/script
export FORZA_PIPER_REPO=/path/to/piper1-gpl
export FORZA_TRAIN_DATASET=/private/forza-voice-data
export FORZA_PIPER_CKPT=/private/medium-base.ckpt
export FORZA_TRAIN_OUTPUT=/private/forza-train
export FORZA_VOICE_RIGHTS_CONFIRMED=yes
export FORZA_TRAIN_BATCH_SIZE=8
export FORZA_TRAIN_MAX_EPOCHS=100
bash "$FORZA_APP_DIR/ops/forza-piper-custom-train-gpu.sh"
```

The script stops if there is no NVIDIA GPU, wrong dataset format, missing checkpoint, missing rights affirmation or an output path inside the app repo. It does not infer training success from command launch.

When checkpoint has been trained and listened to, export:
```bash
export FORZA_FINISHED_CKPT=/private/forza-train/lightning_logs/version_0/checkpoints/actual.ckpt
bash "$FORZA_APP_DIR/ops/forza-piper-custom-export-gpu.sh"
```

Exports `/private/forza-train/export/forza-custom-fa-medium.onnx` and matching `.onnx.json`, still private and **not deployed**.

## CPU benchmark on production VPS: no promotion

Only after a legitimate, actual trained ONNX and JSON have been copied to a **private, non-repository** server folder such as `/opt/forza-custom-model/`:

```bash
cd /opt/sanatpish
# Build benchmark-only image once. Does NOT replace the active TTS container.
docker build -f ops/Dockerfile.forza-custom-piper-bench \
  -t sanatpish/piper-eval:1.8.0 .
export FORZA_CUSTOM_MODEL=/opt/forza-custom-model/forza-custom-fa-medium.onnx
sudo --preserve-env=FORZA_CUSTOM_MODEL bash ops/forza-piper-custom-cpu-gate-vps.sh
```

The gate uses a disposable, read-only, network-isolated Docker container capped at 2 vCPUs/1.5GiB RAM, with the trained model mounted read-only. It reports `FORZA_CUSTOM_PIPER_RESULT` for six fixed (non-customer) Persian phrases and `FORZA_CUSTOM_PIPER_GATE` with speed pass/fail. It does not write WAVs or modify `forza-voice`.

The `--target-rtf` default is **0.335**, based on the old Amir benchmark. Run additional identical text/CPU contention tests (p50/p95, 10 users, complete WAV, pronunciation, ASR checks, listener ABX, accent/prosody) before considering a small canary. **Do not deploy** if Persian quality, selected voice similarity, rights or full-WAV speed are unacceptable.

## What Phase 1 deliberately does NOT do

- It does not magically transfer a five-second Pocket reference into VITS weights.
- It does not automatically create synthetic teacher audio: commercial permission and a bounded, separately approved offline teacher-generation job would be required.
- It does not pull external voice recordings, train the GPU, infer that new voice matches FORZA or touch live TTS in any way.
- It does not replace the current ONNX Pocket G2P/FlowLM/Mimi tests or invalidate the last measured results.
