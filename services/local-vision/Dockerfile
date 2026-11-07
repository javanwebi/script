# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm
WORKDIR /service
ENV OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download once during provisioning. Serving uses only these local files.
RUN --mount=type=secret,id=hf_token,required=true python -c "from pathlib import Path; import os; os.environ['HF_TOKEN']=Path('/run/secrets/hf_token').read_text().strip(); from transformers import AutoModel; from huggingface_hub import hf_hub_download; import shutil; m='facebook/dinov3-vits16plus-pretrain-lvd1689m'; AutoModel.from_pretrained(m,revision='c93d816fc9e567563bc068f01475bec89cc634a6').save_pretrained('/model'); shutil.copyfile(hf_hub_download(m,'preprocessor_config.json',revision='c93d816fc9e567563bc068f01475bec89cc634a6'),'/model/preprocessor_config.json'); shutil.rmtree('/root/.cache/huggingface',ignore_errors=True)"
COPY worker.py .
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LOCAL_VISION_MODEL_DIR=/model
USER 65534:65534
EXPOSE 8091
CMD ["python", "worker.py"]
