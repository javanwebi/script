FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    PIPER_MODEL=/opt/voices/fa_IR-amir-medium.onnx \
    DIBA_MODEL=fa-small
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates espeak-ng libespeak1 libgomp1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /opt/voices && cd /opt/voices \
    && python -m piper.download_voices fa_IR-amir-medium
COPY app.py .
CMD ["sh","-c","exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
