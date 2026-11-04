"""Read-only source check: no credentials, source images stay outside the repository."""
import urllib.request,urllib.parse,datetime,xml.etree.ElementTree as ET,io,json,base64,os
from pathlib import Path
from PIL import Image
now=datetime.datetime.now(datetime.timezone.utc)
layer='GOES-East_ABI_Band13_Clean_Infrared'
def read(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MonitorGlobal/satellite-source-check'}),timeout=45) as r:return r.read(),dict(r.headers)
base='https://gibs.earthdata.nasa.gov/'
query={'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':layer,'TILEMATRIXSET':'GoogleMapsCompatible_Level6','TIME':(now-datetime.timedelta(days=1)).date().isoformat()+'/'+now.date().isoformat()}
raw,headers=read(base+'wmts/epsg3857/best/wmts.cgi?'+urllib.parse.urlencode(query));text=raw.decode();print('DOMAINS '+text[:16000],flush=True)
try:
 root=ET.fromstring(raw)
 values=[e.text or '' for e in root.iter() if e.tag.rsplit('}',1)[-1]=='Domain']
 ends=[]
 for value in values:
  for part in value.split(','):
   pieces=part.strip().split('/')
   if len(pieces)>=2:
    try:ends.append(datetime.datetime.fromisoformat(pieces[1].replace('Z','+00:00')))
    except ValueError:pass
 frame=min(max(ends),now) if ends else now-datetime.timedelta(minutes=40)
except Exception:frame=now-datetime.timedelta(minutes=40)
frame=frame.replace(minute=frame.minute//10*10,second=0,microsecond=0)
for attempt in range(6):
 when=(frame-datetime.timedelta(minutes=10*attempt)).isoformat().replace('+00:00','Z')
 q={'SERVICE':'WMS','VERSION':'1.1.1','REQUEST':'GetMap','LAYERS':layer,'STYLES':'','SRS':'EPSG:3857','BBOX':'-8348961.81,-4163881.14,-3116945.74,669141.06','WIDTH':'900','HEIGHT':'900','FORMAT':'image/png','TRANSPARENT':'TRUE','TIME':when}
 try:
  data,h=read(base+'wms/epsg3857/best/wms.cgi?'+urllib.parse.urlencode(q));image=Image.open(io.BytesIO(data)).convert('RGBA');opaque=sum(a>0 for a in image.getchannel('A').getdata());colors=image.getcolors(900*900) or [];chromatic=sum(n for n,c in colors if c[3]>0 and max(c[:3])-min(c[:3])>30)
  print('FRAME '+json.dumps({'time':when,'opaque':opaque,'chromatic':chromatic,'cors':next((v for k,v in h.items() if k.lower()=='access-control-allow-origin'),None),'bytes':len(data),'url':base+'wms/epsg3857/best/wms.cgi?'+urllib.parse.urlencode(q)}),flush=True)
  if opaque<10000:continue
  Path('/tmp/satellite-probe.png').write_bytes(data)
  image.thumbnail((500,500));out=io.BytesIO();image.convert('RGB').save(out,format='JPEG',quality=75);print('SATELLITE_PREVIEW_BASE64 '+base64.b64encode(out.getvalue()).decode(),flush=True)
  break
 except Exception as e:print('FRAME_ERROR '+str(e),flush=True)
else:raise SystemExit('No nonempty recent frame confirmed')
for candidate in ['https://gibs.earthdata.nasa.gov/colormaps/v1.3/'+layer+'.xml','https://gibs.earthdata.nasa.gov/colormaps/v1.0/'+layer+'.xml']:
 try:
  data,h=read(candidate);print('COLORMAP '+data.decode()[:24000],flush=True);break
 except Exception as e:print('COLORMAP_ERROR '+str(e),flush=True)
