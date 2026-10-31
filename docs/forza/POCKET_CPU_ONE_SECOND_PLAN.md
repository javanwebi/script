# FORZA — Pocket Farsi v2: CPU-only one-second feasibility gate

## Desired result (hard acceptance, not a marketing claim)

- Exact Pocket Farsi v2 reference, with SHA-256 `31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833`. Never substitute Amir or a different model/voice.
- Unique **complete** Persian answer is accepted in one request. Measure from request arrival until the **entire PCM WAV** has been generated and made ready to send.
- **Hard target: <=1,000 ms** total TTS for a representative ~6–10-second output, not merely the first packet. Track TTFA separately (preferred <500ms), RTF, pause/underflow estimate, PESQ/ASR-style intelligibility checks, RAM and CPU.
- No user-generated WAV/PCM/transcripts on disk or persistent cache. Precomputed fixed voice conditioning and greeting are allowed only if already part of the shipped model; customer responses are RAM-only.
- All original FORZA catalog, STT, AI text, Nginx and Supabase behavior stays unchanged.
- No rollout until controlled audio A/B validation and 10-user load tests.

## Verified baseline on this actual VPS, as reported by owner

| Profile | Result |
|---|---|
| Pocket same voice, two 2-vCPU threads/chunks, punctuation off | first audio 16.126s; full generation 24.196s; 6.57s WAV; RTF 3.683; frame playback underrun estimated 5.41s |
| Earlier Pocket 1/2 worker alternatives | still roughly 13–19s first audio; none achieved no-undersupply live on old Xeon |
| Dynamic quantization, ONNX FlowLM | conversion failed on incompatible shape inference; **no usable INT8 measurement**; not a promising assumption on pre-AVX2 Xeon |
| Piper Amir canary on same VPS | 3.255s for 9.71s WAV; RTF 0.335, but user does not like its voice. This does not represent Pocket speed. |

**Arithmetic:** the tested 6.57 seconds of Pocket speech must move from 24.196 seconds to <=1s, requiring >=24.2x throughput speedup in whole-request latency (RTF <=0.152). This is **not currently demonstrated**. A goal of "0ms delay" is physically impossible for uncached, dynamic audio due to inference, transport, and output buffering. A strict 1,000ms cap must fail honestly if unmet.

## Actual source-level bottlenecks (upstream pinned commit `e834bd65ac622f376c4d2050821decf5eb95241c`)

1. Persian phonemization: `g2p_onnx.py::OnnxG2P._decode_greedy` repeatedly re-runs the decoder over the **full prefix** of previously emitted tokens, without KV caching. This is quadratic in token length. Prior streaming log: phoneme plan ~5.806s for the medium request.
2. Acoustic: `tts_onnx.py::_generate_chunk` calls `_flow_step` **sequentially per frame**; `_flow_step` runs `flow_lm_step.onnx` with 340MB external weights and KV cache inputs; then `_decode_all` iterates Mimi decoder. Neither can be parallelized naively along the time axis without changing model behavior.
3. `_generate_with_retry` can perform up to 3 entire syntheses on quality failures, significantly increasing tail latency. Disabling these retries without validating speech risks truncated or silent answers.
4. ONNX CPU thread count: existing tested `intra=1`, `intra=2`, `parallel=1`/2 and first-token sizes do not suffice; old Xeon lacks AVX2/VNNI; generic INT8 is not a guaranteed acceleration.
5. Network frame transfer is not bottleneck: the existing Node+browser transport already supports streaming and gapless sample scheduling; source acoustic compute is the main limiter.

## Implementation order / stop gates

### Gate 0 — Reproduce Pocket while Amir stays live
Run `ops/forza-pocket-cpu-gate-after-amir-vps.sh` **from the original stopped Pocket backup image** in a separate disposable private Docker container: no current voice switchover, no WAV writes. Measure 3 lengths, 1 request each and verify exact voice+precomputed state hashes. Record per-chunk G2P planning wall time, first packet, entire generation, RTF, RAM peak, inter-frame underflow.

### Gate 1 — Isolate and remove redundant phoneme computations
- Create G2P memo **in memory only** keyed by normalized technical/industrial phrase, bounded and expiring, without saving customer-specific phrases. Prefer persisting only a reviewed static dictionary of public terms (if ever enabled).
- A/B prototype a true KV-cached G2P decoder only if it reproduces the same phonemes on a test corpus and can convert the existing G2P ONNX weights.
- Gate: for sample medium input, G2P <=250ms for an unseen unique phrase. Count G2P quality errors; no fake SKU or changed technical measurements.
- Do not claim that speeding G2P alone meets <=1s when acoustic dominates.

### Gate 2 — On-device acoustic operator breakdown (mandatory before invasive work)
- Isolated ORT profiling on `flow_lm_step.onnx` and `mimi_decoder_step_kv.onnx` plus per-stage wall time in `_generate_chunk` and `_decode_all`. Keep profiling outside live worker; ORT profiling writes diagnostic traces, **not customer WAVs**; if strict no-disk applies to any customer-derived trace, only benchmark fixed public synthetic sentences, and remove trace files immediately.
- Compare session options `intra=1/2`, CPU arena/memory-pattern, `ORT_ENABLE_ALL`, runtime build with tuned compiler, idle spin policy, while enforcing 2 vCPU/2 GiB budget.
- Gate: find a reproducible source of >2x acoustic speedup before undertaking risky engine conversion. Stop/rollback if quality, CPU, or RAM worsens.

### Gate 3 — Model-preserving execution optimization
- Investigate fused FlowLM steps, I/O binding to avoid redundant KV cache movement, speech frame decoding pipelined with next FlowLM step; phase separately against baseline. Never assume parallel generated chunks give 1s total when a single sample's inference is already >seconds.
- Investigate a compatible **newer runtime/export** only if weights and voice fingerprint remain identical. Verify exact Persian prosody, numbers, decimals, industrial codes, chunk quality and final sentence not cut.
- Fix dynamic INT8 attempt only if shape inference can be proven correct; test on AVX-only Xeon, measure speed (could be slower), and never silently promote quantized weights.
- Gate: full medium ~6–10 seconds of voice <=1,000ms on this VPS, p95 over >=10 different unique Persian responses, 0 playback underruns, no compromised intelligibility. A single cached response does not pass.

### Gate 4 — Capacity and production
- Test 1, 2, 5, 10 simultaneous *active* TTS requests, realistic full answers, p50/p95 first-audio and completion, OOM and memory growth, plus STT/call interruption and browser playback.
- Canary behind a feature flag, no changes to active Amir unless ALL gates are passed. Retain Amir and Pocket rollback containers/images.
- Fail-fast rule: if a phase cannot demonstrate the required CPU improvement, explicitly report the remaining physical bottleneck and that the one-second goal is not achievable under the current combination of model+hardware+full-answer contract. Do not promise results by changing buffering or removing punctuation.

## Why the benchmark runs against Pocket backup, not `forza-voice`

Since the user successfully promoted Amir in revision `d8d2e8578b63220a5acde5216924236b0bb3cb86`, the active `forza-voice` container is **not Pocket**. Earlier benchmark scripts which `docker inspect forza-voice` as parent would inspect the wrong engine and fail. Always locate the stopped original Pocket backup from `/etc/sanatpish/forza-amir-rollback-container`, validate the selected reference SHA-256, and run all Pocket experiments from that immutable image without touching the running Amir service.
