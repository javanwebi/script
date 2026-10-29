# FORZA Persian Chatterbox TTS

Only the FORZA **voice synthesis** is changed. STT, Gemini, database, catalogue,
streaming text and microphone turn-taking remain unchanged.

This service loads the Persian Chatterbox finetune
`Thomcles/Chatterbox-TTS-Persian-Farsi` (t3_fa.safetensors) over
`ChatterboxMultilingualTTS`. The upstream model by itself does NOT support
Persian. The user states that they have obtained commercial permission for the
Persian weights; verify that permission is retained by the operator.

## Deploy

1. Create a separate private service (preferably GPU, with several GB RAM).
   Use repository-root build context and Dockerfile
   `services/forza-chatterbox/Dockerfile`.
2. Mount persistent storage at `/models/hf` to avoid repeated model downloads.
   The first startup requires internet access to Hugging Face and may take
   several minutes. Inference is local and has no per-token charges.
3. Set the same random `FORZA_CHATTERBOX_TOKEN` in both the TTS service and
   the main Sanat Pish web service. Do not expose the TTS port publicly.
4. Set `FORZA_CHATTERBOX_URL=http://<private-service-host>:8080` on the main
   web service. The web backend proxies `POST /api/ai/forza-speech`.
5. Verify `GET /health` from the internal network and test an actual Persian
   greeting and industrial sentence through the main site's endpoint before
   switching production traffic.

Environment:
- `PORT` (default 8080)
- `FORZA_CHATTERBOX_TOKEN` (recommended, shared with web backend)
- `FORZA_CHATTERBOX_DEVICE` (`cuda` or `cpu`; default auto)
- `FORZA_CHATTERBOX_THREADS` (default 2)
- `HF_TOKEN` (optional read token for gated/rate-limited downloads)
- `HF_HOME` (default /models/hf)
- `FORZA_CHATTERBOX_WEIGHTS` (optional local checkpoint path)

Note: CPU inference for the 500M-parameter model can be very slow. Do not
promise real-time audio until measured on the actual machine. This sidecar
pre-renders the greeting at startup, but dynamic responses are synthesized
one phrase at a time. No Piper Amir is used by the new frontend voice path.
