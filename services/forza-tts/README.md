# FORZA self-hosted Persian speech

This is the complete server implementation for a private Persian TTS service
inside the `javanwebi/script` repository. It uses the **Mana Persian Piper**
model (`MahtaFetrat/Mana-Persian-Piper`, MIT model license and Mana-TTS
CC0 dataset) on a CPU, with `piper-tts` (GPLv3-or-later runtime).
The Piper runtime license has copyleft obligations; preserve its copyright and
license notices if distributing modified source/binaries.

## Railway service

Create a service named `forza-tts` in the same Railway project as `sanatpish`:

- Repo: `javanwebi/script`, branch `main`
- Root directory: `/services/forza-tts`
- Builder: Dockerfile (located at `Dockerfile`)
- Set `PORT=8000`, a strong private `FORZA_TTS_TOKEN`, and keep the service
  **private**, without any public domain.
- Health check: `/health` (200 only when the real model is loaded/warmed).
- Set `FORZA_TTS_BASE_URL=http://forza-tts.railway.internal:8000` in the Node
  service and configure the identical private token there.

Speech interface, used by the Express backend:
```
POST /v1/audio/speech
Authorization: Bearer <private token>
Content-Type: application/json
{"model":"mana-piper-fa","voice":"mana-fa-ir","input":"سلام، من فورزا هستم.","response_format":"wav"}
```
Returns binary 16-bit PCM WAV with content type `audio/wav`. No Gemini TTS
or browser speech synthesis is used. The model is loaded **once** during startup
and a real Persian greeting is synthesized to warm the inference path.
Text is limited to 800 characters per call. Express splits longer answers
into short phrases and caches successful audio.

To verify without exposing the private model to the internet, run service
health from Railway internal networking, and a real speech WAV smoke test using
the application's `/api/ai/tts` endpoint from an authorized environment.
Tests must validate actual audio waveform duration and consecutive turns, not
just HTTP success. Chrome autoplay/microphone permissions are browser-enforced.

References:
- https://huggingface.co/MahtaFetrat/Mana-Persian-Piper
- https://pypi.org/project/piper-tts/
