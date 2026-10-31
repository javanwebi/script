#!/usr/bin/env python3
"""Conservative full-answer original-Pocket no-audio-disk canary safeguards.

No heavy model needed for static regression checks. VPS timing and listening
remain required before any swap from the existing live voice worker.
"""
import ast
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
HTTP=(ROOT/"scripts/forza_voice_http.py").read_text()
WORKER=(ROOT/"scripts/forza_pocket_worker.py").read_text()
SCRIPT=(ROOT/"ops/forza-pocket-single-wav-cpu-canary-vps.sh").read_text()

class FullWavCanaryTest(unittest.TestCase):
    def test_private_full_wav_is_opt_in_and_one_response(self):
        self.assertIn('FULL_ANSWER_WAV = os.environ.get("FORZA_TTS_FULL_ANSWER_WAV", "0") == "1"',HTTP)
        self.assertIn('if FULL_ANSWER_WAV else render(engine, phrase)',HTTP)
        self.assertIn('self.reply(200, audio, "audio/wav")',HTTP)
        self.assertIn('render_full_answer_wav(engine, phrase)',HTTP)
        self.assertIn('X-Forza-Voice-Token',HTTP)
        self.assertIn('self.path not in ("/speak", "/speak-stream")',HTTP)
        self.assertNotIn('audio_cache',HTTP)
    def test_exact_same_voice_resident_pocket_keeps_retry_three(self):
        self.assertIn('31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833',SCRIPT)
        self.assertIn('forza_voice_state.npz',SCRIPT)
        self.assertIn('FORZA_TTS_RESIDENT_G2P=1',SCRIPT)
        self.assertIn('FORZA_TTS_RESIDENT_ACOUSTIC=1',SCRIPT)
        self.assertIn('FORZA_TTS_UNBROKEN=1',SCRIPT)
        self.assertIn('FORZA_TTS_RETRY_ATTEMPTS=3',SCRIPT)
        self.assertIn('FORZA_TTS_FULL_ANSWER_WAV=1',SCRIPT)
        self.assertIn('FORZA_TTS_STAGE_PROFILE=1',SCRIPT)
        self.assertIn('FORZA_TTS_PARALLEL_CHUNKS=2',SCRIPT)
        self.assertIn('FORZA_CPU_INTRA=1',SCRIPT)
        self.assertIn("segments = [(audio, 0.0) for audio, _gap in segments]",WORKER)
        self.assertIn('def render_full_answer_wav(engine, text):',WORKER)
        self.assertIn('KEEP_G2P = os.environ.get(',WORKER)
        self.assertIn('KEEP_ACOUSTIC = os.environ.get(',WORKER)
    def test_no_live_mutation_no_customer_audio_storage(self):
        for forbidden in (
            'docker stop "$LIVE"','docker restart "$LIVE"',
            'docker rm -f "$LIVE"','docker rename "$LIVE"',
            'docker stop "$SITE"','docker restart "$SITE"',
            'docker system prune','docker volume rm',
            'wave.open("','writeFileSync('
        ):
            self.assertNotIn(forbidden,SCRIPT)
        self.assertIn('docker rm -f "$CANDIDATE"',SCRIPT)
        self.assertIn('trap cleanup EXIT',SCRIPT)
        self.assertIn('no_audio_disk=1',SCRIPT)
        self.assertIn('no_audio_disk',SCRIPT)
        self.assertIn('FORZA_FULLWAV_RESULT',SCRIPT)
        self.assertIn('FORZA_FULLWAV_COMPARE',SCRIPT)
        self.assertIn('FORZA_FULLWAV_CANARY_PEAK_BYTES',SCRIPT)
        self.assertIn('FORZA_FULLWAV_CANARY_CURRENT_BYTES',SCRIPT)
        self.assertIn('FORZA_FULLWAV_CANARY_MEMORY_GATE=inconclusive',SCRIPT)
        self.assertIn('FORZA_FULLWAV_CANARY_MEMORY_GATE=passed',SCRIPT)
        self.assertIn('Candidate current RAM exceeded 1.9GB',SCRIPT)
        self.assertNotIn('test "$PEAK" -gt 0',SCRIPT)
    def test_worker_sources_parse_and_never_change_model_parameters(self):
        ast.parse(HTTP)
        ast.parse(WORKER)
        self.assertNotIn("FORZA_ONNX_INT8=1",SCRIPT)
        self.assertNotIn("FORZA_TTS_RETRY_ATTEMPTS=1",SCRIPT)

if __name__=="__main__":
    unittest.main()
