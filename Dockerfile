FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
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
