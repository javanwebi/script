FROM python:3.12-slim-bookworm
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models/hf
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg libsndfile1 \
  && rm -rf /var/lib/apt/lists/*
# Author's Persian fork is needed for v2 phoneme frontend; Sokhanvar handles G2P.
RUN pip install --no-cache-dir "sokhanvar[pocket] @ git+https://github.com/tavallaie/sokhanvar.git"
COPY services/forza-pocket-tts/server.py /srv/server.py
EXPOSE 8080
CMD ["python", "/srv/server.py"]
