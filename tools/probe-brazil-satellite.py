"""Read-only source check: no credentials, source images stay outside the repository."""
import urllib.request,urllib.parse,datetime,xml.etree.ElementTree as ET,io,json,base64,os
from pathlib import Path
from PIL import Image
now=datetime.datetime.now(datetime.timezone.utc).replace(second=0,microsecond=0)
layer='GOES-East_ABI_Band13_Clean_Infrared'
def read(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MonitorGlobal/satellite-source-check'}),timeout=15) as r:return r.read(),dict(r.headers)
base='https://gibs.earthdata.nasa.gov/'
values=[]
for matrix in ['GoogleMapsCompatible_Level7','GoogleMapsCompatible_Level6','GoogleMapsCompatible_Level8']:
 query={'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':layer,'TILEMATRIXSET':matrix,'TIME':(now-datetime.timedelta(hours=4)).isoformat().replace('+00:00','Z')+'/'+now.isoformat().replace('+00:00','Z')}
 try:
  raw,headers=read(base+'wmts/epsg3857/best/wmts.cgi?'+urllib.parse.urlencode(query,safe="/:"));print('DOMAINS '+raw.decode()[:16000],flush=True)
  values=[e.text or '' for e in ET.fromstring(raw).iter() if e.tag.rsplit('}',1)[-1]=='Domain']
  if values:
   Path('/tmp/satellite-probe-domains.xml').write_bytes(raw);break
 except Exception as e:print('DOMAINS_ERROR '+matrix+' '+str(e)+(e.read().decode()[:2000] if hasattr(e,'read') else ''),flush=True)
ends=[]
for value in values:
 for part in value.split(','):
  pieces=part.strip().split('/')
  for candidate in ([pieces[1]] if len(pieces)>=2 else pieces):
   try:
    dt=datetime.datetime.fromisoformat(candidate.replace('Z','+00:00'))
    if dt.tzinfo and dt<=now:ends.append(dt)
   except ValueError:pass
frame=max(ends) if ends else now-datetime.timedelta(minutes=40)
frame=frame.replace(minute=frame.minute//10*10,second=0,microsecond=0)
for attempt in range(6):
 when=(frame-datetime.timedelta(minutes=10*attempt)).isoformat().replace('+00:00','Z')
 q={'SERVICE':'WMS','VERSION':'1.1.1','REQUEST':'GetMap','LAYERS':layer,'STYLES':'','SRS':'EPSG:3857','BBOX':'-8348961.81,-4163881.14,-3116945.74,669141.06','WIDTH':'900','HEIGHT':'900','FORMAT':'image/png','TRANSPARENT':'TRUE','TIME':when}
 try:
  data,h=read(base+'wms/epsg3857/best/wms.cgi?'+urllib.parse.urlencode(q));image=Image.open(io.BytesIO(data)).convert('RGBA');opaque=sum(a>0 for a in image.getchannel('A').getdata());colors=image.getcolors(900*900) or [];chromatic=sum(n for n,c in colors if c[3]>0 and max(c[:3])-min(c[:3])>30)
  print('FRAME '+json.dumps({'time':when,'opaque':opaque,'chromatic':chromatic,'cors':next((v for k,v in h.items() if k.lower()=='access-control-allow-origin'),None),'bytes':len(data),'url':base+'wms/epsg3857/best/wms.cgi?'+urllib.parse.urlencode(q)}),flush=True)
  if opaque<10000:
   Path('/tmp/satellite-probe-empty.png').write_bytes(data);continue
  Path('/tmp/satellite-probe.png').write_bytes(data);Path('/tmp/satellite-probe-info.json').write_text(json.dumps({'imageTime':when}))
  image.thumbnail((500,500));out=io.BytesIO();image.convert('RGB').save(out,format='JPEG',quality=75);print('SATELLITE_PREVIEW_BASE64 '+base64.b64encode(out.getvalue()).decode(),flush=True)
  break
 except Exception as e:print('FRAME_ERROR '+str(e),flush=True)
else:raise SystemExit('No nonempty recent frame confirmed')
for candidate in ['https://gibs.earthdata.nasa.gov/colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml','https://gibs.earthdata.nasa.gov/colormaps/v1.3/'+layer+'.xml','https://gibs.earthdata.nasa.gov/colormaps/v1.0/'+layer+'.xml']:
 try:
  data,h=read(candidate);print('COLORMAP '+data.decode()[:24000],flush=True);break
 except Exception as e:print('COLORMAP_ERROR '+str(e),flush=True)

try:
 data,h=read('https://gibs.earthdata.nasa.gov/legends/Clean_Longwave_Infrared_Window_Band_H.png');Path('/tmp/satellite-probe-legend.png').write_bytes(data);im=Image.open(io.BytesIO(data));print('LEGEND '+json.dumps({'size':im.size}),flush=True);print('LEGEND_PREVIEW_BASE64 '+base64.b64encode(data).decode(),flush=True)
except Exception as e:print('LEGEND_ERROR '+str(e),flush=True)
