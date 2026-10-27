FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MANA_MODEL_PATH=/opt/models/fa_IR-mana-medium.onnx \
    HF_HOME=/tmp/hf-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libespeak-ng1 espeak-ng-data libsndfile1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Package MIT-licensed ONNX weights in the image so the service does not depend
# on Hugging Face availability during a live customer conversation.
RUN mkdir -p /opt/models && python -c "from huggingface_hub import hf_hub_download; \
from pathlib import Path; import shutil; repo='MahtaFetrat/Mana-Persian-Piper'; \
files=('fa_IR-mana-medium.onnx','fa_IR-mana-medium.onnx.json'); \
[shutil.copy2(hf_hub_download(repo_id=repo,filename=f), Path('/opt/models')/f) for f in files]"
COPY app.py .

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
