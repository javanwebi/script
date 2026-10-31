#!/usr/bin/env python3
"""Patch exactly one known Pocket FlowLM loader IN AN ISOLATED DERIVED IMAGE.

The customer's live container and immutable source image must not be edited.
Both supported variants come from the pinned upstream source and its original
Dockerfile.forza-voice variant. Unknown sources fail closed (no broad regex).
"""
from pathlib import Path
import argparse


RAW = 'str(self.dir / "flow_lm_step.onnx")'
INT8 = ('str(self.dir / ("flow_lm_step.int8.onnx" '
        'if os.environ.get("FORZA_ONNX_INT8") == "1" '
        'else "flow_lm_step.onnx"))')
INT4 = (
    'str(self.dir / ("flow_lm_step.int4.onnx" '
    'if os.environ.get("FORZA_ONNX_INT4") == "1" '
    'else ("flow_lm_step.int8.onnx" '
    'if os.environ.get("FORZA_ONNX_INT8") == "1" '
    'else "flow_lm_step.onnx")))'
)


def patched_source(source: str) -> tuple[str, str]:
    if 'flow_lm_step.int4.onnx' in source:
        raise ValueError("int4_loader_already_present")
    if source.count("self.s_flow = ort.InferenceSession(") != 1:
        raise ValueError("unexpected_flow_session_count")
    # Search only in the FlowLM constructor block, not in other code, so
    # a code comment or different ORT session cannot be patched accidentally.
    prefix, flow_block = source.split("self.s_flow = ort.InferenceSession(", 1)
    matching = [(name, needle) for name, needle in (("raw", RAW), ("int8", INT8))
                if flow_block.count(needle) == 1]
    if len(matching) != 1:
        raise ValueError("unknown_original_pocket_flow_loader")
    name, needle = matching[0]
    if flow_block.count("flow_lm_step.onnx") != 1:
        raise ValueError("ambiguous_original_pocket_flow_loader")
    return prefix + "self.s_flow = ort.InferenceSession(" + flow_block.replace(
        needle, INT4, 1
    ), name


def patch_file(path: Path) -> str:
    original = path.read_text(encoding="utf-8")
    changed, variant = patched_source(original)
    if changed == original:
        raise ValueError("pocket_flow_loader_not_changed")
    path.write_text(changed, encoding="utf-8")
    return variant


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path,
                        default=Path("/app/vendor/persian_tts/scripts/tts_onnx.py"))
    args = parser.parse_args()
    variant = patch_file(args.source)
    print(f"FORZA_INT4_PARENT_PATCH_SUCCESS variant={variant} isolated_only=1",
          flush=True)


if __name__ == "__main__":
    main()
