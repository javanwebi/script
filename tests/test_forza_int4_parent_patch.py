#!/usr/bin/env python3
"""Reproduce the live VPS Docker build regression without Docker or speaker data."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "forza_patch_int4_parent", ROOT / "scripts/forza_patch_int4_parent.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def source_with_loader(loader: str) -> str:
    return (
        "import os\nimport onnxruntime as ort\n"
        "class OnnxTts:\n"
        " def __init__(self):\n"
        "  self.dir = None\n"
        "  self.s_flow = ort.InferenceSession(\n"
        f"   {loader}, opts, providers=prov)\n"
        '  self.s_dec = ort.InferenceSession("mimi_decoder_step_kv.onnx", opts, providers=prov)\n'
    )


class ParentPatchRegressionTest(unittest.TestCase):
    def test_unpatched_original_image_variant(self):
        source = source_with_loader(module.RAW)
        out, variant = module.patched_source(source)
        self.assertEqual(variant, "raw")
        self.assertEqual(out.count(module.INT4), 1)
        self.assertNotIn(module.RAW + ", opts", out)
        self.assertIn("mimi_decoder_step_kv.onnx", out)
        compile(out, "<candidate>", "exec")

    def test_source_from_newer_pocket_dockerfile(self):
        source = source_with_loader(module.INT8)
        out, variant = module.patched_source(source)
        self.assertEqual(variant, "int8")
        self.assertEqual(out.count(module.INT4), 1)
        compile(out, "<candidate>", "exec")

    def test_patch_only_changes_one_flow_loader_and_never_uses_wildcards(self):
        source = source_with_loader(module.RAW)
        out, _ = module.patched_source(source)
        self.assertEqual(out.replace(module.INT4, module.RAW), source)

    def test_fail_closed_unknown_already_patched_and_duplicate_loader(self):
        with self.assertRaisesRegex(ValueError, "unknown_original_pocket_flow_loader"):
            module.patched_source(source_with_loader('str(self.dir / "other-model.onnx")'))
        with self.assertRaisesRegex(ValueError, "int4_loader_already_present"):
            module.patched_source(source_with_loader(module.INT4))
        with self.assertRaisesRegex(ValueError, "unexpected_flow_session_count"):
            module.patched_source(source_with_loader(module.RAW) +
                'self.s_flow = ort.InferenceSession("wrong")\n')

    def test_file_patch_is_candidate_only_and_rejects_unknown_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            original = Path(folder) / "tts_onnx.py"
            original.write_text(source_with_loader(module.RAW))
            self.assertEqual(module.patch_file(original), "raw")
            self.assertIn(module.INT4, original.read_text())
            with self.assertRaisesRegex(ValueError, "int4_loader_already_present"):
                module.patch_file(original)
            self.assertIn(module.INT4, original.read_text())

    def test_benchmark_copies_patch_into_disposable_derived_image(self):
        script = (ROOT / "ops/forza-pocket-int4-original-cpu-vps.sh").read_text()
        self.assertIn("COPY scripts/forza_patch_int4_parent.py /app/scripts/", script)
        self.assertIn("RUN python /app/scripts/forza_patch_int4_parent.py\nDOCKER", script)
        self.assertIn("scripts/forza_patch_int4_parent.py |", script)
        self.assertNotIn("Unexpected Pocket model flow graph source", script)
        for forbidden in ['docker stop "$LIVE"', 'docker restart "$LIVE"',
                          'docker rm -f "$LIVE"', 'docker system prune',
                          'docker volume rm']:
            self.assertNotIn(forbidden, script)


if __name__ == "__main__":
    unittest.main()
