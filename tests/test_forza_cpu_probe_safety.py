#!/usr/bin/env python3
"""Static safety and Bash syntax regression for VPS-only FORZA CPU probes."""
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "ops" / "forza-pocket-g2p-kv-architecture-probe-vps.sh"
ACOUSTIC = ROOT / "ops" / "forza-pocket-flow-mimi-ab-vps.sh"


class ForzaCpuProbeSafety(unittest.TestCase):
    def test_bash_syntax(self):
        if shutil.which("bash") is None:
            self.skipTest("bash not present")
        for path in (KV, ACOUSTIC):
            with self.subTest(path=path.name):
                subprocess.run(["bash", "-n", str(path)], check=True, capture_output=True)

    def test_hf_cli_is_single_docker_command(self):
        s = KV.read_text(encoding="utf-8")
        self.assertIn('--entrypoint hf "$PARENT" \\\n  download "$MODEL" --include', s)
        self.assertNotRegex(s, r"\\\\\n\s*#")
        self.assertIn("onnx/g2p_*_kv.onnx*", s)
        self.assertIn("FORZA_G2P_KV_RESULT", (ROOT / "scripts" / "forza_g2p_kv_cpu_probe.py").read_text(encoding="utf-8"))

    def test_acoustic_candidate_does_not_replace_live_service(self):
        s = ACOUSTIC.read_text(encoding="utf-8")
        self.assertIn("forza-pocket-cpu-gate-after-amir-vps.sh", s)
        self.assertIn("FORZA_GATE_FIXED_SEED=12345", s)
        self.assertIn("wav_sha256_changed", s)
        self.assertIn("FORZA_GATE_OVERLAP_MIMI=", s)
        self.assertIn("flow_intra2", s)
        self.assertNotRegex(s, r"docker\s+(stop|restart|rm|update)\s+['\"]?\$?(LIVE|SITE|forza-voice|sanatpish-new)\b")


if __name__ == "__main__":
    unittest.main()
