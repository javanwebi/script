"""Protocol test with random test weights; never an industrial accuracy benchmark."""
import base64
import importlib.util
import io
import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        import numpy as np
        from PIL import Image
        from transformers import AutoModel, Dinov2Config, Dinov2Model
        torch.set_num_threads(1)
        worker.torch, worker.np, worker.Image = torch, np, Image
        # Random small model checks actual DINOv2 code/preprocessing/transport, not recognition quality.
        directory = os.environ.get('LOCAL_VISION_TEST_MODEL_DIR')
        worker.model = (AutoModel.from_pretrained(directory, local_files_only=True) if directory else
                        Dinov2Model(Dinov2Config(num_hidden_layers=1, hidden_size=384, num_attention_heads=6, image_size=224))).eval()
        os.environ['LOCAL_VISION_TOKEN'] = 'x' * 32
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), worker.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, payload, token='x' * 32):
        request = urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}/embed', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        return urllib.request.urlopen(request)

    def test_normalized_vector_and_same_image_stability(self):
        data = io.BytesIO()
        worker.Image.new('RGB', (80, 32), 'orange').save(data, 'JPEG')
        image = base64.b64encode(data.getvalue()).decode()
        with self.request({'images': [image, image]}) as response:
            result = json.load(response)
        self.assertEqual(result['model'], worker.MODEL_ID)
        self.assertEqual(len(result['vectors'][0]), 384)
        self.assertAlmostEqual(sum(v*v for v in result['vectors'][0]), 1, places=5)
        self.assertEqual(result['vectors'][0], result['vectors'][1])

    def test_unauthorized_and_bad_images(self):
        for payload, token, status in [({'images': ['invalid']}, 'wrong', 401), ({'images': ['invalid']}, 'x'*32, 400), ({'images': ['x']*3}, 'x'*32, 400)]:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request(payload, token)
            self.assertEqual(error.exception.code, status)

    def test_busy_is_bounded(self):
        worker.slot.acquire()
        try:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request({'images': ['ignored']})
            self.assertEqual(error.exception.code, 429)
        finally:
            worker.slot.release()


if __name__ == '__main__':
    unittest.main()
