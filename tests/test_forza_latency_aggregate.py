import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
aggregate = runpy.run_path(str(ROOT / "ops/forza-voice-latency-aggregate.py"))["aggregate"]

class ForzaLatencyReportTests(unittest.TestCase):
    def test_mixed_stage_percentiles_and_missing_reasons(self):
        report=aggregate([
            "[FORZA_END_TO_AUDIO] turn=1 ms=1500 n=1\n",
            "[FORZA_END_TO_AUDIO] turn=2 ms=2400 n=2\n",
            "[FORZA_END_TO_AUDIO] turn=3 missing=1 reason=no_acoustic_end_estimate\n",
            "[FORZA_TTS_STAGE] phase=server_responded turn=t totalMs=3000 index=0 orderWaitMs=20 upstreamMs=3100 queueMs=20 inferenceMs=2000 wavBytes=400\n",
            "[FORZA_NIMA_PRODUCTION] queue_ms=30 inference_ms=1800 wav_bytes=800 chars=30\n",
            "[FORZA_TTS_STAGE] phase=failed code=cancelled\n",
            "[FORZA_TEXT_STAGE] turn=1 phase=node_first_delta ms=670 chars=15\n",
            "[FORZA_BARGE_IN] source=browser_stt phase=validated_text_to_cancel ms=45 audioClockOnly=1\n",
        ])
        self.assertIn("browser_end_to_audio_clock n=2 medianMs=1950 p95Ms=2400",report)
        self.assertIn("tts_order_wait n=1 medianMs=20",report)
        self.assertIn("llm_first_text_node n=1 medianMs=670",report)
        self.assertIn("browser_barge_validated_to_software_cancel n=1 medianMs=45",report)
        self.assertIn("missing_reason=no_acoustic_end_estimate count=1",report)
        self.assertIn("failures_observed=1 cancellations_observed=1",report)

    def test_no_samples_never_claim_fast_speech(self):
        report=aggregate(["[FORZA_END_TO_AUDIO] turn=1 ms=-1\n"])
        self.assertIn("browser_end_to_audio_clock n=0 medianMs=NA",report)
        self.assertIn("empty_metrics_are_unknown_not_zero=1",report)

    def test_report_never_reemits_private_text(self):
        report=aggregate(["secret-token=PRIVATE متن=سلام 6202ZZ\n"])
        self.assertNotIn("PRIVATE",report)
        self.assertNotIn("6202ZZ",report)

if __name__ == "__main__":
    unittest.main()
