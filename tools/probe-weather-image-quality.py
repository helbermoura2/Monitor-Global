"""Bounded public-source comparison. No credentials, recolouring or generated weather."""
import base64
import concurrent.futures
import datetime as dt
import io
import json
import math
from pathlib import Path
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path('/tmp/weather-image-quality')
ROOT.mkdir(exist_ok=True)
NOW = dt.datetime.now(dt.timezone.utc)
BASE = 'https://gibs.earthdata.nasa.gov/'
LAYER = 'GOES-East_ABI_Band13_Clean_Infrared'


def read(url, limit=5_000_000):
    request = urllib.request.Request(url, headers={'User-Agent': 'MonitorGlobal/source-quality-check'})
    with urllib.request.urlopen(request, timeout=15) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Response exceeds limit')
        return data


iso = lambda t: t.replace(microsecond=0).isoformat().replace('+00:00', 'Z')
query = dict(SERVICE='WMTS', REQUEST='DescribeDomains', VERSION='1.0.0', LAYER=LAYER,
             TILEMATRIXSET='GoogleMapsCompatible_Level7', TIME=iso(NOW-dt.timedelta(hours=2))+'/'+iso(NOW))
xml = read(BASE+'wmts/epsg3857/best/wmts.cgi?'+urllib.parse.urlencode(query, safe='/:'))
times = set()
for node in ET.fromstring(xml).iter():
    if node.tag.rsplit('}', 1)[-1] != 'Domain':
        continue
    for part in (node.text or '').split(','):
        values = part.strip().split('/')
        if len(values) not in (1, 3) or len(values) == 3 and values[2] not in ('PT10M', 'PT600S'):
            continue
        start = dt.datetime.fromisoformat(values[0].replace('Z', '+00:00'))
        end = dt.datetime.fromisoformat(values[1].replace('Z', '+00:00')) if len(values) == 3 else start
        while end >= start and end <= NOW and NOW-end <= dt.timedelta(minutes=90):
            times.add(end)
            end -= dt.timedelta(minutes=10)
if not times:
    raise SystemExit('No producer-advertised satellite frame within 90 minutes')


def image_url(width, when):
    radius = 6378137
    merc = lambda lat: math.log(math.tan(math.pi/4+math.radians(lat)/2))
    height = round(width*(merc(-17)-merc(-27))/math.radians(16))
    bbox = ','.join(str(v) for v in (radius*math.radians(-54), radius*merc(-27), radius*math.radians(-38), radius*merc(-17)))
    args = dict(SERVICE='WMS', VERSION='1.1.1', REQUEST='GetMap', LAYERS=LAYER, STYLES='', SRS='EPSG:3857',
                BBOX=bbox, WIDTH=width, HEIGHT=height, FORMAT='image/png', TRANSPARENT='TRUE', TIME=iso(when))
    return BASE+'wms/epsg3857/best/wms.cgi?'+urllib.parse.urlencode(args)


selected = None
for when in sorted(times, reverse=True)[:4]:
    try:
        data = read(image_url(1024, when))
        image = Image.open(io.BytesIO(data)).convert('RGBA')
        opaque = sum(a > 0 for a in image.getchannel('A').getdata())/(image.width*image.height)
        print('SATELLITE_CANDIDATE '+json.dumps({'time': iso(when), 'ageMinutes': round((NOW-when).total_seconds()/60, 1), 'coverage': opaque}), flush=True)
        if opaque >= .99:
            selected = when
            (ROOT/'gibs-original-1024.png').write_bytes(data)
            break
    except Exception as error:
        print('SATELLITE_CANDIDATE_ERROR '+str(error), flush=True)
if selected is None:
    raise SystemExit('No complete source image confirmed')
data = read(image_url(512, selected))
(ROOT/'gibs-original-512.png').write_bytes(data)
for name in ('gibs-original-512', 'gibs-original-1024'):
    image = Image.open(ROOT/(name+'.png')).convert('RGBA')
    colours = image.getcolors(image.width*image.height)
    dark = sum(count for count, rgba in colours if rgba[3] > 0 and max(rgba[:3]) < 35)
    print('SATELLITE_IMAGE '+json.dumps({'name': name, 'time': iso(selected), 'width': image.width, 'height': image.height, 'darkPixels': dark}), flush=True)
    image.thumbnail((640, 500)); out = io.BytesIO(); image.convert('RGB').save(out, format='JPEG', quality=80)
    print('SOURCE_QUALITY_IMAGE_'+name.replace('-', '_')+' '+base64.b64encode(out.getvalue()).decode(), flush=True)

try:
    page = read('https://www.star.nesdis.noaa.gov/goes/sector_band.php?band=13&length=12&sat=G19&sector=ssa').decode()
    matches = re.findall(r'(?:https?:)?//cdn\.star\.nesdis\.noaa\.gov/[^\s\"\'<>]+', page)
    timestamps = sorted(set(re.findall(r'2026\d{7}', page)))
    print('NOAA_COMPARISON '+json.dumps({'imageUrls': matches[:3], 'latestFilenameTime': timestamps[-1:] or None,
          'note': 'Same-channel comparison only; a different palette does not establish better accuracy.'}), flush=True)
except Exception as error:
    print('NOAA_COMPARISON_UNAVAILABLE '+str(error), flush=True)
