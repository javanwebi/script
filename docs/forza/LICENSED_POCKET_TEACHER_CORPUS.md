# FORZA — selected Pocket male voice corpus (approved 5-clip pilot, 728-clips full)

**Status:** user has run and approved five Pocket-teacher voice samples on the VPS. The full corpus, a trained Piper/VITS model, and production migration are NOT yet completed. The current live selected Pocket voice is unchanged.

The owner explicitly confirmed that the selected Pocket output is permitted for training/distillation of a replacement model. Review the actual written terms before distribution. This workflow makes **training artifacts intentionally stored to private disk** (not customer audio). It does not access any customer data or transcript, never sends audio to the public Internet, and has no host/listening port.

## Hardware and inputs

- Ubuntu VPS with Docker, existing `/opt/sanatpish` checkout, healthy `forza-voice` and `sanatpish-new`.
- Existing exact Pocket speaker reference SHA256 `31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833`. Runner verifies either the currently live image or exactly one older stopped Pocket backup. Never substitutes Amir.
- Current `/opt/forza-custom-work/prompts.txt` initially has 368 UTF-8 Persian lines; the **full** dataset requires safely extending it to 728 deterministic lines, preserving the original 368 exact lines (including the 5 approved samples). Directory must be owned by root and **mode 0700**.
- 2.45 GiB available host RAM minimum to begin; isolated candidate limited to 1 CPU and 2 GiB memory. **The 728-clip CPU teacher run may take several hours** depending on host contention. Run it when live traffic is light; the runner is CPU-limited but can still compete with the site.
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

## Step 2 — extend 368 prompts to 728 (preserve already approved WAV transcripts)

The five pilot samples are already approved. Do **not** repeat or overwrite them.
The original 368 prompts alone are projected to yield roughly 24 minutes if the
five-sample average (0.32 min / 5) is representative, which would **FAIL**
the >=30-minute training gate. The additional 360 more varied industrial
sentences target more than 30 minutes of speech; actual duration must be
measured, never assumed.

On the VPS after pulling the newer commit, **without changing production:**

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
sudo chmod 700 /opt/forza-custom-work
sudo python3 scripts/forza_custom_corpus_prompts.py --limit 728 \
  > /opt/forza-custom-work/prompts.next.txt
# Verify the original first 368 lines are IDENTICAL before replacing:
sudo bash -c 'cmp -s /opt/forza-custom-work/prompts.txt <(head -n 368 /opt/forza-custom-work/prompts.next.txt)' \
  || { echo "FORZA_PROMPT_PREFIX_MISMATCH — stop"; exit 1; }
sudo wc -l /opt/forza-custom-work/prompts.next.txt
# Retain original for audit; no overwrite if a backup already exists:
sudo cp -n /opt/forza-custom-work/prompts.txt /opt/forza-custom-work/prompts-368.backup.txt
sudo mv /opt/forza-custom-work/prompts.next.txt /opt/forza-custom-work/prompts.txt
sudo chmod 600 /opt/forza-custom-work/prompts.txt
```

Expected: 728 lines. The original first 368 are unchanged; the 5 approved
private WAV files remain untouched. If `cmp` fails, stop and investigate; do
not force a migration.

## Step 3 — 728-clip full teacher dataset (after approved 5-clip listening test)

```bash
cd /opt/sanatpish
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes FORZA_TEACHER_PILOT_APPROVED=yes \
  bash ops/forza-pocket-teacher-corpus-vps.sh --full
