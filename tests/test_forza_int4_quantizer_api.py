#!/usr/bin/env python3
"""Regression tests for the missing ONNX Runtime 4-bit quantizer API on VPS."""
import importlib.util
from pathlib import Path
import types
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"scripts/forza_quantize_original_flow_int4.py"
SPEC=importlib.util.spec_from_file_location("forza_int4_api_test",SRC)
MOD=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)

class Int4QuantizerApiTest(unittest.TestCase):
    def test_new_nbits_quantizer_is_selected_when_available(self):
        class NewClass: pass
        q=types.SimpleNamespace(MatMulNBitsQuantizer=NewClass,
                                DefaultWeightOnlyQuantConfig=object)
        with mock.patch("importlib.import_module",return_value=q) as importer:
            module,klass,name=MOD.resolve_int4_quantizer()
        self.assertIs(module,q)
        self.assertIs(klass,NewClass)
        self.assertEqual(name,"matmul_nbits_quantizer")
        self.assertEqual(importer.call_count,1)

    def test_older_four_bits_api_remains_compatible(self):
        class LegacyClass: pass
        legacy=types.SimpleNamespace(MatMul4BitsQuantizer=LegacyClass,
                                     DefaultWeightOnlyQuantConfig=object)
        def get(name):
            if name.endswith("matmul_nbits_quantizer"):
                raise ModuleNotFoundError("No module named '"+name+"'", name=name)
            return legacy
        with mock.patch("importlib.import_module",side_effect=get):
            module,klass,name=MOD.resolve_int4_quantizer()
        self.assertIs(module,legacy)
        self.assertIs(klass,LegacyClass)
        self.assertEqual(name,"matmul_4bits_quantizer")

    def test_missing_both_apis_has_explicit_error(self):
        def missing(name):
            raise ModuleNotFoundError("No module named '"+name+"'", name=name)
        with mock.patch("importlib.import_module",side_effect=missing):
            with self.assertRaisesRegex(RuntimeError,"onnxruntime_int4_quantizer_unavailable"):
                MOD.resolve_int4_quantizer()

    def test_broken_internal_dependency_is_not_masked_as_legacy(self):
        def dependency_failure(name):
            raise ModuleNotFoundError("internal dependency missing", name="some_internal_dependency")
        with mock.patch("importlib.import_module",side_effect=dependency_failure):
            with self.assertRaises(ModuleNotFoundError):
                MOD.resolve_int4_quantizer()

    def test_sandbox_pins_runtime_preflights_and_fails_closed(self):
        script=(ROOT/"ops/forza-pocket-int4-original-cpu-vps.sh").read_text()
        self.assertIn("'onnxruntime==1.23.2'",script)
        self.assertIn("FORZA_INT4_ORT_READY",script)
        self.assertIn("MatMulNBitsQuantizer",script)
        self.assertIn("FORZA_INT4_CONVERSION_FAILED",script)
        self.assertNotIn('FORZA_QUANT_FAILED_OR_UNSUPPORTED: float profiles remain usable',script)
        self.assertIn("scripts/forza_patch_int4_parent.py",script)
        self.assertIn("FORZA_INT4_RESULT profile=",script)
        self.assertIn("wav_sha256=",script)
        self.assertIn("31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",script)
        for action in ('docker stop "$LIVE"','docker restart "$LIVE"',
                       'docker rm -f "$LIVE"','docker system prune','docker volume rm'):
            self.assertNotIn(action,script)


if __name__=="__main__":
    unittest.main()
