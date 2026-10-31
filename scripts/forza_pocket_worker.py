#!/usr/bin/env python3
"""FORZA's persistent CPU-only Pocket TTS Farsi v2 worker.
JSON lines on stdin/stdout; logs exclusively on stderr.
The reference is the first 5 seconds of the user-selected generated hello.wav.
"""
import base64
import contextlib
import io
import wave
import json
import os
import re
import sys
import gc
import ctypes
import time
import threading
import numpy as np
from pathlib import Path

ROOT = Path.cwd()
ENGINE_ROOT = ROOT / "vendor" / "persian_tts"
sys.path.insert(0, str(ENGINE_ROOT / "scripts"))
from tts_onnx import OnnxTts
# Keep Railway and production one-worker behaviour by default.
# Explicitly permit two independent phoneme chunks to render concurrently
# only in resource-limited, isolated VPS benchmark containers.
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor as _OriginalPool
PARALLEL_CHUNKS = min(2, max(1, int(os.environ.get("FORZA_TTS_PARALLEL_CHUNKS", "1"))))
# CPU latency optimization: run the FIRST acoustic unit without the second
# unit competing for scarce Xeon compute. Yield its WAV before starting work
# on the remaining units. Default off until measured with selected voice.
FIRST_FRAME_PRIORITY = os.environ.get("FORZA_TTS_FIRST_FRAME_PRIORITY", "0") == "1"
# Opt-in only: test a shorter FIRST chunk with the upstream Persian
# phoneme boundary rules, preserving the original model/voice reference.
# Upstream Pocket was trained near ~11 phoneme tokens per unit; short
# chunks can start earlier but may worsen phrase joins or total speed.
STREAM_FIRST_TOKENS = int(os.environ.get("FORZA_TTS_STREAM_FIRST_TOKENS", "18"))
# Progressive speech mode: keep the full-text, single-request contract,
# but do not treat punctuation as a demand for silence. Can be disabled
# without touching the chosen voice or rolling back the entire service.
UNBROKEN_SPEECH = os.environ.get("FORZA_TTS_UNBROKEN", "1") == "1"
# Preserve decimal points, product codes and hyphens; suppress sentence/
# clause punctuation for the spoken form only (the UI retains original text).
_SENTENCE_DOT = re.compile(r"(?<!\d)\.|\.(?!\d)")
_FLOW_PUNCTUATION = re.compile(r"[،,؛;:!?؟…—–\[\]{}()]")
# CPU-only ORT session threads: default remains the tested 1-thread baseline.
# Two threads are opt-in and must be verified on this specific Xeon CPU.
CPU_INTRA = int(os.environ.get("FORZA_CPU_INTRA", "1"))
# Experimental quality/speed trade-off. One attempt can be faster only when
# Pocket would otherwise retry a bad generation. Preserve 3 for production.
# Never silently change this value on the live voice container.
TTS_ATTEMPTS = int(os.environ.get("FORZA_TTS_RETRY_ATTEMPTS", "3"))
# OFF by default on production: optional thread-local stage profiling ONLY
# in the isolated VPS benchmark, measuring retry count and FlowLM/Mimi time.
TTS_STAGE_PROFILE = os.environ.get("FORZA_TTS_STAGE_PROFILE", "0") == "1"
# Same FlowLM + Mimi weights. Only overlap independent ONNX sessions.
# Default OFF everywhere. Test solely in isolated 2-vCPU canary and compare
# output fidelity and CPU latency before any user-facing rollout.
TTS_OVERLAP_MIMI = os.environ.get("FORZA_TTS_OVERLAP_MIMI", "0") == "1"
# Research-only deterministic seed, strictly opt-in in the isolated profiler.
# This enables fair same-phonemes/same-latents comparisons; it is NEVER set
# on the production worker, where randomized retries are a quality safeguard.
_TEST_SEED_RAW = os.environ.get("FORZA_TTS_TEST_SEED", "")
if _TEST_SEED_RAW and not TTS_STAGE_PROFILE:
    raise ValueError("deterministic_seed_requires_isolated_profiling")
