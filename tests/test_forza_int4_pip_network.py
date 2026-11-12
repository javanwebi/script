#!/usr/bin/env python3
"""Guard the disposable Pocket INT4 Docker build against pip timeouts."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "ops/forza-pocket-int4-original-cpu-vps.sh"


class SafePipRecovery(unittest.TestCase):
    def test_retry_timeout_cached_download_without_customer_audio(self):
        source=SRC.read_text(encoding="utf-8")
        self.assertIn("--timeout 180 --retries 10",source)
        self.assertIn("forza-int4-pip-download-cache",source)
        self.assertIn("--mount=type=cache",source)
        self.assertIn("--only-binary=:all:",source)
        self.assertIn("'onnxruntime==1.23.2'",source)
        self.assertNotIn("pip install --no-cache-dir",source)
        self.assertIn('docker build --pull=false --network=default',source)
        self.assertIn('docker build --pull=false --network=host',source)
        self.assertIn("FORZA_INT4_PIP_BUILD_RETRY",source)
        self.assertIn("FORZA_INT4_PIP_BUILD_OK",source)
        self.assertIn("FORZA_INT4_RESULT profile=",source)
        self.assertIn("31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833",source)
        self.assertIn('for name in "$LIVE" "$SITE"; do',source)
        self.assertIn('docker rm -f "$CANDIDATE" "$QUANT_CONTAINER"',source)
        for forbidden in ('docker stop "$LIVE"', 'docker restart "$LIVE"',
                          'docker rm -f "$LIVE"', 'docker restart "$SITE"',
                          'docker system prune', 'docker volume rm'):
            self.assertNotIn(forbidden,source)


if __name__ == "__main__":
    unittest.main()
