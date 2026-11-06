"""Bounded, read-only comparison of public satellite delivery paths."""
import concurrent.futures
import datetime as dt
import io
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from PIL import Image

NOW=dt.datetime.now(dt.timezone.utc)
def read(url,limit=1500000):
    req=urllib.request.Request(url,headers={'User-Agent':'MonitorGlobal/satellite-freshness-check'})
    with urllib.request.urlopen(req,timeout=18) as r:
        data=r.read(limit+1)
        if len(data)>limit: raise ValueError('Oversized source')
        return data
def report(name,fn):
    try: print(name+' '+json.dumps(fn(),ensure_ascii=False),flush=True)
    except Exception as e: print(name+' '+json.dumps({'error':str(e)[:250]}),flush=True)
def nasa():
    iso=lambda t:t.replace(microsecond=0).isoformat().replace('+00:00','Z')
    url='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?'+urllib.parse.urlencode({'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':'GOES-East_ABI_Band13_Clean_Infrared','TILEMATRIXSET':'GoogleMapsCompatible_Level7','TIME':iso(NOW-dt.timedelta(hours=2))+'/'+iso(NOW)},safe='/:')
    domains=[n.text for n in ET.fromstring(read(url)).iter() if n.tag.rsplit('}',1)[-1]=='Domain']
    return {'checkedAt':iso(NOW),'advertisedDomains':domains}
def noaa():
    page=read('https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=ssa&band=13&length=12').decode()
    urls=re.findall(r'(?:https?:)?//cdn\.star\.nesdis\.noaa\.gov/[^\s\"\'<>]+',page)
    scripts=re.findall(r'<script[^>]+src=[\"\']([^\"\']+)',page)
    times=sorted(set(re.findall(r'2026\d{7}',page)))
    useful=[line.strip()[:1200] for line in page.splitlines() if any(k in line.lower() for k in ['arraylinks','imagelist','latlon','sector.js','projection','image_urls','var geog','var sat','var sector'])]
    image_url=next((u for u in reversed(urls) if '.jpg' in u or '.png' in u),None)
    result={'filenameTimes':times[-4:],'scripts':scripts,'source':useful[:12],'imageUrls':urls[-3:]}
    if image_url:
        image_url='https:'+image_url if image_url.startswith('//') else image_url
        data=read(image_url,4000000);im=Image.open(io.BytesIO(data));result['image']={'url':image_url,'size':im.size,'bytes':len(data)}
    return result
def realearth():
    raw=read('https://realearth.ssec.wisc.edu/api/products?search=B13&timespan=-1h')
    data=json.loads(raw)
    if isinstance(data,dict): data=data.get('products',data)
    return {'response':data}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(lambda p:report(*p),[('NASA',nasa),('NOAA',noaa),('REALEARTH',realearth)]))
