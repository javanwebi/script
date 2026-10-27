# A CUDA/GPU host is required; Railway CPU is not a supported inference target.
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:${PATH}" \
    MOSS_TTS_DEVICE=cuda:0 \
    MOSS_TTS_ATTN_IMPL=sdpa \
    MOSS_TTS_MODEL_PATH=OpenMOSS-Team/MOSS-TTS-Realtime \
    MOSS_TTS_TOKENIZER_PATH=OpenMOSS-Team/MOSS-TTS-Realtime \
    MOSS_TTS_CODEC_MODEL_PATH=OpenMOSS-Team/MOSS-Audio-Tokenizer

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip git ffmpeg libsndfile1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip setuptools wheel

# Pin the model serving source to an audited upstream commit.
RUN git clone https://github.com/OpenMOSS/MOSS-TTS.git /opt/MOSS-TTS && \
    cd /opt/MOSS-TTS && git checkout 934d6826b084c46a0d033402174d5f8ac4ed2519
RUN /opt/venv/bin/pip install --extra-index-url https://download.pytorch.org/whl/cu128 -e /opt/MOSS-TTS
RUN /opt/venv/bin/pip install fastapi uvicorn

RUN mkdir -p /opt/forza
COPY protected_server.py /opt/forza/protected_server.py
WORKDIR /opt/forza

# The GPU host must also mount the consenting, properly licensed voice sample
# at /app/voices/forza_male_fa.wav. Do not publish the sample in Git.
EXPOSE 8083
CMD ["uvicorn","protected_server:app","--host","0.0.0.0","--port","8083","--workers","1"]