if _TEST_SEED_RAW and (not _TEST_SEED_RAW.isdecimal() or
                       not 0 <= int(_TEST_SEED_RAW) <= 2147483647):
    raise ValueError("invalid_forza_test_seed")
TTS_TEST_SEED = int(_TEST_SEED_RAW) if _TEST_SEED_RAW else None
# The upstream EOS tail is 5 latent frames for <=4-word chunks, 3 for
# longer chunks. The chosen speaker/weights stay the same. Optional smaller
# tails are benchmark-only: any difference in WAV SHA disqualifies promotion.
TTS_EOS_SHORT = int(os.environ.get("FORZA_TTS_EOS_SHORT", "5"))
TTS_EOS_LONG = int(os.environ.get("FORZA_TTS_EOS_LONG", "3"))
if not (1 <= TTS_EOS_SHORT <= 5 and 1 <= TTS_EOS_LONG <= 3):
    raise ValueError("invalid_forza_eos_tail_steps")
if (TTS_EOS_SHORT != 5 or TTS_EOS_LONG != 3) and not TTS_STAGE_PROFILE:
    raise ValueError("eos_tail_tuning_requires_isolated_profiling")
_STAGE_PROFILE_CONTEXT = threading.local()
if TTS_ATTEMPTS not in (1, 2, 3):
    raise ValueError("invalid_forza_tts_retry_attempts")
if CPU_INTRA not in (1, 2):
    raise ValueError("invalid_forza_cpu_intra")
if STREAM_FIRST_TOKENS not in (0, 8, 12, 18, 22, 26):
    raise ValueError("invalid_stream_first_tokens")
class _LimitedPool(_OriginalPool):
    def __init__(self, max_workers=None, *args, **kwargs):
        super().__init__(max_workers=PARALLEL_CHUNKS, *args, **kwargs)
concurrent.futures.ThreadPoolExecutor = _LimitedPool
import soundfile as sf

REFERENCE = ROOT / "public" / "forza-pocket-reference.wav"
GREETING = ROOT / "public" / "forza-greeting-bootstrap.wav"
VOICE_STATE = ENGINE_ROOT / "forza_voice_state.npz"
WELCOME = "سلام، به صنعت پیش خوش آمدید. من فورزا هستم و برای راهنمایی شما آماده‌ام."


