"""Bearer-protected deployment of OpenMOSS's native realtime FastAPI service.

The upstream server is loaded from the pinned GitHub checkout in /opt/MOSS-TTS
and its documented session API stays unchanged. Do not expose upstream directly.
"""
import hmac
import os
import sys
from fastapi import Request
from fastapi.responses import JSONResponse

sys.path.insert(0, "/opt/MOSS-TTS/moss_tts_realtime")
import fast_api as moss

app = moss.app

@app.middleware("http")
async def require_auth(request: Request, call_next):
    if request.url.path in {"/health", "/ready"}:
        return await call_next(request)
    secret = os.environ.get("FORZA_TTS_TOKEN", "")
    if not secret:
        return JSONResponse({"detail": "tts_token_not_configured"}, status_code=503)
    bearer = request.headers.get("authorization", "")
    if not hmac.compare_digest(bearer, "Bearer " + secret):
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)

@app.get("/ready")
def readiness():
    import torch
    if not torch.cuda.is_available():
        return JSONResponse({"ready": False, "reason": "cuda_gpu_unavailable"}, status_code=503)
    try:
        paths = moss.BackendPaths(
            model_path=moss.MODEL_PATH, tokenizer_path=moss.TOKENIZER_PATH,
            codec_model_path=moss.CODEC_MODEL_PATH, device_str=moss.DEVICE,
            attn_impl=moss.ATTN_IMPL,
        )
        moss.demo.get_or_load_backend(paths)
    except Exception:
        return JSONResponse({"ready": False, "reason": "model_load_failed"}, status_code=503)
    return {"ready": True, "engine": "OpenMOSS-Team/MOSS-TTS-Realtime", "cuda": True}
