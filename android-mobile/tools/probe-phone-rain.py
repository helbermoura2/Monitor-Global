"""Bounded public smoke check: metadata and two PNGs, no keys or alert delivery."""
import json
import time
import urllib.request

BASE = 'https://black-sky-9ba0.terrestre.workers.dev'


def read(path):
    request = urllib.request.Request(BASE + path, headers={'User-Agent': 'MonitorGlobalMobilePreviewCheck'})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read(150001)
        if len(data) > 150000:
            raise RuntimeError('Oversized public response')
        return data


metadata = json.loads(read('/rainbow-snapshot'))
snapshot = metadata.get('snapshot')
if metadata.get('ok') is not True or not isinstance(snapshot, int) or snapshot % 600 or not -60 <= time.time() - snapshot <= 1800:
    raise RuntimeError('No recent precipitation snapshot available')
for offset in (0, 7200):
    image = read(f'/rainbow-tile/{snapshot}/{offset}/6/23/36')
    if not image.startswith(b'\x89PNG\r\n\x1a\n'):
        raise RuntimeError('Precipitation frame unavailable at offset ' + str(offset))
    print(json.dumps({'offsetSeconds': offset, 'pngBytes': len(image), 'source': 'Rainbow Weather', 'snapshot': snapshot}))
