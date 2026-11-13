import importlib.util
import json
import base64
import unittest
spec = importlib.util.spec_from_file_location('stream', 'scripts/forza_diba_stream_worker.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FakeRecognizer:
    def __init__(self): self.count = 0
    def AcceptWaveform(self, pcm):
        self.count += 1
        return self.count == 2
    def PartialResult(self): return json.dumps({'partial': 'بلبرینگ'})
    def Result(self): return json.dumps({'text': 'بلبرینگ 6203'})
    def FinalResult(self): return json.dumps({'text': 'اصلاح نهایی'})

class StreamingProtocol(unittest.TestCase):
    def setUp(self): self.sessions = module.Sessions(FakeRecognizer)
    def audio(self, sid):
        return self.sessions.accept({'id': sid, 'op': 'audio', 'pcm': base64.b64encode(b'\0'*4000).decode()})
    def test_partials_and_finals_are_separate(self):
        self.sessions.accept({'id': 'a', 'op': 'open'})
        self.assertFalse(self.audio('a')['final'])
        self.assertTrue(self.audio('a')['final'])
    def test_sessions_do_not_share_recognizers(self):
        for sid in ['a','b']: self.sessions.accept({'id': sid, 'op': 'open'})
        self.audio('a')
        self.assertFalse(self.audio('b')['final'])
        self.assertTrue(self.audio('a')['final'])
    def test_flush_returns_authoritative_final_and_starts_fresh_segment(self):
        self.sessions.accept({'id':'a','op':'open'})
        self.audio('a')
        result=self.sessions.accept({'id':'a','op':'flush'})
        self.assertTrue(result['flushed'])
        self.assertEqual(result['text'],'اصلاح نهایی')
        self.assertFalse(self.audio('a')['final'])
    def test_close_releases_session_and_capacity_is_bounded(self):
        for n in range(20): self.sessions.accept({'id':str(n),'op':'open'})
        with self.assertRaises(ValueError): self.sessions.accept({'id':'extra','op':'open'})
        self.sessions.accept({'id':'0','op':'close'})
        self.sessions.accept({'id':'extra','op':'open'})
        self.assertNotIn('0',self.sessions.sessions)
    def test_invalid_pcm_is_rejected(self):
        self.sessions.accept({'id':'a','op':'open'})
        for data in [b'x',b'',b'0'*8194]:
            with self.assertRaises(ValueError):
                self.sessions.accept({'id':'a','op':'audio','pcm':base64.b64encode(data).decode()})

if __name__=='__main__': unittest.main()
