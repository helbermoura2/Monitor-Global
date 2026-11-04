"""Read-only NASA source proof, with bounded frames and no repository image storage."""
import datetime as dt, urllib.request as request, urllib.parse as parse, xml.etree.ElementTree as ET, math, io
from pathlib import Path
from PIL import Image
now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
root='https://gibs.earthdata.nasa.gov/'
layer='GOES-East_ABI_Band13_Clean_Infrared'
def read(url):
    with request.urlopen(url,timeout=15) as r: return r.read()
iso=lambda x:x.isoformat().replace('+00:00','Z')
q={'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':layer,'TILEMATRIXSET':'GoogleMapsCompatible_Level7','TIME':iso(now-dt.timedelta(hours=4))+'/'+iso(now)}
xml=read(root+'wmts/epsg3857/best/wmts.cgi?'+parse.urlencode(q,safe='/:'))
ends=[]
for e in ET.fromstring(xml).iter():
    if e.tag.rsplit('}',1)[-1]!='Domain': continue
    for item in (e.text or '').split(','):
        parts=item.split('/')
        try: ends.append(dt.datetime.fromisoformat(parts[1 if len(parts)>1 else 0].replace('Z','+00:00')))
        except ValueError: pass
assert ends,'No producer timestamps'
merc=lambda lat:math.log(math.tan(math.pi/4+math.radians(lat)/2))
w,s,e,n=-54,-27,-38,-17
height=round(512*(merc(n)-merc(s))/math.radians(e-w))
bbox=','.join(f'{v:.2f}' for v in [6378137*math.radians(w),6378137*merc(s),6378137*math.radians(e),6378137*merc(n)])
for i in range(6):
    at=max(ends)-dt.timedelta(minutes=10*i)
    q={'SERVICE':'WMS','VERSION':'1.1.1','REQUEST':'GetMap','LAYERS':layer,'STYLES':'','SRS':'EPSG:3857','BBOX':bbox,'WIDTH':'512','HEIGHT':str(height),'FORMAT':'image/png','TRANSPARENT':'TRUE','TIME':iso(at)}
    data=read(root+'wms/epsg3857/best/wms.cgi?'+parse.urlencode(q))
    image=Image.open(io.BytesIO(data)).convert('RGBA')
    coverage=sum(a>0 for a in image.getchannel('A').getdata())/(512*height)
    print({'time':iso(at),'size':image.size,'coverage':coverage},flush=True)
    if image.size==(512,height) and coverage>.999:
        Path('/tmp/tv-satellite-real.png').write_bytes(data)
        Path('/tmp/tv-satellite-time.txt').write_text(str(int(at.timestamp()*1000)))
        Path('/tmp/tv-satellite-now.txt').write_text(str(int(now.timestamp()*1000)))
        Path('/tmp/tv-satellite-legend.png').write_bytes(read(root+'legends/Clean_Longwave_Infrared_Window_Band_H.png'))
        break
else: raise SystemExit('No complete current regional source image')
