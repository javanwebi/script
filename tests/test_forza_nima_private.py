#!/usr/bin/env python3
"""Offline source checks for Nima/Piper deploy candidate. No model files/network."""
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]

class NimaCandidateTests(unittest.TestCase):
    def test_source_compiles_without_importing_heavy_model(self):
        script=ROOT/"scripts/forza_nima_voice_http.py"
        compile(script.read_text(encoding="utf-8"),str(script),"exec")

    def test_pinned_original_gyro_voice_and_no_audio_disk_cache(self):
        docker=(ROOT/"Dockerfile.forza-nima").read_text(encoding="utf-8")
        worker=(ROOT/"scripts/forza_nima_voice_http.py").read_text(encoding="utf-8")
        self.assertIn("fa_IR-gyro-medium.onnx",docker)
        self.assertIn("fa/fa_IR/gyro/medium/",docker)
        self.assertIn("37dfae43c82ee38ca9e6aac4ffef76a74d6b282ccbc397b27761f35d355c99ba",docker)
        self.assertIn("piper-nima-gyro-medium",worker)
        self.assertIn("io.BytesIO()",worker)
        self.assertIn("application/x-forza-wav-frames",worker)
        self.assertIn("synthesis_slot = threading.BoundedSemaphore(1)",worker)
        self.assertNotIn("open('/tmp/",worker)
        self.assertNotIn("write_bytes(",worker)

    def test_canary_does_not_modify_site_or_voice(self):
        script=ROOT/"ops/forza-nima-private-canary-vps.sh"
        subprocess.run(["bash","-n",str(script)],check=True,capture_output=True)
        src=script.read_text(encoding="utf-8")
        self.assertIn("teacher_dataset_generation_running",src)
        self.assertIn("piper-nima-gyro-medium",src)
        for forbidden in ("docker stop \"$LIVE\"", "docker restart \"$SITE\"",
                          "sanatpish-deploy","docker system prune","git reset --hard"):
            self.assertNotIn(forbidden,src)

    def test_guarded_live_switch_and_rollback_are_syntax_safe(self):
        for name in ("forza-nima-go-live-vps.sh", "forza-nima-rollback-vps.sh"):
            path=ROOT/"ops"/name
            subprocess.run(["bash","-n",str(path)],check=True,capture_output=True)
            src=path.read_text(encoding="utf-8")
            self.assertIn("forza-voice-promote.lock",src)
            self.assertIn("forza-nima-rollback-container",src)
            self.assertNotIn("docker volume rm",src)
            self.assertNotIn("docker system prune",src)
            self.assertNotIn("git reset --hard",src)
        live=(ROOT/"ops/forza-nima-go-live-vps.sh").read_text(encoding="utf-8")
        self.assertIn("teacher_dataset_generation_running",live)
        self.assertIn("FORZA_VOICE_ENGINE=nima",live)
        self.assertIn("FORZA_NIMA_LIVE_OK",live)
        self.assertIn("FORZA_NIMA_FAILED_ROLLING_BACK",live)
        self.assertIn("piper-nima-gyro-medium",live)
        rollback=(ROOT/"ops/forza-nima-rollback-vps.sh").read_text(encoding="utf-8")
        self.assertIn("pocket-farsi-v2",rollback)
        self.assertIn("FORZA_POCKET_ROLLBACK_PASS",rollback)

    def test_live_switch_rebuilds_stale_checked_out_app_before_voice_cutover(self):
        deploy=ROOT/"ops/sanatpish-deploy.sh"
        live=ROOT/"ops/forza-nima-go-live-vps.sh"
        for script in (deploy,live):
            subprocess.run(["bash","-n",str(script)],check=True,capture_output=True)
        source=deploy.read_text(encoding="utf-8")
        self.assertIn('SANATPISH_DEPLOY_REBUILD_CURRENT:-0',source)
        self.assertIn('Rebuilding already checked-out revision',source)
        self.assertIn('npm run lint',source)
        self.assertIn('npm run build',source)
        self.assertIn('docker start "$CONTAINER"',source)
        promotion=live.read_text(encoding="utf-8")
        self.assertIn('SANATPISH_DEPLOY_REBUILD_CURRENT=1 bash "$APP/ops/sanatpish-deploy.sh"',promotion)
        self.assertIn('voice_info_route_missing_after_checked_rebuild',promotion)
        self.assertIn('FORZA_NIMA_STALE_APP_DETECTED',promotion)
        self.assertIn("http://127.0.0.1:3001/api/ai/forza-voice-info",promotion)
        self.assertIn("if ! voice_info_ready; then",promotion)
        # Never mask an HTML SPA fallback as a valid voice-info API response.
        self.assertIn('json.loads(sys.stdin.read())',promotion)
        self.assertIn('x.get("voice")=="pocket-farsi-v2"',promotion)
        self.assertLess(promotion.index('voice_info_route_missing_after_checked_rebuild'),
                        promotion.index('docker stop -t 15 "$LIVE"'))

    def test_client_uses_nima_only_when_server_advertises_it(self):
        frontend=(ROOT/"src/components/forza/AiForzaCallExperience.tsx").read_text()
        backend=(ROOT/"server.ts").read_text()
        self.assertIn("new ForzaIncrementalSpeechText()",frontend)
        self.assertIn("const useNima=voiceModeRef.current==='piper-nima-gyro-medium'",frontend)
        self.assertIn("await speechQueue",frontend)
        self.assertIn("await Promise.all(playbackJobs)",frontend)
        self.assertIn("phase=nima-incremental-finished",frontend)
        self.assertIn("incrementalSpeech:forzaVoiceEngine==='piper-nima-gyro-medium'",backend)
        self.assertIn("privatePiperGreeting()",backend)
        self.assertNotIn("privateAmirGreeting()",backend)

if __name__=="__main__":
    unittest.main()
