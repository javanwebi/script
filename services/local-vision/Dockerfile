FROM python:3.11-slim-bookworm
WORKDIR /service
ENV OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download once during provisioning. Serving uses only these local files.
RUN python -c "from transformers import AutoModel; from huggingface_hub import hf_hub_download; import shutil; m='facebook/dinov2-small'; AutoModel.from_pretrained(m,revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False).save_pretrained('/model'); shutil.copyfile(hf_hub_download(m,'preprocessor_config.json',revision='ed25f3a31f01632728cabb09d1542f84ab7b0056',token=False),'/model/preprocessor_config.json'); shutil.rmtree('/root/.cache/huggingface',ignore_errors=True)"
COPY worker.py .
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LOCAL_VISION_MODEL_DIR=/model
USER 65534:65534
EXPOSE 8091
CMD ["python", "worker.py"]
