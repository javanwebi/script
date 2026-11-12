#!/usr/bin/env python3
"""Offline fail-closed checks for own-weight Pocket INT4 conversion."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
src=ROOT/"scripts/forza_quantize_original_flow_int4.py"
spec=importlib.util.spec_from_file_location("forza_quantize_original_flow_int4",src)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class OriginalPocketInt4GuardTest(unittest.TestCase):
    def test_missing_original_flow_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(RuntimeError,"original_pocket_flow_graph_missing"):
                mod.quantize_original_flow(Path(d))
    def test_invalid_block_size_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,"invalid_int4_block_size"):
                mod.quantize_original_flow(Path(d),33)
    def test_original_weight_files_never_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            graph=p/"flow_lm_step.onnx"
            data=p/"flow_lm_step.onnx.data"
            dest=p/"flow_lm_step.int4.onnx"
            graph.write_bytes(b"a"*150000)
            data.write_bytes(b"b"*1100000)
            dest.write_bytes(b"already_present")
            with self.assertRaisesRegex(RuntimeError,"refusing_to_overwrite_int4_candidate"):
                mod.quantize_original_flow(p)
            self.assertEqual(dest.read_bytes(),b"already_present")
            self.assertEqual(data.stat().st_size,1100000)
    def test_original_speaker_and_live_services_untouched(self):
        shell=(ROOT/"ops/forza-pocket-int4-original-cpu-vps.sh").read_text()
        self.assertIn("FORZA_ONNX_INT4=$QUANT",shell)
        self.assertIn("FORZA_TTS_TEST_SEED=12345",shell)
        self.assertIn("FORZA_TTS_OVERLAP_MIMI=1",shell)
        self.assertIn("FORZA_INT4_RESULT",shell)
        self.assertIn("wav_sha256=",shell)
        self.assertIn("31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",shell)
        self.assertIn("DOCKER\nFLOAT_IMAGE=",shell)
        for forbidden in ('docker stop "$LIVE"','docker restart "$LIVE"',
                          'docker rm -f "$LIVE"','docker restart "$SITE"',
                          'docker system prune','docker volume rm'):
            self.assertNotIn(forbidden,shell)
        quant=src.read_text()
        self.assertIn('op_types_to_quantize=("MatMul",)',quant)
        self.assertIn('flow_lm_step.int4.onnx',quant)
        self.assertIn('MatMulNBits',quant)
        self.assertIn('shape_inference=skipped',quant)

if __name__=="__main__":
    unittest.main()