```

For safety `--full` requires both a passing 5-WAV pilot format check and a separate environment acknowledgment of listening quality. It is resumable from the private manifest and never replaces existing WAVs silently. If interrupted during a write, a manual integrity check and cleanup may be necessary. A successful completion additionally requires the separate dataset gate to accept **728 WAVs and at least 30 minutes of usable audio**. If actual duration is under 30 minutes, collect more **varied** licensed material; do not lower the floor simply to pass. The current production Pocket engine is already selected, but this step is only offline teacher-data production — **not** a live voice switch or a trained replacement model.

Do not commit, expose, cache or publicly upload the WAV files. The dataset must be privately transferred to an independent GPU trainer with its access permissions preserved. On that trainer, set `FORZA_TRAIN_DATASET` to the private `full` directory, then use the existing `ops/forza-piper-custom-train-gpu.sh` documentation. Neither the VPS runner nor this phase actually performs model training or proves speedup.

## Step 4 — after corpus quality review

Use the separate GPU machine to train Piper/VITS, export a new ONNX model, transfer it privately to the VPS and run `ops/forza-piper-custom-cpu-gate-vps.sh`. Only after measurable speed and human voice/word-completeness approval should an explicitly approved, rollback-capable production rollout be considered. The 728 recordings do not prove an accurate voice clone; extra variety or recordings may be required.


## Single-command workflow for the approved FORZA male voice

The five private voice samples have been approved. Do NOT overwrite them.
This one-command tool preserves the first 368 transcripts, extends the set to
728, and runs the offline teacher in a resumable isolated container.

On the user's VPS:

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes FORZA_TEACHER_PILOT_APPROVED=yes \
  bash ops/forza-custom-build-dataset-vps.sh --prepare
# Check FORZA_DATA_PREP_READY, then execute during low site traffic:
sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes FORZA_TEACHER_PILOT_APPROVED=yes \
  bash ops/forza-custom-build-dataset-vps.sh --run
```

The full teacher generation is CPU-intensive (potentially several hours) and
has NOT been executed remotely by ChatGPT. It does not change production or
save customer speech. Success requires `FORZA_DATA_FULL_COMPLETE` and
`FORZA_CUSTOM_DATASET_PASS` with >=30 minutes of private licensed speech.

After completion, securely copy the private full dataset to a SEPARATE NVIDIA
GPU machine. Example from the VPS, replacing GPU_USER/GPU_HOST:

```bash
scp -r /opt/forza-custom-work/full/ GPU_USER@GPU_HOST:/private/forza-training/
```

On the GPU box, clone `javanwebi/script` privately and install dependencies:

```bash
sudo apt-get update
sudo apt-get install -y git build-essential cmake ninja-build python3-venv \
  python3-dev espeak-ng libespeak-ng-dev curl
export FORZA_VOICE_RIGHTS_CONFIRMED=yes
export FORZA_APP_DIR=/opt/sanatpish
export FORZA_PIPER_REPO=/private/piper1-gpl
export FORZA_PIPER_CKPT=/private/base-ckpt/lessac-medium.ckpt
export FORZA_TRAIN_DATASET=/private/forza-training/full
export FORZA_TRAIN_OUTPUT=/private/forza-results

bash "$FORZA_APP_DIR/ops/forza-piper-custom-bootstrap-gpu.sh" --setup
bash "$FORZA_APP_DIR/ops/forza-piper-custom-run-gpu.sh" --check
bash "$FORZA_APP_DIR/ops/forza-piper-custom-run-gpu.sh" --train
```

The bootstrap follows
[OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/TRAINING.md)
and obtains the existing medium Piper checkpoint from the official
MIT-labelled Piper checkpoint dataset (check the MODEL_CARD before commercial
deployment). On successful training, export produces one ONNX and matching
JSON. Privately transfer both back to VPS, then run the existing
`ops/forza-piper-custom-cpu-gate-vps.sh`. Only promote to live FORZA after
human speaker comparison and full-text speed testing. The GPU machine and
private full recordings are external dependencies, not present in GitHub.

## Stop conditions / operational notes

- `FORZA_TEACHER_ABORT wrong_voice_image`: selected reference not identical; **stop**, do not select another male voice.
- `FORZA_TEACHER_ABORT insufficient_free_ram`: retry when fewer services are competing; do not stop live app.
- `ModuleNotFoundError: scipy`: original Pocket image lacks resampler. Create separate candidate image with dependencies, not in-place production mutation.
- `teacher_duration_out_of_training_bounds`: clip exceeded 20 seconds (or shorter than 1 second); revise that fixed prompt in a new version and recheck transcript pairing; do not truncate the training clip.
- Never infer voice quality, training correctness, or RTF from shell syntax or manifest-count success.
