#!/usr/bin/env python3
"""Long-lived offline Piper Amir synthesizer. Loads ONNX once per server instance.

One JSON request per stdin line, one JSON response per stdout line.
No external requests or usage-metered TTS provider.
"""
import base64
import io
import json
import sys
import traceback
import wave
from pathlib import Path

from piper import PiperVoice

ROOT = Path.cwd()
MODEL = ROOT / 'public/forza-models/amir/fa_IR-amir-medium.onnx'


def emit(data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    sys.stdout.flush()


def main():
    voice = PiperVoice.load(str(MODEL), config_path=str(MODEL) + '.json')
    emit({'type': 'ready', 'model': 'fa_IR-amir-medium'})
    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request.get('id')
            phrase = request.get('text', '')
            if not isinstance(phrase, str) or not phrase.strip() or len(phrase) > 240:
                emit({'id': request_id, 'error': 'invalid_text'})
                continue
            audio_bytes = io.BytesIO()
            with wave.open(audio_bytes, 'wb') as wav_file:
                voice.synthesize_wav(phrase, wav_file)
            wav = audio_bytes.getvalue()
            if (len(wav) < 44 or len(wav) > 5_000_000
                    or wav[:4] != b'RIFF' or wav[8:12] != b'WAVE'):
                emit({'id': request_id, 'error': 'invalid_wav'})
                continue
            emit({'id': request_id, 'audio': base64.b64encode(wav).decode('ascii')})
        except Exception as error:
            print('[FORZA Amir worker] synthesis failed:', str(error)[:140], file=sys.stderr)
            emit({'id': request.get('id') if isinstance(locals().get('request'), dict) else None,
                  'error': 'synthesis_failed'})


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('[FORZA Amir worker] startup failed:', str(error)[:140], file=sys.stderr)
        sys.exit(1)
