FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
# FORZA's selected voice is Pocket TTS Farsi v2, not Piper Amir.
# Fetch and bundle ONNX weights at build time; production inference is offline.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv git curl ca-certificates libsndfile1 \
 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/forza-pocket \
 && /opt/forza-pocket/bin/pip install --no-cache-dir onnxruntime numpy scipy soundfile sentencepiece typer "huggingface_hub[cli]"
RUN mkdir -p vendor/persian_tts \
 && git init vendor/persian_tts \
 && git -C vendor/persian_tts remote add origin https://github.com/nimaone/persian_tts.git \
 && git -C vendor/persian_tts fetch --depth 1 origin e834bd65ac622f376c4d2050821decf5eb95241c \
 && git -C vendor/persian_tts checkout --detach FETCH_HEAD
# Low-memory ONNX sessions for Railway 1GB.
RUN python3 - <<'PY'
from pathlib import Path
p=Path('vendor/persian_tts/scripts/tts_onnx.py')
s=p.read_text()
a='opts.intra_op_num_threads = 2'
assert a in s, 'upstream changed: review low-memory patch'
s=s.replace(a,'opts.intra_op_num_threads = 1\n        opts.enable_cpu_mem_arena = False\n        opts.enable_mem_pattern = False')
# The voice encoder is only needed by the build-time greeting/cache job.
old='self.s_enc = ort.InferenceSession(str(self.dir / "mimi_encoder.onnx"), opts, providers=prov)'
assert old in s
s=s.replace(old, 'self.s_enc = None if os.environ.get("FORZA_POCKET_PRECOMPUTED_VOICE") == "1" else ort.InferenceSession(str(self.dir / "mimi_encoder.onnx"), opts, providers=prov)')
p.write_text(s)
p=Path('vendor/persian_tts/scripts/g2p_onnx.py')
s=p.read_text()
a='opts = ort.SessionOptions()'
assert a in s
s=s.replace(a, a + '\n        opts.intra_op_num_threads = 1\n        opts.inter_op_num_threads = 1\n        opts.enable_cpu_mem_arena = False\n        opts.enable_mem_pattern = False')
p.write_text(s)
PY
ENV HF_HUB_DOWNLOAD_TIMEOUT=240 HF_HUB_ETAG_TIMEOUT=90
RUN /opt/forza-pocket/bin/hf download Nimaone/pocket-tts-farsi-v2-onnx --local-dir /app/vendor/persian_tts/model/onnx \
 && mkdir -p /app/vendor/persian_tts/model/v2 \
 && curl -fL --retry 3 --connect-timeout 30 https://huggingface.co/mehdi-hf/pocket-tts-farsi-v2/resolve/main/tokenizer_ph.model -o /app/vendor/persian_tts/model/v2/tokenizer_ph.model \
 && curl -fL --retry 3 --connect-timeout 30 https://huggingface.co/mehdi-hf/pocket-tts-farsi-v2/resolve/main/normalize_fa.py -o /app/vendor/persian_tts/model/v2/normalize_fa.py \
 && curl -fL --retry 3 --connect-timeout 30 https://huggingface.co/mehdi-hf/pocket-tts-farsi-v2/resolve/main/samples/hello.wav -o /tmp/forza-selected-hello.wav \
 && /opt/forza-pocket/bin/python -c "import soundfile as sf; a,sr=sf.read('/tmp/forza-selected-hello.wav'); assert sr==24000 and len(a)/sr>=4; sf.write('public/forza-pocket-reference.wav',a[:5*sr],sr,subtype='PCM_16')" \
 && /opt/forza-pocket/bin/python scripts/forza_pocket_worker.py --greeting \
 && test -s public/forza-greeting-bootstrap.wav
# Install pinned browser runtimes at build time (none execute on Railway).
RUN npm install --no-save --package-lock=false --legacy-peer-deps --no-audit --no-fund \
 @mintplex-labs/piper-tts-web@1.0.5 onnxruntime-web@1.18.0 \
 @diffusionstudio/piper-wasm@1.0.0 vosk-browser@0.0.8 \
 && echo 'FORZA_RUNTIMES_INSTALLED'
RUN mkdir -p public/forza-runtime/ort public/forza-runtime/piper public/forza-runtime/stt \
 && ls -la node_modules/@diffusionstudio/piper-wasm/build/ \
 && cp node_modules/onnxruntime-web/dist/ort-wasm*.wasm public/forza-runtime/ort/ \
 && cp node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data public/forza-runtime/piper/ \
 && cp node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm public/forza-runtime/piper/ \
 && cp node_modules/vosk-browser/dist/vosk.js public/forza-runtime/stt/ \
 && echo 'FORZA_WASM_ASSETS_COPIED'
RUN npm run lint
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
