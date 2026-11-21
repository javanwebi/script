import base64
import importlib.util
import json
import unittest
from pathlib import Path

WORKER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "forza_diba_live_worker.py"
SPEC = importlib.util.spec_from_file_location("forza_diba_live_worker", WORKER_PATH)
WORKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKER)


class FakeRecognizer:
    def __init__(self, model, sample_rate):
        self.model = model
        self.sample_rate = sample_rate
        self.ended = False
        self.finalized = False

    def SetWords(self, enabled):
        self.words = enabled

    def AcceptWaveform(self, pcm):
        self.finalized = pcm.startswith(b"\xff\xff")
        return self.finalized

    def PartialResult(self):
        return json.dumps({"partial": "" if self.finalized else "سلام"})

    def Result(self):
        return json.dumps({"text": "سلام وقت بخیر"})

    def FinalResult(self):
        return json.dumps({"text": "ادامه گفتار"})



class FakeEmptyFinalRecognizer(FakeRecognizer):
    def Result(self):
        return json.dumps({"text": ""})


class ForzaDibaLiveWorkerTests(unittest.TestCase):
    def setUp(self):
        self.model = object()
        self.streams = {}

    def test_start_audio_partial_and_final_are_multiplexed_by_stream_id(self):
        started = WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeRecognizer)
        self.assertEqual(started[0]["type"], "started")
        self.assertIn("customer-a", self.streams)

        pcm = b"\x01\x00" * 1600
        partial = WORKER.process_command(self.model, self.streams,
            {"type": "audio", "streamId": "customer-a",
             "pcmBase64": base64.b64encode(pcm).decode("ascii")}, FakeRecognizer)
        self.assertEqual(partial, [{"type": "partial", "streamId": "customer-a", "text": "سلام"}])

        endpoint_pcm = b"\xff\xff" + b"\x00\x00" * 1599
        final = WORKER.process_command(self.model, self.streams,
            {"type": "audio", "streamId": "customer-a",
             "pcmBase64": base64.b64encode(endpoint_pcm).decode("ascii")}, FakeRecognizer)
        self.assertEqual(final[0]["type"], "final")
        self.assertEqual(final[0]["text"], "سلام وقت بخیر")
        self.assertEqual(len(final), 1)


    def test_empty_final_is_emitted_as_a_result_boundary(self):
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeEmptyFinalRecognizer)
        endpoint_pcm = b"\\xff\\xff" + b"\\x00\\x00" * 1599
        result = WORKER.process_command(self.model, self.streams,
            {"type": "audio", "streamId": "customer-a",
             "pcmBase64": base64.b64encode(endpoint_pcm).decode("ascii")}, FakeEmptyFinalRecognizer)
        self.assertEqual(result, [{"type": "final", "streamId": "customer-a", "text": ""}])

    def test_streams_keep_independent_recognizers(self):
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeRecognizer)
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-b"}, FakeRecognizer)
        self.assertEqual(set(self.streams), {"customer-a", "customer-b"})
        self.assertIsNot(self.streams["customer-a"], self.streams["customer-b"])

    def test_end_flushes_final_text_and_releases_session(self):
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeRecognizer)
        result = WORKER.process_command(self.model, self.streams,
            {"type": "end", "streamId": "customer-a"}, FakeRecognizer)
        self.assertEqual(result[0]["text"], "ادامه گفتار")
        self.assertEqual(result[1]["type"], "ended")
        self.assertNotIn("customer-a", self.streams)

    def test_cancel_discards_session_without_returning_audio_or_text(self):
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeRecognizer)
        result = WORKER.process_command(self.model, self.streams,
            {"type": "cancel", "streamId": "customer-a"}, FakeRecognizer)
        self.assertEqual(result, [{"type": "ended", "streamId": "customer-a"}])
        self.assertNotIn("customer-a", self.streams)

    def test_invalid_or_oversized_pcm_is_rejected(self):
        WORKER.process_command(self.model, self.streams,
            {"type": "start", "streamId": "customer-a"}, FakeRecognizer)
        invalid = WORKER.process_command(self.model, self.streams,
            {"type": "audio", "streamId": "customer-a", "pcmBase64": "%%%"},
            FakeRecognizer)
        self.assertEqual(invalid[0]["code"], "invalid_pcm_chunk")
        odd = base64.b64encode(b"\x01").decode("ascii")
        invalid_odd = WORKER.process_command(self.model, self.streams,
            {"type": "audio", "streamId": "customer-a", "pcmBase64": odd},
            FakeRecognizer)
        self.assertEqual(invalid_odd[0]["code"], "invalid_pcm_chunk")


if __name__ == "__main__":
    unittest.main()
