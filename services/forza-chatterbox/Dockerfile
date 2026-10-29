# Independent GPU-capable TTS sidecar; do not add PyTorch to the main web image.
FROM python:3.11-slim-bookworm
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models/hf
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 ffmpeg git \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir chatterbox-tts huggingface_hub safetensors numpy
COPY services/forza-chatterbox/server.py /srv/server.py
# Persian weights and base Chatterbox weights are downloaded on the first start
# and cached on a persistent volume at /models/hf.
EXPOSE 8080
CMD ["python", "/srv/server.py"]
