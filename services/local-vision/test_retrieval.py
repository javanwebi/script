import io
import subprocess
import unittest
from unittest.mock import patch
import cv2
import numpy as np
from retrieval import foreground, crop, geometric, jpeg, markings


class RetrievalTests(unittest.TestCase):
    def test_foreground_crop_retains_object_and_blank_has_no_proposal(self):
        image = np.full((240, 320, 3), 255, np.uint8)
        cv2.rectangle(image, (110, 70), (210, 170), (25, 30, 35), -1)
        box = foreground(image)
        self.assertIsNotNone(box)
        self.assertLess(box['x'], 110/320)
        self.assertGreater(box['x']+box['width'], 210/320)
        self.assertLess(crop(image, box).shape[0], 150)
        self.assertIsNone(foreground(np.full_like(image, 255)))

    def test_cluttered_border_does_not_claim_an_object_crop(self):
        noise = np.random.default_rng(12).integers(0, 256, (240, 320, 3), dtype=np.uint8)
        self.assertIsNone(foreground(noise))

    def test_geometry_supports_distributed_correspondence_but_not_unrelated_or_blank(self):
        image = np.random.default_rng(3).integers(0, 256, (320, 320, 3), dtype=np.uint8)
        same = geometric(jpeg(image), jpeg(image))
        self.assertTrue(same['supported'])
        self.assertGreater(same['inliers'], 20)
        rotated = cv2.warpAffine(image, cv2.getRotationMatrix2D((160, 160), 12, 0.9), (320, 320))
        self.assertTrue(geometric(jpeg(image), jpeg(rotated))['supported'])
        other = np.random.default_rng(99).integers(0, 256, image.shape, dtype=np.uint8)
        self.assertFalse(geometric(jpeg(image), jpeg(other))['supported'])
        blank = np.full_like(image, 255)
        self.assertFalse(geometric(jpeg(blank), jpeg(blank))['supported'])

    def test_ocr_timeout_is_explicit_and_only_confident_code_text_is_retained(self):
        image = np.full((40, 80, 3), 255, np.uint8)
        with patch('retrieval.subprocess.run', side_effect=subprocess.TimeoutExpired('tesseract', 0.8)):
            self.assertEqual(markings(image), ([], False))
        result = subprocess.CompletedProcess([], 0, stdout=b'conf\ttext\n96\t6203ZZ\n40\t9999\n99\tBRAND\n')
        with patch('retrieval.subprocess.run', return_value=result) as run:
            text, available = markings(image)
            self.assertTrue(available)
            self.assertEqual(text, [{'text': '6203ZZ', 'confidence': 96}])
            self.assertEqual(run.call_args.kwargs['timeout'], 0.8)


if __name__ == '__main__':
    unittest.main()
