#!/usr/bin/env python3
"""Isolated INT4 weight-only conversion of the ORIGINAL Pocket Farsi FlowLM.

This deliberately quantizes the *installed* FP32 ONNX flow graph, not a
third-party export or another voice. The reference WAV, speaker conditioning,
tokenizer, G2P and Mimi remain unchanged. No customer audio/files are used.
Only for disposable CPU benchmarking, never run against the live volume.
"""
import argparse
import os
from pathlib import Path
import sys


def quantize_original_flow(model_dir: Path, block_size: int = 128) -> dict:
    if block_size not in (32, 64, 128):
        raise ValueError("invalid_int4_block_size")
    model_dir = model_dir.resolve()
    source = model_dir / "flow_lm_step.onnx"
    external = model_dir / "flow_lm_step.onnx.data"
    output = model_dir / "flow_lm_step.int4.onnx"
    if not source.is_file() or not external.is_file():
        raise RuntimeError("original_pocket_flow_graph_missing")
    if not (100_000 < source.stat().st_size < 10_000_000):
        raise RuntimeError("unexpected_pocket_onnx_graph_size")
    if not (1_000_000 < external.stat().st_size < 1_000_000_000):
        raise RuntimeError("unexpected_pocket_onnx_weights_size")
    if output.exists() or (model_dir / "flow_lm_step.int4.onnx.data").exists():
        raise RuntimeError("refusing_to_overwrite_int4_candidate")

    import onnx
    import onnxruntime as ort
    from onnxruntime.quantization import matmul_4bits_quantizer, quant_utils

    # This pinned FlowLM graph previously failed ONNX shape inference for
    # dynamic INT8. Weight-only quantization does not calibrate activations;
    # try inferred shapes, but retain a fallback that loads constant weights.
    try:
        model = quant_utils.load_model_with_shape_infer(source)
        print("FORZA_INT4_LOAD shape_inference=success", flush=True)
    except Exception as exc:
        print("FORZA_INT4_LOAD shape_inference=skipped reason=%s" %
              type(exc).__name__, flush=True)
        from onnxruntime.quantization.onnx_model import ONNXModel
        model = ONNXModel(onnx.load(str(source), load_external_data=True))

    # MatMul ONLY, no quantized Gather or changes to KV state, Mimi or G2P.
    config = matmul_4bits_quantizer.DefaultWeightOnlyQuantConfig(
        block_size=block_size,
        is_symmetric=True,
        accuracy_level=4,
        quant_format=quant_utils.QuantFormat.QOperator,
        op_types_to_quantize=("MatMul",),
        quant_axes=(("MatMul", 0),),
    )
    quantizer = matmul_4bits_quantizer.MatMul4BitsQuantizer(
        model,
        nodes_to_exclude=None,
        nodes_to_include=None,
        algo_config=config,
    )
    quantizer.process()
    quantized_nodes = sum(
        node.op_type == "MatMulNBits"
        for node in quantizer.model.model.graph.node
    )
    if quantized_nodes < 1:
        raise RuntimeError("no_original_flow_matmul_nodes_quantized")

    try:
        quantizer.model.save_model_to_file(str(output), True)
        if not output.is_file():
            raise RuntimeError("int4_graph_missing")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session = ort.InferenceSession(str(output), options, providers=["CPUExecutionProvider"])
        if not session.get_inputs() or not session.get_outputs():
            raise RuntimeError("int4_session_invalid")
        graph = onnx.load(str(output), load_external_data=False)
        if not any(node.op_type == "MatMulNBits" for node in graph.graph.node):
            raise RuntimeError("int4_graph_missing_matmul_nbits")
        footprint = sum(p.stat().st_size for p in model_dir.glob("flow_lm_step.int4.onnx*"))
        print("FORZA_INT4_CONVERT_SUCCESS nodes=%d original_weight_bytes=%d int4_disk_bytes=%d block_size=%d" %
              (quantized_nodes, external.stat().st_size, footprint, block_size), flush=True)
        return {"quantized_nodes": quantized_nodes, "bytes": footprint}
    except BaseException:
        # Incomplete candidate must never be mistaken for a working engine.
        for candidate in model_dir.glob("flow_lm_step.int4.onnx*"):
            if candidate.is_file():
                candidate.unlink()
        raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path,
                        default=Path("/app/vendor/persian_tts/model/onnx"))
    parser.add_argument("--block-size", type=int, default=128)
    args = parser.parse_args()
    quantize_original_flow(args.model_dir, args.block_size)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("FORZA_INT4_CONVERT_UNAVAILABLE error=%s detail=%s" %
              (type(exc).__name__, str(exc)[:180]), file=sys.stderr, flush=True)
        raise
