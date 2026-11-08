"""Private, bounded CPU image encoder. No external image URLs or runtime downloads."""
import base64
import hmac
import io
import json
import os
import threading
from retrieval import PIPELINE, decode, foreground, regions, crop, jpeg, markings, geometric
import cv2
cv2.setNumThreads(1)
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL_ID = 'dinov2-small-ed25f3a3-fp32-cls-224-v1'
MOBILE = os.environ.get('LOCAL_VISION_ENCODER') == 'mobileclip2-s0'
if MOBILE:
    MODEL_ID = 'mobileclip2-s0-095906d2-fp32-pad-256-v1'
    PIPELINE = 'local-lens-v3'
DIMENSIONS = 512 if MOBILE else 384
MAX_BODY = 6 * 1024 * 1024
Image = None
image_mean = (0.485, 0.456, 0.406)
image_std = (0.229, 0.224, 0.225)
np = None
model = None
torch = None
slot = threading.BoundedSemaphore(1)


def encode(images):
    prepared = []
    for value in images:
        raw = base64.b64decode(value, validate=True)
        image = Image.open(io.BytesIO(raw))
        if max(image.size) > 2048 or image.width * image.height > 4_000_000:
            raise ValueError('image too large')
        # Node has already applied EXIF orientation. Prevent center-crop from losing part edges.
        image = image.convert('RGB')
        side = max(image.size)
        canvas = Image.new('RGB', (side, side), 'white')
        canvas.paste(image, ((side-image.width)//2, (side-image.height)//2))
        pixels = torch.from_numpy(np.array(canvas)).permute(2, 0, 1).float().div_(255).unsqueeze(0)
        pixels = torch.nn.functional.interpolate(pixels, size=(256, 256) if MOBILE else (224, 224), mode='bilinear', align_corners=False, antialias=True)[0]
        mean = torch.tensor(image_mean).view(3, 1, 1)
        std = torch.tensor(image_std).view(3, 1, 1)
        prepared.append((pixels-mean)/std)
    inputs = {'pixel_values': torch.stack(prepared)}
    with torch.inference_mode():
        output = model(inputs['pixel_values']) if MOBILE else model(**inputs).last_hidden_state[:, 0]
        vectors = torch.nn.functional.normalize(output, dim=-1)
    return vectors.tolist()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log images, tokens or request bodies.

    def reply(self, status, data):
        raw = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path != '/health':
            return self.reply(404, {})
        self.reply(200, {'status': 'ok', 'model': MODEL_ID, 'dimensions': DIMENSIONS, 'pipeline': PIPELINE})

    def do_POST(self):
        if self.path not in ('/embed', '/query', '/rerank'):
            return self.reply(404, {})
        expected = 'Bearer ' + os.environ['LOCAL_VISION_TOKEN']
        if not hmac.compare_digest(self.headers.get('Authorization', ''), expected):
            return self.reply(401, {'error': 'unauthorized'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > MAX_BODY:
                return self.reply(413, {'error': 'body_size'})
        except ValueError:
            return self.reply(400, {'error': 'body_size'})
        if not slot.acquire(blocking=False):
            return self.reply(429, {'error': 'busy'})
        try:
            self.connection.settimeout(5)
            data = json.loads(self.rfile.read(size))
            if self.path == '/query':
                image = decode(data['image'])
                boxes = regions(image) if MOBILE else [box for box in [foreground(image)] if box]
                box = boxes[0] if boxes else None
                views = [data['image']]
                views.extend(jpeg(crop(image, region)) for region in boxes)
                # Never attach text from one proposed object to a different crop selected by catalogue retrieval.
                if len(boxes) > 1:
                    text, available = [], False
                else:
                    text, available = markings(crop(image, box) if box else image)
                self.reply(200, {'model': MODEL_ID, 'pipeline': PIPELINE, 'vectors': encode(views),
                                 'region': box, 'viewRegions': [None]+boxes, 'markings': text, 'ocrAvailable': available})
            elif self.path == '/rerank':
                candidates = data.get('images')
                if not isinstance(candidates, list) or not 1 <= len(candidates) <= 6:
                    raise ValueError('invalid candidates')
                self.reply(200, {'model': MODEL_ID, 'pipeline': PIPELINE,
                                 'evidence': [geometric(data['image'], value) for value in candidates]})
            else:
                images = data.get('images')
                if not isinstance(images, list) or not 1 <= len(images) <= 2 or not all(isinstance(i, str) for i in images):
                    raise ValueError('invalid batch')
                self.reply(200, {'model': MODEL_ID, 'vectors': encode(images)})
        except Exception:
            self.reply(400, {'error': 'invalid_image'})
        finally:
            slot.release()


if __name__ == '__main__':
    if len(os.environ.get('LOCAL_VISION_TOKEN', '')) < 32:
        raise SystemExit('LOCAL_VISION_TOKEN must contain at least 32 characters')
    import torch
    from PIL import Image
    import numpy as np
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    directory = os.environ.get('LOCAL_VISION_MODEL_DIR', '/model')
    if MOBILE:
        from mobile_encoder import load_mobile_encoder
        model = load_mobile_encoder(directory)
        image_mean, image_std = (0, 0, 0), (1, 1, 1)
    else:
        from transformers import AutoModel
        with open(os.path.join(directory, 'preprocessor_config.json')) as f:
            preprocessing = json.load(f)
        image_mean = preprocessing.get('image_mean', image_mean)
        image_std = preprocessing.get('image_std', image_std)
        model = AutoModel.from_pretrained(directory, local_files_only=True).eval()
        if model.config.model_type != 'dinov2' or model.config.hidden_size != 384:
            raise SystemExit('Unexpected model architecture')
    warmup = io.BytesIO()
    Image.new('RGB', (32, 32), 'white').save(warmup, format='JPEG')
    encode([base64.b64encode(warmup.getvalue()).decode()])
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('LOCAL_VISION_PORT', '8091'))), Handler).serve_forever()
