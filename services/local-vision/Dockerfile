FROM python:3.11-slim-bookworm
WORKDIR /service
# This VPS can reach ftp.debian.org but times out on deb.debian.org.
# Keep signed official main/update and security repositories on verified HTTPS.
RUN set -eu; \
    for source in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do \
      if [ -f "$source" ]; then sed -E -i \
        -e 's#https?://deb.debian.org/debian-security#https://security.debian.org/debian-security#g' \
        -e 's#https?://deb.debian.org/debian#https://ftp.debian.org/debian#g' \
        -e 's#http://security.debian.org#https://security.debian.org#g' "$source"; fi; \
    done; \
    apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=25 -o Acquire::https::Timeout=25 -o APT::Update::Error-Mode=any update; \
    DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=25 -o Acquire::https::Timeout=25 install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng; \
    rm -rf /var/lib/apt/lists/*
ENV OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false
# Install only the CPU wheel from PyTorch. Its dependencies are resolved separately
# through the probed mirror so PyTorch's index cannot send them to a blocked CDN.
RUN python -m pip --isolated install --no-cache-dir --timeout 60 --retries 2 --no-deps \
    'torch==2.8.0+cpu' --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
ARG VISION_PYPI_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN python -m pip --isolated install --no-cache-dir --timeout 60 --retries 2 \
    --index-url "$VISION_PYPI_INDEX_URL" 'torch==2.8.0+cpu' -r requirements.txt \
    && python -m pip check
# Download once during provisioning. Serving uses only these local files.
RUN python -c "from transformers import AutoModel; from huggingface_hub import hf_hub_download; import shutil; m='facebook/dinov2-small'; AutoModel.from_pretrained(m,revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False).save_pretrained('/model'); shutil.copyfile(hf_hub_download(m,'preprocessor_config.json',revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False),'/model/preprocessor_config.json'); shutil.rmtree('/root/.cache/huggingface',ignore_errors=True)"
COPY worker.py retrieval.py ./
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LOCAL_VISION_MODEL_DIR=/model
USER 65534:65534
EXPOSE 8091
CMD ["python", "worker.py"]
