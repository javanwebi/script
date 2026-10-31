# FORZA — licensed Pocket teacher WAV dataset (pilot, then full)

**Status:** an offline *tool*, not an executed voice generation. The initial pilot must be run on the owner's VPS. No new Piper/VITS model has been trained or shipped; production TTS does not change.

The owner explicitly confirmed that the selected Pocket output is permitted for training/distillation of a replacement model. Review the actual written terms before distribution. This workflow makes **training artifacts intentionally stored to private disk** (not customer audio). It does not access any customer data or transcript, never sends audio to the public Internet, and has no host/listening port.

## Hardware and inputs

- Ubuntu VPS with Docker, existing `/opt/sanatpish` checkout, healthy `forza-voice` and `sanatpish-new`.
- Existing exact Pocket speaker reference SHA256 `31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833`. Runner verifies either the currently live image or exactly one older stopped Pocket backup. Never substitutes Amir.
- Current `/opt/forza-custom-work/prompts.txt`: 368 UTF-8 unique Persian lines, user has already generated it. Directory must be owned by root and **mode 0700**.
- 2.45 GiB available host RAM minimum to begin; isolated candidate limited to 1 CPU and 2 GiB memory. **Running 5 phrases may take minutes**, not milliseconds. The longer corpus could take hours; run only after pilot listening approval.
- Pocket image must have `numpy`, `soundfile` and `scipy.signal.resample_poly` installed. If scipy is not present, it fails safely without touching production and needs a *separate* research image; do not install anything into the live container.

## Step 0 — exactly ONE isolated voice check

Before generating five samples, produce exactly the **first** synthetic sentence with the original selected Pocket voice in a dedicated private output folder:

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
python3 tests/test_forza_teacher_dataset.py
sudo chmod 700 /opt/forza-custom-work
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes \
  bash ops/forza-pocket-teacher-corpus-vps.sh --one
```

Expected success marker: `FORZA_TEACHER_VPS_PASS mode=one ... wav_count=1`.

```bash
wc -l /opt/forza-custom-work/one/metadata.csv
file /opt/forza-custom-work/one/wav/forza_0001.wav
ls -lh /opt/forza-custom-work/one/wav/forza_0001.wav
```

The resulting audio is a **teacher sample** with 22,050 Hz mono PCM16, not evidence that the future Piper model is trained or fast. Listen to this sample privately before doing more. The `--one` mode does not unlock the full corpus: the separate 5-sample listening gate remains mandatory before `--full`.

## Step 1 — 5-clip listen-first pilot

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
python3 tests/test_forza_teacher_dataset.py
sudo chmod 700 /opt/forza-custom-work
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes \
  bash ops/forza-pocket-teacher-corpus-vps.sh --pilot
```

This produces:

```text
/opt/forza-custom-work/pilot/
  metadata.csv
  wav/forza_0001.wav
  wav/forza_0002.wav
  wav/forza_0003.wav
  wav/forza_0004.wav
  wav/forza_0005.wav
```

Each transcript maps to a deterministic filename; conversion is high-quality polyphase FIR from 24,000 Hz mono PCM16 Pocket output to 22,050 Hz mono PCM16 Piper training format. WAVs are intentionally stored privately as dataset assets. The customer-facing application and Pocket voice remain unchanged.

Confirm count and file types:

```bash
wc -l /opt/forza-custom-work/pilot/metadata.csv
file /opt/forza-custom-work/pilot/wav/*.wav
ls -lh /opt/forza-custom-work/pilot/wav/
```

**Listen to all 5 recordings** on an authorized local workstation, using SSH/SCP as needed (do not put them in a public web folder). Verify *same perceived selected male FORZA voice*, full natural pronunciation of Persian technical terms, lack of truncation, no invented words, and no unwanted pauses. The original speaker hash proves which reference was used, **not** that generated speech is acceptable for student training.

## Step 2 — 368-clip dataset (only after listening acceptance)

```bash
cd /opt/sanatpish
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes FORZA_TEACHER_PILOT_APPROVED=yes \
  bash ops/forza-pocket-teacher-corpus-vps.sh --full
```

For safety `--full` requires both a passing 5-WAV pilot format check and a separate environment acknowledgment of listening quality. It is resumable from the private manifest and never replaces existing WAVs silently. If interrupted during a write, a manual integrity check and cleanup may be necessary. A successful completion additionally requires the separate dataset gate to accept **368 WAVs and at least 30 minutes of usable audio**. If duration is less than 30 minutes, collect more **varied** licensed material; do not lower the floor simply to pass.

Do not commit, expose, cache or publicly upload the WAV files. The dataset must be privately transferred to an independent GPU trainer with its access permissions preserved. On that trainer, set `FORZA_TRAIN_DATASET` to the private `full` directory, then use the existing `ops/forza-piper-custom-train-gpu.sh` documentation. Neither the VPS runner nor this phase actually performs model training or proves speedup.

## Stop conditions / operational notes

- `FORZA_TEACHER_ABORT wrong_voice_image`: selected reference not identical; **stop**, do not select another male voice.
- `FORZA_TEACHER_ABORT insufficient_free_ram`: retry when fewer services are competing; do not stop live app.
- `ModuleNotFoundError: scipy`: original Pocket image lacks resampler. Create separate candidate image with dependencies, not in-place production mutation.
- `teacher_duration_out_of_training_bounds`: clip exceeded 20 seconds (or shorter than 1 second); revise that fixed prompt in a new version and recheck transcript pairing; do not truncate the training clip.
- Never infer voice quality, training correctness, or RTF from shell syntax or manifest-count success.
