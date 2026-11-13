#!/usr/bin/env python3
"""Multiplexed, RAM-only 16kHz PCM recognition. No audio files or ffmpeg."""
import base64
import json
import os
import sys


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


class Sessions:
    def __init__(self, factory):
        self.factory = factory
        self.sessions = {}

    def accept(self, msg):
        sid = msg['id']
        op = msg['op']
        if op == 'close':
            self.sessions.pop(sid, None)
            return None
        if op == 'open':
            if sid in self.sessions or len(self.sessions) >= 20:
                raise ValueError('session_limit')
            self.sessions[sid] = self.factory()
            return {'id': sid, 'type': 'ready'}
        rec = self.sessions[sid]
        if op == 'flush':
            result = json.loads(rec.FinalResult())
            self.sessions[sid] = self.factory()
            return {'id': sid, 'type': 'result', 'text': result.get('text', ''), 'final': True, 'flushed': True}
        if op != 'audio':
            raise ValueError('invalid_operation')
        pcm = base64.b64decode(msg['pcm'], validate=True)
        if not pcm or len(pcm) > 8192 or len(pcm) % 2:
            raise ValueError('invalid_pcm')
        final = rec.AcceptWaveform(pcm)
        result = json.loads(rec.Result() if final else rec.PartialResult())
        return {'id': sid, 'type': 'result', 'text': result.get('text' if final else 'partial', ''), 'final': bool(final)}


def main():
    from vosk import Model, KaldiRecognizer, SetLogLevel
    SetLogLevel(-1)
    model = Model(os.environ.get('FORZA_STT_DIBA_MODEL_PATH', '/opt/diba-stt/model'))
    sessions = Sessions(lambda: KaldiRecognizer(model, 16000))
    emit({'type': 'worker_ready'})
    for line in sys.stdin:
        sid = ''
        try:
            msg = json.loads(line)
            sid = msg.get('id', '')
            result = sessions.accept(msg)
            if result is not None:
                emit(result)
        except Exception:
            # Never include PCM, transcript or exception messages in diagnostics.
            emit({'id': sid, 'type': 'error', 'code': 'diba_stream_failed'})


if __name__ == '__main__':
    main()
