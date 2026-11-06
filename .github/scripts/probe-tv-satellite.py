"""Read-only proof of exact advertised times and original source image/legend."""
import concurrent.futures
import datetime as dt
import io,json,math
from pathlib import Path
import urllib.parse as parse
import urllib.request as request
import xml.etree.ElementTree as ET
from PIL import Image
now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
root='https://gibs.earthdata.nasa.gov/'
real='https://realearth.ssec.wisc.edu/'
product='G19-ABI-FD-BAND13-GRAD'
layer='GOES-East_ABI_Band13_Clean_Infrared'
def read(url,limit=1800000):
    with request.urlopen(request.Request(url,headers={'User-Agent':'MonitorGlobalTV/source-proof'}),timeout=12) as response:
        raw=response.read(limit+1)
        if len(raw)>limit:raise ValueError('Source exceeds byte limit')
        return raw
iso=lambda x:x.isoformat().replace('+00:00','Z')
def nasa():
    query={'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':layer,'TILEMATRIXSET':'GoogleMapsCompatible_Level7','TIME':iso(now-dt.timedelta(hours=2))+'/'+iso(now)}
    times=set()
    for element in ET.fromstring(read(root+'wmts/epsg3857/best/wmts.cgi?'+parse.urlencode(query,safe='/:'),131072)).iter():
        if element.tag.rsplit('}',1)[-1]!='Domain':continue
        for item in (element.text or '').split(','):
            values=item.strip().split('/')
            if len(values) not in [1,3] or len(values)==3 and values[2] not in ['PT10M','PT600S']:continue
            start=dt.datetime.fromisoformat(values[0].replace('Z','+00:00'))
            end=dt.datetime.fromisoformat(values[1].replace('Z','+00:00')) if len(values)==3 else start
            for i in range(6):
                at=end-dt.timedelta(minutes=10*i)
                if at>=start and at<=now and now-at<=dt.timedelta(minutes=90):times.add(at)
    return [('nasa',at) for at in sorted(times)[-6:]]
def ssec():
    products=json.loads(read(real+'api/products?products='+product+'&timespan=-2h',131072))
    times=[]
    for item in products:
        if item.get('id')!=product:continue
        for text in item.get('times',[])[:300]:
            at=dt.datetime.strptime(text,'%Y%m%d.%H%M%S').replace(tzinfo=dt.timezone.utc)
            if at<=now and now-at<=dt.timedelta(minutes=90):times.append(at)
    return [('realearth',at) for at in sorted(set(times))[-6:]]
frames=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    jobs={pool.submit(nasa):'nasa',pool.submit(ssec):'realearth'}
    for job in concurrent.futures.as_completed(jobs):
        try:frames.extend(job.result())
        except Exception as error:print(json.dumps({'source':jobs[job],'metadataError':str(error)[:150]}),flush=True)
merc=lambda lat:math.log(math.tan(math.pi/4+math.radians(lat)/2))
w,s,e,n=-54,-27,-38,-17
width=1024;height=round(width*(merc(n)-merc(s))/math.radians(e-w))
bbox=','.join(f'{value:.2f}' for value in [6378137*math.radians(w),6378137*merc(s),6378137*math.radians(e),6378137*merc(n)])
for provider,at in sorted(frames,key=lambda pair:pair[1],reverse=True)[:6]:
    try:
        if provider=='realearth':
            query={'products':product+'_'+at.strftime('%Y%m%d_%H%M%S'),'bounds':f'{s},{w},{n},{e}','width':width,'height':height,'format':'png'}
            image_url=real+'api/image?'+parse.urlencode(query)
            legend_url=real+'api/legend?products='+product
        else:
            query={'SERVICE':'WMS','VERSION':'1.1.1','REQUEST':'GetMap','LAYERS':layer,'STYLES':'','SRS':'EPSG:3857','BBOX':bbox,'WIDTH':width,'HEIGHT':height,'FORMAT':'image/png','TRANSPARENT':'TRUE','TIME':iso(at)}
            image_url=root+'wms/epsg3857/best/wms.cgi?'+parse.urlencode(query)
            legend_url=root+'legends/Clean_Longwave_Infrared_Window_Band_H.png'
        data=read(image_url);image=Image.open(io.BytesIO(data)).convert('RGBA')
        coverage=sum(alpha>0 for alpha in image.getchannel('A').getdata())/(width*height)
        print(json.dumps({'source':provider,'time':iso(at),'ageMinutes':round((now-at).total_seconds()/60,1),'size':image.size,'coverage':coverage}),flush=True)
        if image.size!=(width,height) or coverage<.999:continue
        Path('/tmp/tv-satellite-real.png').write_bytes(data)
        Path('/tmp/tv-satellite-time.txt').write_text(str(int(at.timestamp()*1000)))
        Path('/tmp/tv-satellite-now.txt').write_text(str(int(now.timestamp()*1000)))
        Path('/tmp/tv-satellite-provider.txt').write_text(provider)
        Path('/tmp/tv-satellite-legend.png').write_bytes(read(legend_url,150000))
        break
    except Exception as error:print(json.dumps({'source':provider,'imageError':str(error)[:150]}),flush=True)
else:raise SystemExit('No complete recent source image from either provider')
