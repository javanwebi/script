"""Pinned MobileCLIP2-S0 image tower only. No text model or remote execution."""
from pathlib import Path
import timm
from safetensors.torch import load_file
from timm.utils import reparameterize_model

MODEL_ID = 'mobileclip2-s0-095906d2-fp32-pad-256-v1'
REVISION = '095906d28bf54d7584dc411e8ffe448f34289e05'


def load_mobile_encoder(directory):
    model = timm.create_model('fastvit_mci0', pretrained=False, num_classes=512)
    model.load_state_dict(load_file(str(Path(directory)/'image.safetensors')), strict=True)
    return reparameterize_model(model).eval()


if __name__ == '__main__':
    # Provision once; the serving container needs neither a network nor a HF token.
    from huggingface_hub import hf_hub_download
    from safetensors import safe_open
    from safetensors.torch import save_file
    import os
    import shutil
    source = hf_hub_download('timm/MobileCLIP2-S0-OpenCLIP', 'open_clip_model.safetensors', revision=REVISION, token=False)
    destination = Path(os.environ.get('LOCAL_VISION_MODEL_DIR', '/mobile-model'))
    destination.mkdir(parents=True, exist_ok=True)
    with safe_open(source, framework='pt') as weights:
        tensors = {key.removeprefix('visual.trunk.'): weights.get_tensor(key).clone() for key in weights.keys() if key.startswith('visual.trunk.')}
    save_file(tensors, str(destination/'image.safetensors'))
    load_mobile_encoder(destination)  # Strictly validate architecture before publishing an image.
    shutil.rmtree('/root/.cache/huggingface', ignore_errors=True)
