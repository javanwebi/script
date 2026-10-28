FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
# Pin the browser inference runtime at build time. The voice is synthesized
# on the customer's device, NOT on the Railway server.
RUN npm install --no-save --package-lock=false \
    @mintplex-labs/piper-tts-web@1.0.5 \
    onnxruntime-web@1.18.0 \
    @diffusionstudio/piper-wasm@1.0.0 \
    vosk-browser@0.0.8 \
 && mkdir -p public/forza-runtime/ort public/forza-runtime/piper public/forza-runtime/stt \
 && cp node_modules/onnxruntime-web/dist/ort-wasm*.wasm public/forza-runtime/ort/ \
 && cp node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data public/forza-runtime/piper/ \
 && cp node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm public/forza-runtime/piper/ \
 && cp node_modules/vosk-browser/dist/vosk.min.js public/forza-runtime/stt/ \
 && npm run lint && npm run build \
 && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
