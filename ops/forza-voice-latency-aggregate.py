#!/usr/bin/env python3
"""Read-only FORZA latency aggregation: accepts mixed browser/Node/Nima logs.

No network, files, credentials, transcripts or audio are read or retained.
The only printed fields are sample counts, milliseconds and error categories.
Browser console timestamps and server monotonic clocks are never subtracted
across processes; compare their *separate* stages only.
"""
from __future__ import annotations
import re
import statistics
import sys
from collections import Counter, defaultdict

FIELDS = {
    "llm_first_text_node": (r"\[FORZA_TEXT_STAGE\].*phase=node_first_delta\b.*?\bms=(\d+)", 120_000),
    "llm_free_catalog": (r"\[FORZA_TEXT_STAGE\].*phase=free_catalog_ready\b.*?\bms=(\d+)", 120_000),
    "llm_ttft_upstream": (r"\[FORZA_TEXT_STREAM\].*?\bfirst_ms=(\d+)", 120_000),
    "tts_node_complete": (r"\[FORZA_TTS_STAGE\].*phase=server_responded\b.*?\btotalMs=(\d+)", 120_000),
    "tts_order_wait": (r"\[FORZA_TTS_STAGE\].*phase=server_responded\b.*?\borderWaitMs=(\d+)", 120_000),
    "tts_worker_queue": (r"\[FORZA_NIMA_PRODUCTION\].*?\bqueue_ms=(\d+)", 120_000),
    "tts_worker_inference": (r"\[FORZA_NIMA_PRODUCTION\].*?\binference_ms=(\d+)", 120_000),
    "browser_decode": (r"\[FORZA_AUDIO_STAGE\].*phase=decode_ready\b.*?\bms=(\d+)", 30_000),
    "browser_end_to_audio_clock": (r"\[FORZA_END_TO_AUDIO\].*?\bms=(\d+)", 120_000),
    "browser_stt_final_from_estimated_end": (r"\[FORZA_STT_STAGE\].*phase=final_from_estimated_speech_end\b.*?\bms=(\d+)", 120_000),
    "browser_sse_first_token": (r"\[FORZA_TEXT_STAGE\].*phase=browser_first_delta\b.*?\bclientMs=(\d+)", 120_000),
    "browser_barge_validated_to_software_cancel": (r"\[FORZA_BARGE_IN\].*phase=validated_text_to_cancel\b.*?\bms=(\d+)", 30_000),
}
PATTERNS = {key: (re.compile(regex), limit) for key, (regex, limit) in FIELDS.items()}
REASONS = re.compile(r"(?:\[FORZA_END_TO_AUDIO\]|\[FORZA_STT_STAGE\]).*?missing=1.*?reason=([a-z0-9_]+)|\[FORZA_STT_STAGE\].*?phase=latency_missing\s+reason=([a-z0-9_]+)")
FAILURE = re.compile(r"\[FORZA_TTS_STAGE\].*?phase=failed\b|\[FORZA_NIMA_REJECT\]|\[FORZA_TEXT_STAGE\].*?phase=failed_no_chained_model_retry")
CANCEL = re.compile(r"\[FORZA_TURN\].*?phase=cancelled\b|\[FORZA_TTS_STAGE\].*?phase=failed\b.*?code=cancelled\b")

def summarize(label: str, values: list[int]) -> str:
    if not values:
        return f"{label} n=0 medianMs=NA p95Ms=NA minMs=NA maxMs=NA"
    ranked = sorted(values)
    return (f"{label} n={len(ranked)} medianMs={round(statistics.median(ranked))}"
            f" p95Ms={ranked[max(0, (95*len(ranked)+99)//100-1)]}"
            f" minMs={ranked[0]} maxMs={ranked[-1]}")

def aggregate(lines: list[str]) -> str:
    samples = defaultdict(list)
    reason_counts: Counter[str] = Counter()
    failures = cancellations = 0
    for line in lines:
        for key, (pattern, limit) in PATTERNS.items():
            match = pattern.search(line)
            if match:
                n = int(match.group(1))
                if 0 <= n <= limit:
                    samples[key].append(n)
                else:
                    reason_counts["invalid_"+key] += 1
        reason = REASONS.search(line)
        if reason:
            reason_counts[reason.group(1) or reason.group(2)] += 1
        if FAILURE.search(line):
            failures += 1
        if CANCEL.search(line):
            cancellations += 1
    output = ["FORZA_READONLY_LATENCY_REPORT", "browser_end_to_audio_clock_is_not_verified_speaker_audibility=1"]
    for label in FIELDS:
        output.append(summarize(label, samples[label]))
    output.append(f"failures_observed={failures} cancellations_observed={cancellations}")
    for reason, count in sorted(reason_counts.items()):
        output.append(f"missing_reason={reason} count={count}")
    output.append("empty_metrics_are_unknown_not_zero=1")
    return "\n".join(output)

if __name__ == "__main__":
    print(aggregate(list(sys.stdin)))
