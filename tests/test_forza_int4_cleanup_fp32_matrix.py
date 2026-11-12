#!/usr/bin/env python3
"""Verify failed INT4 artifacts can be cleaned safely and FP32 stays exact."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
CLEAN=(ROOT/"ops/forza-remove-failed-int4-vps.sh").read_text()
MATRIX=(ROOT/"ops/forza-pocket-fp32-onnx-memory-matrix-vps.sh").read_text()
SHA="31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833"


class FastVoiceRevertSafetyTest(unittest.TestCase):
    def test_cleanup_never_removes_selected_voice_or_other_images(self):
        self.assertIn(SHA,CLEAN)
        self.assertIn("forza-original-int4:float-*",CLEAN)
        self.assertIn("forza-original-int4:int4-*",CLEAN)
        self.assertIn("docker image rm",CLEAN)
        self.assertIn("shared_buildkit_cache_not_pruned=1",CLEAN)
        self.assertIn('docker ps -aq --filter "ancestor=$tag"',CLEAN)
        self.assertIn("FORZA_INT4_CLEAN_DONE",CLEAN)
        self.assertIn("docker container rm",CLEAN)
        for marker in ('docker system prune','docker builder prune','docker buildx prune',
                       'docker volume rm','docker rm -f "$VOICE"',
                       'docker stop "$VOICE"','docker restart "$VOICE"',
                       'docker rm -f "$SITE"','docker restart "$SITE"',
                       'rm -rf /opt/sanatpish'):
            self.assertNotIn(marker,CLEAN)
    def test_matrix_runs_same_fp32_weights_and_wav_identity_check(self):
        self.assertIn(SHA,MATRIX)
        self.assertIn("FORZA_GATE_OVERLAP_MIMI=1",MATRIX)
        self.assertIn("FORZA_GATE_CPU_INTRA=1",MATRIX)
        self.assertIn("FORZA_GATE_EOS_SHORT=5",MATRIX)
        self.assertIn("FORZA_GATE_FIXED_SEED=12345",MATRIX)
        self.assertIn("FORZA_GATE_CPU_ARENA=",MATRIX)
        self.assertIn("FORZA_GATE_CPU_PATTERN=",MATRIX)
        self.assertIn('if [ "$reference_hash" != "$hash" ]; then',MATRIX)
        self.assertIn("FORZA_FP32_UNDER_ONE_SECOND_NOT_MET",MATRIX)
        self.assertIn("do_not_claim_subsecond",MATRIX)
        self.assertNotIn("FORZA_ONNX_INT4",MATRIX)
        self.assertNotIn("FORZA_ONNX_INT8",MATRIX)
        for marker in ('docker restart','docker stop','docker system prune',
                       'docker volume rm','docker run --rm --privileged'):
            self.assertNotIn(marker,MATRIX)


if __name__=="__main__":
    unittest.main()
