"""FIFO admission without ONNX; opt-in real multi-process gyro regression."""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import socket
import signal
import tempfile
import subprocess
import sys
import threading
import time
import types
import unittest
import urllib.request
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]

class PoolTests(unittest.TestCase):
    def test_fifo_admits_configured_capacity_and_removes_disconnected_waiters(self):
        fake=types.ModuleType('piper');fake.PiperVoice=object
        scope={'__name__':'isolated_pool_probe'}
        with patch.dict(sys.modules,{'piper':fake}):
            exec(compile((ROOT/'scripts/forza_nima_voice_http.py').read_text(),'pool.py','exec'),scope)
        scope['WORKER_COUNT']=2;scope['MAX_WAITING_TOTAL']=4
        self.assertIsNone(scope['acquire_inference'](lambda:False)[1])
        self.assertIsNone(scope['acquire_inference'](lambda:False)[1])
        self.assertEqual(scope['queue_busy'],2)
        self.assertEqual(scope['acquire_inference'](lambda:True)[1],'client_gone')
        self.assertEqual(len(scope['queue_waiters']),0)
        order=[]
        def waiting(label):
            _,error=scope['acquire_inference'](lambda:False)
            if not error:order.append(label);scope['release_inference']()
        a=threading.Thread(target=waiting,args=('a',));a.start()
        deadline=time.monotonic()+1
        while not scope['queue_waiters'] and time.monotonic()<deadline:time.sleep(.001)
        b=threading.Thread(target=waiting,args=('b',));b.start()
        scope['release_inference']();a.join(2);b.join(2)
        self.assertEqual(order,['a','b']);self.assertEqual(scope['queue_busy'],1)
        scope['release_inference']();self.assertEqual(scope['queue_busy'],0)
        left,right=socket.socketpair()
        try:
            left.settimeout(10)
            handler=object.__new__(scope['Handler']);handler.connection=left
            start=time.monotonic();self.assertFalse(handler.client_disconnected())
            self.assertLess(time.monotonic()-start,.1)
            right.close();self.assertTrue(handler.client_disconnected())
        finally:left.close();right.close()

    @unittest.skipUnless(os.environ.get('FORZA_NIMA_TEST_MODEL'),'requires local verified Piper model')
    def test_real_two_worker_inference_and_health(self):
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
        env={**os.environ,'FORZA_NIMA_MODEL':os.environ['FORZA_NIMA_TEST_MODEL'],'FORZA_NIMA_WORKERS':'2','FORZA_NIMA_BIND':'127.0.0.1','PORT':str(port),'FORZA_VOICE_TOKEN':'isolated-private-test-credential'}
        log=tempfile.TemporaryFile()
        process=subprocess.Popen([sys.executable,str(ROOT/'scripts/forza_nima_voice_http.py')],env=env,stdout=log,stderr=log,start_new_session=True)
        base=f'http://127.0.0.1:{port}'
        try:
            ready=False
            for _ in range(600):
                if process.poll() is not None:
                    log.seek(0);raise AssertionError('worker exited: '+log.read().decode()[-2000:])
                try:
                    with urllib.request.urlopen(base+'/health',timeout=.5) as r:health=json.load(r)
                    if health['ok']:ready=True;break
                except OSError:pass
                time.sleep(.05)
            self.assertTrue(ready);self.assertEqual(health['workers'],2);self.assertEqual(health['onnx_threads_per_worker'],1)
            def request(_):
                start=time.monotonic()
                req=urllib.request.Request(base+'/speak',data=json.dumps({'text':'سلام، شماره فنی قطعه را بفرمایید.'}).encode(),headers={'Content-Type':'application/json','X-Forza-Voice-Token':env['FORZA_VOICE_TOKEN']})
                with urllib.request.urlopen(req,timeout=20) as r:
                    wav=r.read();self.assertEqual(r.status,200);self.assertEqual(r.headers['X-Forza-Voice'],'piper-nima-gyro-medium');self.assertEqual(wav[:4],b'RIFF');self.assertEqual(wav[8:12],b'WAVE')
                    return {'ms':round((time.monotonic()-start)*1000),'queue_ms':int(r.headers['X-Forza-Queue-Ms']),'inference_ms':int(r.headers['X-Forza-Inference-Ms']),'wav_bytes':len(wav)}
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as clients:
                results=list(clients.map(request,range(2)))
            print('FORZA_REAL_POOL '+json.dumps(results),flush=True)
        finally:
            # TERM is also forwarded to spawned workers for a clean isolated test.
            try:os.killpg(process.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=5)
            log.close()


if __name__=='__main__':unittest.main()
