#!/usr/bin/env python3
"""Quantize only the Pocket flow graph in a disposable VPS candidate.

This script changes model weights (never any customer's generated WAV).
Run only in a CPU/RAM-capped throwaway container.  The original FP32
flow_lm_step.onnx must remain intact for A/B comparison and rollback.
"""
import argparse
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--model-dir", type=Path, default=Path("/app/vendor/persian_tts/model/onnx"))
    args=ap.parse_args()
    src=args.model_dir/"flow_lm_step.onnx"
    src_data=args.model_dir/"flow_lm_step.onnx.data"
    dest=args.model_dir/"flow_lm_step.int8.onnx"
    # Pocket's graph protobuf is about 850 KB; the actual FP32 weights are
    # in the adjacent 341 MB external-data file. Reject a missing weights
    # sidecar rather than incorrectly rejecting a valid sub-1 MB graph.
    if not src.is_file() or src.stat().st_size < 100_000:
        raise SystemExit("FORZA_QUANT_FAIL missing_or_invalid_float_graph")
    if not src_data.is_file() or src_data.stat().st_size < 1_000_000:
        raise SystemExit("FORZA_QUANT_FAIL missing_or_invalid_float_weights")
    if dest.exists():
        raise SystemExit("FORZA_QUANT_FAIL refusing_to_overwrite_candidate")
    # Quantize only matrix multiplications. Conv, layer normalization, KV
    # state, decoder, G2P, and selected voice conditioning stay float.
    # Speed and sound quality MUST be measured: Xeon E5 v2 lacks AVX2.
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(
        str(src), str(dest),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["MatMul","Gemm"],
        per_channel=False,
        reduce_range=False,
        # Keep the quantized graph's weight tensors in an ONNX sidecar.
        # ONNX Runtime resolves the adjacent .data file automatically.
        use_external_data_format=True,
    )
    import onnxruntime as ort
    opts=ort.SessionOptions()
    opts.intra_op_num_threads=1
    opts.inter_op_num_threads=1
    opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session=ort.InferenceSession(str(dest), opts, providers=["CPUExecutionProvider"])
    if not session.get_inputs() or not session.get_outputs():
        raise RuntimeError("FORZA_QUANT_FAIL inference_session_invalid")
    print("FORZA_QUANT_OK original_bytes=%d int8_bytes=%d"%
          (src.stat().st_size,dest.stat().st_size),flush=True)

if __name__=="__main__":
    main()
