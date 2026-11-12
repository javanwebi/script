import hashlib
import unittest
from unittest.mock import patch
import select_pypi_mirror as mirror


class MirrorTests(unittest.TestCase):
    def test_probe_fetches_real_wheel_and_checks_hash(self):
        data = b'PKtest-wheel'
        digest = hashlib.sha256(data).hexdigest()
        page = ('<a href="../../packages/filelock-3.19.1-py3-none-any.whl#sha256='+digest+'">wheel</a>').encode()
        with patch('select_pypi_mirror.read', side_effect=[(page, 'https://mirror.example/simple/filelock/'), (data, 'https://mirror.example/packages/wheel.whl')]) as read:
            self.assertEqual(mirror.probe('https://mirror.example/simple'), 'https://mirror.example/simple/')
            self.assertEqual(read.call_count, 2)

    def test_bad_integrity_is_not_a_successful_network_probe(self):
        page = b'<a href="../../filelock-3.19.1-py3-none-any.whl#sha256=invalid">wheel</a>'
        with patch('select_pypi_mirror.read', side_effect=[(page, 'https://mirror.example/simple/filelock/'), (b'PKbad', 'https://mirror.example/file.whl')]):
            with self.assertRaisesRegex(ValueError, 'integrity'):
                mirror.probe('https://mirror.example/simple/')

    def test_no_plain_http_credentials_or_blocked_cdn(self):
        for url in ['http://mirror.example/simple/', 'https://user:password@mirror.example/simple/', 'https://files.pythonhosted.org/wheel.whl']:
            self.assertFalse(mirror.allowed_url(url))
        self.assertTrue(mirror.allowed_url('https://mirror.example/simple/'))


if __name__ == '__main__':
    unittest.main()
