import ast
import unittest
from pathlib import Path

class MemoryLifecycleTest(unittest.TestCase):
    def test_g2p_released_before_each_waveform(self):
        events = []
        class FakeEngine:
            def synthesize(self, text, voice):
                self.assert_released = not hasattr(self, '_g2p')
                events.append('waveform')
                return text
        tree = ast.parse(Path('scripts/forza_pocket_worker.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'MemoryBoundTts')
        scope = {'OnnxTts': FakeEngine, 'release_unused_memory': lambda: events.append('release')}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<worker-class>', 'exec'), scope)
        engine = scope['MemoryBoundTts']()
        for text in ['first', 'second']:
            engine._g2p = object()
            self.assertEqual(engine.synthesize(text, 'same-voice'), text)
            self.assertTrue(engine.assert_released)
        self.assertEqual(events, ['release', 'waveform', 'release', 'waveform'])

if __name__ == '__main__':
    unittest.main()
