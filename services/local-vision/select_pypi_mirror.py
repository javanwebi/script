"""Probe both a mirror index and a real wheel before starting a long Docker build."""
import hashlib
import os
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser

DEFAULTS = ('https://pypi.tuna.tsinghua.edu.cn/simple/', 'https://mirrors.aliyun.com/pypi/simple/')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(value for key, value in attrs if key == 'href' and value)


def allowed_url(url):
    parsed = urllib.parse.urlsplit(url)
    return parsed.scheme == 'https' and not parsed.username and not parsed.password and parsed.hostname != 'files.pythonhosted.org'


def read(url, limit):
    if not allowed_url(url):
        raise ValueError('HTTPS mirror download required')
    with urllib.request.urlopen(url, timeout=8) as response:
        if not allowed_url(response.url):
            raise ValueError('Mirror redirects to unavailable origin')
        raw = response.read(limit+1)
        if len(raw) > limit:
            raise ValueError('Probe response too large')
        return raw, response.url


def probe(index):
    if not allowed_url(index):
        raise ValueError('Invalid mirror origin')
    index = index.rstrip('/')+'/'
    page, final = read(urllib.parse.urljoin(index, 'filelock/'), 2_000_000)
    parser = Links()
    parser.feed(page.decode('utf8'))
    # Test an actual small wheel, not just the index HTML that worked on the failed CDN.
    wheels = [link for link in parser.links if urllib.parse.urlsplit(link).path.endswith('filelock-3.19.1-py3-none-any.whl')]
    if not wheels:
        raise ValueError('Probe wheel unavailable')
    url = urllib.parse.urljoin(final, wheels[0])
    data, _ = read(url, 512_000)
    expected = urllib.parse.parse_qs(urllib.parse.urlsplit(url).fragment).get('sha256', [None])[0]
    if not expected or hashlib.sha256(data).hexdigest() != expected or not data.startswith(b'PK'):
        raise ValueError('Probe wheel integrity failed')
    return index


if __name__ == '__main__':
    candidates = [os.environ['VISION_PYPI_INDEX_URL']] if os.environ.get('VISION_PYPI_INDEX_URL') else DEFAULTS
    for index in candidates:
        try:
            selected = probe(index)
            print('PYPI_WHEEL_PROBE_OK '+urllib.parse.urlsplit(selected).hostname, file=sys.stderr)
            print(selected)
            break
        except Exception as error:
            # Do not log credentials supplied through an invalid override URL.
            print('PYPI_WHEEL_PROBE_FAILED '+type(error).__name__, file=sys.stderr)
    else:
        raise SystemExit('NO_REACHABLE_PYPI_MIRROR: no build started')