def emit(data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def render(engine, text):
    # Upstream synthesize_text prints phonemes: stdout is reserved for JSON frames.
    with contextlib.redirect_stdout(sys.stderr):
        spoken = continuous_persian_speech_text(text) if UNBROKEN_SPEECH else text
        audio = engine.synthesize_text(spoken, str(REFERENCE), mode="pack")
    if len(audio) < 100:
        raise ValueError("empty_audio")
    stream = io.BytesIO()
    sf.write(stream, audio, engine.sample_rate, format="WAV", subtype="PCM_16")
    result = stream.getvalue()
    if len(result) > 8_000_000:
        raise ValueError("audio_too_large")
    return result


def release_unused_memory():
    gc.collect()
    try:
        ctypes.CDLL(None).malloc_trim(0)
    except (AttributeError, OSError):
        pass


def _voice_container_has_resident_budget() -> bool:
    """Opt into warm resident models only when cgroups allow at least 2 GiB.
    A one-gigabyte Railway service keeps the original memory-conservative path.
    Environment flags always override this choice in either direction.
    """
    try:
        value = Path("/sys/fs/cgroup/memory.max").read_text().strip()
        return value.isdigit() and int(value) >= 2 * 1024**3
    except (OSError, ValueError):
        return False


_RESIDENT_BY_BUDGET = _voice_container_has_resident_budget()


class MemoryBoundTts(OnnxTts):
    # On the tested 2-GiB VPS voice container, keep ONNX acoustic/G2P loaded
    # between turns. Never reload the graphs on each full-text request.
    # Railway or other small containers keep the original conservative mode.
    KEEP_ACOUSTIC = os.environ.get("FORZA_TTS_RESIDENT_ACOUSTIC",
                                   "1" if _RESIDENT_BY_BUDGET else "0") == "1"
    KEEP_G2P = os.environ.get("FORZA_TTS_RESIDENT_G2P",
                              "1" if _RESIDENT_BY_BUDGET else "0") == "1"

    def _flow_step(self, *args, **kwargs):
        if not TTS_STAGE_PROFILE and not TTS_OVERLAP_MIMI:
            return super()._flow_step(*args, **kwargs)
        started = time.perf_counter()
        try:
            result = super()._flow_step(*args, **kwargs)
        finally:
            if TTS_STAGE_PROFILE:
                counter = getattr(_STAGE_PROFILE_CONTEXT, "counter", None)
                if counter is not None:
                    counter["flow_step_count"] += 1
                    counter["flow_step_ms"] += (time.perf_counter() - started) * 1000
        if TTS_OVERLAP_MIMI:
            pipe = getattr(_STAGE_PROFILE_CONTEXT, "mimi_pipeline", None)
            if pipe is not None:
                pipe.add(result[0])
        return result

    def _generate_chunk_with_early_eos(self, cache, off, chunk, rng=None):
        """Exact Pocket autoregressive steps, except optional extra EOS tail.

        No pitch/time manipulation, voice conversion, inference pruning or
        re-encoding. Only generate fewer frames AFTER the model emitted EOS.
        The full PCM output MUST be identical under a fixed seed before any
        production consideration.
        """
        tokens = self.sp.encode(chunk, out_type=int)
        text_emb = self.lut[np.asarray(tokens)][None].astype(np.float32)
        r = rng if rng is not None else self.rng
        noise = (r.standard_normal((1, self.ldim)) * (self.temp**0.5)).astype(np.float32)
        lat, _, cache, off = self._flow_step(
            np.full((1, 1, self.ldim), np.nan, np.float32),
            text_emb, off, noise, cache)
        latents = [lat]
        words = len(chunk.split())
        frames_after_eos = TTS_EOS_SHORT if words <= 4 else TTS_EOS_LONG
        max_gen_len = int(np.ceil((len(tokens) / self.tps_est + self.gen_pad) * self.frame_rate))
        eos_step = None
        for step in range(max_gen_len):
            noise = (r.standard_normal((1, self.ldim)) * (self.temp**0.5)).astype(np.float32)
            lat, eos, cache, off = self._flow_step(
                latents[-1].reshape(1, 1, self.ldim),
                np.zeros((1, 0, self.dim), np.float32), off, noise, cache)
            if bool(eos.reshape(-1)[0]) and eos_step is None:
                eos_step = step
            if eos_step is not None and step >= eos_step + frames_after_eos:
                break
            latents.append(lat)
        return latents, cache, off

    def _generate_chunk(self, *args, **kwargs):
        if not TTS_STAGE_PROFILE and not TTS_OVERLAP_MIMI:
            return super()._generate_chunk(*args, **kwargs)
        started = time.perf_counter()
        pipeline = None
        if TTS_OVERLAP_MIMI:
            # Separate ONNX sessions for the autoregressive FlowLM and Mimi.
            # Thread-local pipeline prevents cross-contamination between jobs.
            from forza_pocket_overlap import MimiOverlap
            pipeline = MimiOverlap(self)
            _STAGE_PROFILE_CONTEXT.mimi_pipeline = pipeline
        try:
            result = (self._generate_chunk_with_early_eos(*args, **kwargs)
                      if TTS_EOS_SHORT != 5 or TTS_EOS_LONG != 3
                      else super()._generate_chunk(*args, **kwargs))
            if pipeline is not None:
                _STAGE_PROFILE_CONTEXT.ready_pipeline = pipeline
            return result
        except BaseException:
            if pipeline is not None:
                pipeline.collect(0)
            raise
        finally:
            if pipeline is not None:
                _STAGE_PROFILE_CONTEXT.mimi_pipeline = None
            if TTS_STAGE_PROFILE:
                counter = getattr(_STAGE_PROFILE_CONTEXT, "counter", None)
                if counter is not None:
                    counter["attempt_count"] += 1
                    counter["flow_total_ms"] += (time.perf_counter() - started) * 1000

    def _decode_all(self, latents):
        if not TTS_STAGE_PROFILE and not TTS_OVERLAP_MIMI:
            return super()._decode_all(latents)
        started = time.perf_counter()
        try:
            pipeline = getattr(_STAGE_PROFILE_CONTEXT, "ready_pipeline", None)
            if pipeline is not None:
                _STAGE_PROFILE_CONTEXT.ready_pipeline = None
                return pipeline.collect(len(latents))
            return super()._decode_all(latents)
        finally:
            if TTS_STAGE_PROFILE:
                counter = getattr(_STAGE_PROFILE_CONTEXT, "counter", None)
                if counter is not None:
                    counter["mimi_ms"] += (time.perf_counter() - started) * 1000

    def _stitch(self, segments):
        # Pocket's required internal FlowLM chunks are still synthesized
        # independently for bounded KV memory, but they are joined into ONE
        # complete WAV without inserting extra pause/silence at artificial
        # text, punctuation or chunk boundaries. Do not change the selected
        # speaker, latent frames, retry quality checks or sample rate.
        if UNBROKEN_SPEECH:
            segments = [(audio, 0.0) for audio, _gap in segments]
        return super()._stitch(segments)

    def synthesize_text(self, text, *args, **kwargs):
        started = time.monotonic()
        # The G2P encoder/decoder and the acoustic decoder do not need to
        # coexist. Railway caps this whole Node + Python service at 1 GB.
        # Unload the acoustic sessions BEFORE loading the Persian G2P models,
        # rather than waiting until their allocations have already overlapped.
        if not self.KEEP_ACOUSTIC and any("\u0600" <= char <= "\u06FF" for char in text):
            self.s_flow = None
            self.s_dec = None
            release_unused_memory()
        try:
            return super().synthesize_text(text, *args, **kwargs)
        finally:
            print("[FORZA voice profile] total_ms=%d resident=%s text_chars=%d" % (
                (time.monotonic() - started) * 1000, int(self.KEEP_ACOUSTIC), len(text)),
                file=sys.stderr, flush=True)
            if not self.KEEP_G2P and hasattr(self, "_g2p"):
                del self._g2p
                release_unused_memory()

    def synthesize(self, *args, **kwargs):
        started = time.monotonic()
        # synthesize_text has phonemised every sentence; release its ONNX
        # sessions BEFORE materialising the acoustic model's KV state.
        if not self.KEEP_G2P and hasattr(self, "_g2p"):
            del self._g2p
            release_unused_memory()
        if hasattr(self, "s_flow") and self.s_flow is None:
            import onnxruntime as ort
            options = ort.SessionOptions()
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            options.intra_op_num_threads = CPU_INTRA
            options.inter_op_num_threads = 1
            options.enable_cpu_mem_arena = False
            options.enable_mem_pattern = False
            self.s_flow = ort.InferenceSession(
                str(self.dir / ("flow_lm_step.int8.onnx" if os.environ.get("FORZA_ONNX_INT8") == "1" else "flow_lm_step.onnx")), options, providers=["CPUExecutionProvider"])
            self.s_dec = ort.InferenceSession(
                str(self.dir / "mimi_decoder_step_kv.onnx"), options, providers=["CPUExecutionProvider"])
        try:
            return super().synthesize(*args, **kwargs)
        finally:
            print("[FORZA voice profile] synthesis_ms=%d" % (
                (time.monotonic() - started) * 1000), file=sys.stderr, flush=True)



def continuous_persian_speech_text(text):
    """Remove punctuation-induced pauses ONLY in Pocket's spoken text.
    Protect the decimal dot in technical measurements and retain hyphenated
    industrial part codes (e.g. SPA-1250).
    """
    return " ".join(_FLOW_PUNCTUATION.sub(" ", _SENTENCE_DOT.sub(" ", text)).split())


def continuous_sentence_units(text, split_sentences):
    """Normalize the COMPLETE assistant reply before ANY punctuation splitting.

    The old flow split on '.' and '?' first and only then removed punctuation
    from each segment. That still forced sentence boundaries in the TTS plan,
    even with FORZA_TTS_UNBROKEN=1.
    """
    source = continuous_persian_speech_text(text) if UNBROKEN_SPEECH else text
    return split_sentences(source)


def render_full_answer_wav(engine, text):
    """Optional complete-answer one-frame WAV. RAM only, no inter-frame starvation.

    Waiting for the entire utterance has a latency cost on slow CPUs. Do NOT
    enable this until the full-answer CPU gate has passed for representative
    unseen Persian replies. Keep the default progressive mode.
    """
    output = io.BytesIO()
    total_pcm = 0
    frames = 0
    with wave.open(output, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(engine.sample_rate)
        for packet in render_chunks(engine, text):
            with wave.open(io.BytesIO(packet), "rb") as part:
                if part.getnchannels() != 1 or part.getsampwidth() != 2 or part.getframerate() != engine.sample_rate:
                    raise ValueError("forza_pcm_frame_mismatch")
                pcm = part.readframes(part.getnframes())
            total_pcm += len(pcm)
            if total_pcm + 44 > 8_000_000:
                raise ValueError("forza_full_audio_too_large")
            target.writeframesraw(pcm)
            frames += 1
    if not frames or total_pcm < 100:
        raise ValueError("forza_full_audio_empty")
    full_wav = output.getvalue()
    if len(full_wav) > 8_000_000:
        raise ValueError("forza_full_audio_too_large")
    return full_wav


def render_chunks(engine, text):
    """Generate independently voiced WAV frames in playback order.

    This is real server-side progressive synthesis, not splitting an already
    completed WAV. The full-text /speak route remains unchanged for fallback.
    The existing Pocket model, selected reference and quality retry are kept.
    """
    planning_started = time.monotonic()
    from concurrent.futures import ThreadPoolExecutor
    from tts_onnx import (
        split_sentences, plan_phrases, pack_phrases, _CHUNK_GAP,
        _PHRASE_GAP, SENTENCE_GAP,
    )
    from g2p_onnx import OnnxG2P

    if not engine.KEEP_ACOUSTIC:
        raise RuntimeError("progressive_stream_requires_resident_acoustic")
    if not any("\u0600" <= char <= "\u06FF" for char in text):
        # The public API primarily accepts Persian; phonemes still work.
        plans = [[(text, 0.0)]]
    else:
        if not hasattr(engine, "_g2p"):
            engine._g2p = OnnxG2P(engine.dir)
        plans = []
        # Normalize ONCE before splitting so periods, commas and question
        # marks cannot introduce artificial sentence boundaries or pauses.
        # split_sentences still bounds very long input independent of marks.
        for sentence in continuous_sentence_units(text, split_sentences):
            if not sentence:
                continue
            plan = pack_phrases(plan_phrases(sentence, engine._g2p, engine.sp))
            if plan:
                plans.append(plan)

    jobs = []
    for sentence_index, plan in enumerate(plans):
        for phrase_index, (phonemes, phrase_gap) in enumerate(plan):
            # Only the first planned phrase gets the experimental shorter
            # chunk budget (not the entire reply); all subsequent phrases
            # remain at 18 tokens. This is opt-in and may affect prosody.
            # chunk_phonemes uses Pocket's own Persian-boundary safeguards
            # (ezafe, prepositions and bound verb groups), never raw
            # character splitting. Default 0 preserves existing behavior.
            target = STREAM_FIRST_TOKENS if not jobs and STREAM_FIRST_TOKENS else 18
            chunks = engine.chunk_phonemes(phonemes, max_tokens=target)
            for chunk_index, chunk in enumerate(chunks):
                if not jobs:
                    gap = 0.0
                elif phrase_index == 0 and chunk_index == 0:
                    gap = SENTENCE_GAP
                elif chunk_index == 0:
                    gap = phrase_gap if phrase_gap is not None else _PHRASE_GAP
                else:
                    gap = _CHUNK_GAP
                jobs.append((chunk, 0.0 if UNBROKEN_SPEECH else gap))
    if not jobs:
        raise ValueError("empty_phoneme_plan")
    # One full answer may require many short acoustic units; only two
    # units are ever rendered ahead, so job metadata remains small in RAM.
    if len(jobs) > 256:
        raise ValueError("too_many_speech_chunks")
    print("[FORZA voice stream plan] ms=%d jobs=%d first_tokens=%d parallel=%d unbroken=%d first_frame_priority=%d" % (
        (time.monotonic() - planning_started) * 1000, len(jobs),
        STREAM_FIRST_TOKENS, PARALLEL_CHUNKS, int(UNBROKEN_SPEECH),
        int(FIRST_FRAME_PRIORITY)), file=sys.stderr, flush=True)

    # Release the sizeable ONNX G2P graphs before acoustic inference, as in
    # the existing full-WAV path. Avoid overlapping their RAM on 1.5 GiB.
    if not engine.KEEP_G2P and hasattr(engine, "_g2p"):
        del engine._g2p
        release_unused_memory()
    voice_cache, voice_offset = engine.voice_cache(str(REFERENCE))
    if TTS_TEST_SEED is None:
        seeds = engine.rng.integers(0, 2**63, size=len(jobs))
    else:
        # SeedSequence is stable for identical (seed, chunk index) pairs.
        # Keep each worker's RNG independent of execution/scheduling order.
        seeds = [int(np.random.SeedSequence([TTS_TEST_SEED, i])
                     .generate_state(1, dtype=np.uint64)[0])
                 for i in range(len(jobs))]
        print("[FORZA voice deterministic] test_seed=%d jobs=%d" %
              (TTS_TEST_SEED, len(jobs)), file=sys.stderr, flush=True)

    def generate(index):
        phonemes, gap = jobs[index]
        synthesis_started = time.monotonic()
        # A measured opt-in retry budget; skipping quality recovery can
        # silently omit words, so only use in isolated A/B with listening.
        # Each synthesis job is a separate thread. Thread-local instrumentation
        # avoids corrupting shared ONNX sessions or counting other requests.
        counter = {
            "attempt_count": 0,
            "flow_total_ms": 0.0,
            "flow_step_ms": 0.0,
            "flow_step_count": 0,
            "mimi_ms": 0.0,
        } if TTS_STAGE_PROFILE else None
        if counter is not None:
            _STAGE_PROFILE_CONTEXT.counter = counter
        try:
            speech = engine._generate_with_retry(
                voice_cache, voice_offset, phonemes,
                attempts=TTS_ATTEMPTS,
                rng=np.random.default_rng(int(seeds[index])),
            )
        finally:
            if counter is not None:
                _STAGE_PROFILE_CONTEXT.counter = None
        synthesis_ms = int((time.monotonic() - synthesis_started) * 1000)
        if counter is not None:
            print("[FORZA voice CPU stages] job=%d attempts_actual=%d flow_ms=%d flow_steps=%d flow_onnx_ms=%d mimi_ms=%d overhead_ms=%d overlap=%d" % (
                index + 1, counter["attempt_count"],
                int(counter["flow_total_ms"]), counter["flow_step_count"],
                int(counter["flow_step_ms"]), int(counter["mimi_ms"]),
                int(max(0.0, synthesis_ms - counter["flow_total_ms"] - counter["mimi_ms"])),
                int(TTS_OVERLAP_MIMI)),
                file=sys.stderr, flush=True)
        # Chunk-local declick fades and explicit breathing gaps; unlike
        # /speak this cannot calculate median loudness across future chunks.
        audio = engine._stitch([(speech, gap)])
        # Pocket can synthesize silence inside an acoustic chunk, unrelated
        # to punctuation or our zero-gap stitching. Tighten long *detected*
        # dead-air regions only in opt-in unbroken mode; do not speed up,
        # cut, or omit spoken words.
        if UNBROKEN_SPEECH:
            audio = engine._compress_pauses(audio, max_pause=0.16, keep=0.035)
        if not len(audio):
            raise RuntimeError("empty_audio_chunk")
        stream = io.BytesIO()
        sf.write(stream, audio, engine.sample_rate, format="WAV", subtype="PCM_16")
        wav = stream.getvalue()
        print("[FORZA voice stream profile] job=%d tokens=%d synthesis_ms=%d audio_ms=%d wav_bytes=%d retry_budget=%d" % (
            index + 1, len(engine.sp.encode(phonemes, out_type=int)),
            synthesis_ms, int(len(audio) * 1000 / engine.sample_rate), len(wav),
            TTS_ATTEMPTS),
            file=sys.stderr, flush=True)
        if not (44 <= len(wav) <= 5_000_000):
            raise RuntimeError("invalid_wav_chunk")
        return wav

    # A full-text request can contain hundreds of chunks. Executor.map()
    # eagerly submits every task and retains completed WAVs in Futures,
    # creating unnecessary RAM pressure on the 2-GiB VPS. Keep at most
    # PARALLEL_CHUNKS jobs in flight and yield every frame in text order.
    with ThreadPoolExecutor(max_workers=PARALLEL_CHUNKS) as pool:
        pending = []
        next_job = 0
        if FIRST_FRAME_PRIORITY:
            # With only 2 vCPU available to Pocket, overlapping a second
            # FlowLM/Mimi inference can starve the FIRST frame. Do not start
            # any other acoustic generation until the first frame exists.
            # The worker HTTP handler sends this yield immediately as the
            # first playable WAV; further jobs are submitted on resume.
            first_started = time.monotonic()
            wav = pool.submit(generate, 0).result()
            print("[FORZA voice first-frame-priority] first_job_ms=%d first_tokens=%d" % (
                (time.monotonic() - first_started) * 1000,
                len(engine.sp.encode(jobs[0][0], out_type=int))),
                file=sys.stderr, flush=True)
            next_job = 1
            yield wav
        for _ in range(min(PARALLEL_CHUNKS, len(jobs) - next_job)):
            pending.append(pool.submit(generate, next_job))
            next_job += 1
        while pending:
            future = pending.pop(0)
            wav = future.result()
            if next_job < len(jobs):
                pending.append(pool.submit(generate, next_job))
                next_job += 1
            yield wav

def main():
    if not REFERENCE.is_file():
        raise RuntimeError("missing_pocket_voice_reference")
    building = "--greeting" in sys.argv
    if not building:
        if not VOICE_STATE.is_file():
            raise RuntimeError("missing_precomputed_voice_state")
        os.environ["FORZA_POCKET_PRECOMPUTED_VOICE"] = "1"
    engine = MemoryBoundTts()
    engine.VOICE_MEMO_MAX = 1
    if building:
        # Persist only this selected voice's conditioning; never user speech.
        with contextlib.redirect_stdout(sys.stderr):
            cache, offset = engine.voice_cache(str(REFERENCE))
        np.savez(VOICE_STATE, cache=cache, offset=np.array(offset))
        GREETING.write_bytes(render(engine, WELCOME))
        print("Pocket FORZA greeting generated:", GREETING.stat().st_size, file=sys.stderr)
        return
    with np.load(VOICE_STATE, allow_pickle=False) as state:
        key = (str(REFERENCE.resolve()), REFERENCE.stat().st_mtime)
        engine._voice_memo[key] = (state["cache"], int(state["offset"]))
    # G2P is loaded on demand and released before waveform generation.
    emit({"type": "ready", "model": "pocket-tts-farsi-v2-onnx"})
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            rid = request.get("id")
            phrase = request.get("text")
            if not isinstance(phrase, str) or not phrase.strip() or len(phrase) > 220:
                emit({"id": rid, "error": "invalid_text"})
                continue
            wav = render(engine, phrase.strip())
            emit({"id": rid, "audio": base64.b64encode(wav).decode("ascii")})
            del wav
            release_unused_memory()
        except Exception as exc:
            print("[FORZA Pocket] synthesis error:", repr(exc)[:240], file=sys.stderr)
            emit({"id": request.get("id") if isinstance(request, dict) else None, "error": "synthesis_failed"})


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("[FORZA Pocket] worker failed:", repr(exc)[:300], file=sys.stderr)
        sys.exit(1)
