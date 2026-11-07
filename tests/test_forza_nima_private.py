#!/usr/bin/env python3
"""Offline source checks for Nima/Piper deploy candidate. No model files/network."""
from pathlib import Path
import subprocess
import sys
import types
import unittest
from unittest.mock import patch

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
        self.assertIn("queue_condition = threading.Condition()",worker)
        self.assertIn("queue_waiters = deque()",worker)
        self.assertIn("MAX_QUEUE_WAIT_SEC = 2.5",worker)
        self.assertIn("X-Forza-Queue-Ms",worker)
        self.assertIn("client_disconnected",worker)
        self.assertNotIn("open('/tmp/",worker)
        self.assertNotIn("write_bytes(",worker)

    def test_private_worker_provides_privacy_safe_error_identity_and_bounded_fifo(self):
        # Import with a fake Piper module; no ONNX model, keys, network or WAV.
        worker=(ROOT/"scripts/forza_nima_voice_http.py").read_text(encoding="utf-8")
        scope={"__name__":"forza_nima_offline_probe"}
        fake_piper=types.ModuleType("piper")
        fake_piper.PiperVoice=object
        with patch.dict(sys.modules,{"piper":fake_piper}):
            exec(compile(worker,"forza_nima_voice_http.py","exec"),scope)
        try:
            raise RuntimeError("confidential customer words must never be logged")
        except RuntimeError as exc:
            diagnostic=scope["generation_error_diagnostics"](exc)
        self.assertIn("type=RuntimeError",diagnostic)
        self.assertIn("module=builtins",diagnostic)
        self.assertIn("site=",diagnostic)
        self.assertNotIn("confidential",diagnostic)
        self.assertNotIn("/app/",diagnostic)
        self.assertNotIn("customer words",diagnostic)
        spoken=scope["spoken_text"]("**قطر** تسمه SPA 1250 برابر 10*20 است. https://example.com/test")
        self.assertIn("SPA 1250",spoken)
        self.assertIn("10 در 20",spoken)
        self.assertNotIn("*",spoken)
        self.assertNotIn("https",spoken)
        self.assertNotIn("example.com",spoken)

        # Filling the bounded admission pool fails fast, without allowing
        # an unbounded queue or simultaneous inference on the same model.
        scope["queue_busy"]=True
        scope["queue_waiters"].extend(object() for _ in range(scope['MAX_WAITING_TOTAL']-1))
        wait,error=scope["acquire_inference"](lambda:False)
        self.assertIsNone(wait)
        self.assertEqual(error,"voice_busy")
        scope["queue_waiters"].clear()
        scope["MAX_QUEUE_WAIT_SEC"]=0.001
        wait,error=scope["acquire_inference"](lambda:False)
        self.assertIsNone(wait)
        self.assertEqual(error,"voice_queue_timeout")

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

    def test_main_deploy_calls_private_voice_from_pinned_stage_with_rollback(self):
        pinned=ROOT/"ops/deploy-forza-nima-pinned-vps.sh"
        bluegreen=ROOT/"ops/deploy-main-bluegreen-vps.sh"
        subprocess.run(["bash","-n",str(pinned)],check=True,capture_output=True)
        subprocess.run(["bash","-n",str(bluegreen)],check=True,capture_output=True)
        s=pinned.read_text(encoding="utf-8")
        b=bluegreen.read_text(encoding="utf-8")
        self.assertIn("com.sanatpish.forza.source-sha256",s)
        self.assertIn("FORZA_NIMA_PINNED_CANARY_PASS",s)
        self.assertIn("FORZA_NIMA_PINNED_ROLLBACK_START",s)
        self.assertIn("FORZA_NIMA_PINNED_RELEASE_OK",s)
        # Bare sha256:... values are not valid Dockerfile FROM references in this build.
        # Keep the offline base pinned to the running image, using a local tag.
        self.assertIn('docker tag "$LIVE_IMAGE_ID" "$LOCAL_BASE_IMAGE"',s)
        self.assertIn('--build-arg "FORZA_BASE_IMAGE=$LOCAL_BASE_IMAGE"',s)
        self.assertNotIn('--build-arg "FORZA_BASE_IMAGE=$LIVE_IMAGE_ID"',s)
        self.assertIn('docker rename "$LIVE" "$BACKUP"',s)
        self.assertIn('docker start "$LIVE"',s)
        self.assertIn('bash "$STAGE/ops/deploy-forza-nima-pinned-vps.sh" "$EXPECTED" "$NAME" "$NETWORK" "$STAGE"',b)
        self.assertLess(b.index("PINNED PRIVATE NIMA CANARY"),b.index("SUCCESS=1"))
        for forbidden in ("docker volume rm","docker system prune","git reset --hard"):
            self.assertNotIn(forbidden,s)

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
        self.assertIn("new ForzaNimaBufferedSpeech({",frontend)
        self.assertIn("await activeNimaBuffer.finish()",frontend)
        self.assertIn("bufferedNima?.cancel()",frontend)
        self.assertIn("maxConcurrent:2",frontend)
        self.assertIn("initialBufferSeconds:0.35",frontend)
        self.assertIn("maximumInitialWaitMs:40",frontend)
        self.assertIn("phase=nima-incremental-finished",frontend)
        self.assertIn("incrementalSpeech:forzaVoiceEngine==='piper-nima-gyro-medium'",backend)
        self.assertIn("privatePiperGreeting()",backend)
        self.assertNotIn("privateAmirGreeting()",backend)

if __name__=="__main__":
    unittest.main()
