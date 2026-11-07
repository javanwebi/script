FROM python:3.11-slim-bookworm
WORKDIR /service
# Some VPS networks time out on Debian's HTTP CDN. Keep official repositories,
# use verified HTTPS, and fail on incomplete package indexes with bounded retries.
RUN set -eu; \
    for source in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do \
      if [ -f "$source" ]; then sed -i 's#http://deb.debian.org#https://deb.debian.org#g' "$source"; fi; \
    done; \
    apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=25 -o Acquire::https::Timeout=25 -o APT::Update::Error-Mode=any update; \
    DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=25 -o Acquire::https::Timeout=25 install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng; \
    rm -rf /var/lib/apt/lists/*
ENV OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download once during provisioning. Serving uses only these local files.
RUN python -c "from transformers import AutoModel; from huggingface_hub import hf_hub_download; import shutil; m='facebook/dinov2-small'; AutoModel.from_pretrained(m,revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False).save_pretrained('/model'); shutil.copyfile(hf_hub_download(m,'preprocessor_config.json',revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False),'/model/preprocessor_config.json'); shutil.rmtree('/root/.cache/huggingface',ignore_errors=True)"
COPY worker.py retrieval.py ./
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LOCAL_VISION_MODEL_DIR=/model
USER 65534:65534
EXPOSE 8091
CMD ["python", "worker.py"]
