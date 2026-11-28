"""Stage 2 discovery only; no persistent images or production deployment."""
import datetime as dt, io, json, re, urllib.parse as up, urllib.request as ur, urllib.error as ue, xml.etree.ElementTree as ET
from html.parser import HTMLParser
from PIL import Image

BASE='https://gibs.earthdata.nasa.gov'
ORIGIN='https://appassets.androidplatform.net'
WMTS=BASE+'/wmts/epsg3857/best/wmts.cgi'
WMS=BASE+'/wms/epsg3857/best/wms.cgi'
INPE='https://granizo1.cptec.inpe.br/nowcasting/LightningCast/'
MAX=16*1024*1024
NS={'w':'http://www.opengis.net/wmts/1.0','o':'http://www.opengis.net/ows/1.1'}
NOW=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
def iso(x):return x.strftime('%Y-%m-%dT%H:%M:%SZ')
def emit(**x):print(json.dumps(x,ensure_ascii=False),flush=True)
class NoRedirect(ur.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
def get(url,limit=MAX):
    u=up.urlparse(url)
    if u.scheme!='https' or u.hostname not in ('gibs.earthdata.nasa.gov','granizo1.cptec.inpe.br','data.inpe.br') or u.username or u.password or u.port not in (None,443):
        raise ValueError('Unexpected source')
    try:
        with ur.build_opener(NoRedirect()).open(ur.Request(url,headers={'Origin':ORIGIN,'User-Agent':'ArgosOrbis-source-diagnostic/1.0'}),timeout=25) as r:
            raw=r.read(limit+1)
            if len(raw)>limit:raise ValueError('Response exceeds budget')
            return raw,r.headers
    except ue.HTTPError as e:
        message=e.read(1500).decode('utf8',errors='replace')
        raise ValueError(f'HTTP {e.code} {u.path}: {message[:650]}') from e
def query(base,**params):return base+'?'+up.urlencode(params,safe=':/,')
def parse_time(s):
    try:return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    except ValueError:return None
def frames(raw):
    root=ET.fromstring(raw);out=set()
    for el in root.iter():
        if el.tag.split('}')[-1]!='Domain':continue
        for token in (el.text or '').strip().split(','):
            p=token.strip().split('/')
            first=parse_time(p[0]);last=parse_time(p[1]) if len(p)>1 else first
            if not first or not last or first.tzinfo is None or last.tzinfo is None or last<first:continue
            if len(p)>2:
                interval=re.fullmatch(r'PT(\d+)(M|S)',p[2])
                if not interval:continue
                seconds=int(interval[1])*(60 if interval[2]=='M' else 1)
                if not 60<=seconds<=3600:continue
                step=dt.timedelta(seconds=seconds)
                for i in range(12):
                    t=last-i*step
                    if t<first or t<NOW-dt.timedelta(minutes=90):break
                    if t<=NOW:out.add(t)
            elif NOW-dt.timedelta(minutes=90)<=last<=NOW:out.add(last)
    return sorted(out)
def choose(layers,key):
    if key=='GeoColor':return [x for x in layers if 'geocolor' in x.lower()]
    if key.startswith('Band'):return [x for x in layers if re.search(r'_'+key+r'(?:_|$)',x)]
    return [x for x in layers if any(t in x.lower() for t in ('convection','cloud_phase','air_mass','airmass'))]
def test_layer(layer,matrices,defaults,formats):
    matrix=next((x for x in matrices if x=='GoogleMapsCompatible_Level7'),None) or next(iter(matrices),None)
    if not matrix:raise ValueError('No tile matrix')
    window=iso(NOW-dt.timedelta(hours=4))+'/'+iso(NOW)
    times=[];domain_cors=None;method=None
    candidates=[query(WMTS,SERVICE='WMTS',REQUEST='DescribeDomains',VERSION='1.0.0',LAYER=layer,TILEMATRIXSET=matrix,TIME=window),BASE+'/wmts/epsg3857/best/1.0.0/'+layer+'/default/'+matrix+'/all/'+window.replace('/','--')+'.xml']
    for url in candidates:
        try:
            raw,h=get(url,300000);times=frames(raw)
            if times:domain_cors=h.get('Access-Control-Allow-Origin');method='DescribeDomains';break
        except Exception as e:emit(kind='domain_error',layer=layer,reason=str(e)[:850])
    # A confirmed default may be used even if the newest domain frame is empty.
    default=parse_time(defaults.get(layer,''))
    if default and default.tzinfo and NOW-dt.timedelta(minutes=90)<=default<=NOW:
        times=sorted(set(times+[default]))
        if not method:method='catalog_default'
    if not times:raise ValueError('No recent confirmed frames')
    last=None
    for t in reversed(times[-6:]):
        try:
            raw,h2=get(query(WMS,SERVICE='WMS',VERSION='1.1.1',REQUEST='GetMap',LAYERS=layer,STYLES='',SRS='EPSG:3857',BBOX='-8348961.81,-4163881.14,-3116945.74,669141.06',WIDTH=600,HEIGHT=600,FORMAT='image/png',TRANSPARENT='TRUE',TIME=iso(t)),4*1024*1024)
            if h2.get('Access-Control-Allow-Origin') not in ('*',ORIGIN):raise ValueError('Direct browser access not confirmed')
            with Image.open(io.BytesIO(raw)) as image:
                if image.format!='PNG' or image.size!=(600,600):raise ValueError('Invalid WMS image')
                rgba=image.convert('RGBA')
                visible=sum(rgba.getchannel('A').histogram()[1:])
                if not visible:raise ValueError('Empty image')
                if all(lo==hi for lo,hi in rgba.convert('RGB').getextrema()):raise ValueError('Constant image')
                emit(kind='product',layer=layer,matrix=matrix,time=iso(t),age_minutes=round((NOW-t).total_seconds()/60,1),image_format=image.format,image_bytes=len(raw),time_method=method,visible_fraction=round(visible/360000,4),domain_cors=domain_cors,image_cors=h2.get('Access-Control-Allow-Origin'),status='sample_valid')
                return
        except Exception as e:
            last=e;emit(kind='image_error',layer=layer,time=iso(t),reason=str(e)[:850])
    raise ValueError(str(last))
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            link=dict(attrs).get('href')
            if link:self.links.append(link)
def lightning_index():
    try:
        raw,h=get(INPE,1024*1024);p=Links();p.feed(raw.decode('utf8',errors='replace'))
        links=[]
        for href in p.links:
            if len(href)>250 or href.startswith(('/', '.', '?','#')):continue
            url=up.urljoin(INPE,href);u=up.urlparse(url)
            if u.hostname=='granizo1.cptec.inpe.br' and url.startswith(INPE) and not u.query and not u.fragment:links.append(href)
        emit(kind='lightningcast_index',status='reachable',cors=h.get('Access-Control-Allow-Origin'),links=links[-25:],count=len(links),note='Geometry, freshness and reuse permission still unverified')
        for folder in ('png/','png_sp/'):
            if folder not in links:continue
            try:
                raw,headers=get(INPE+folder,2*1024*1024);sub=Links();sub.feed(raw.decode('utf8',errors='replace'))
                files=sorted(set(x for x in sub.links if re.fullmatch(r'[A-Za-z0-9_.-]{1,180}[.]png',x,re.I)))
                emit(kind='lightningcast_files',folder=folder,count=len(files),latest_names=files[-8:],cors=headers.get('Access-Control-Allow-Origin'))
                if files:
                    raw,headers=get(INPE+folder+files[-1],4*1024*1024)
                    with Image.open(io.BytesIO(raw)) as image:
                        assert image.format=='PNG';image.verify()
                    with Image.open(io.BytesIO(raw)) as image:
                        emit(kind='lightningcast_sample',folder=folder,name=files[-1],size=image.size,mode=image.mode,bytes=len(raw),metadata={k:str(v)[:250] for k,v in image.info.items() if k in ('Description','Title','Software','timestamp','creation_time')},cors=headers.get('Access-Control-Allow-Origin'),note='Diagnostic only; not verified georeferenced or current')
            except Exception as e:emit(kind='lightningcast_folder',folder=folder,status='unavailable',reason=str(e)[:500])
    except Exception as e:emit(kind='lightningcast_index',status='unavailable',reason=str(e)[:250])
def validate_water_vapor(item):
    import numpy as np
    from netCDF4 import Dataset
    from pyproj import CRS, Transformer
    passed=[]
    points=[('Norte',-60.02,-3.10),('Nordeste',-38.50,-12.97),('Centro-Oeste',-47.88,-15.79),('Sudeste',-46.63,-23.55),('Sul',-51.23,-30.03)]
    stamp=parse_time(item.get('properties',{}).get('datetime',''))
    if not stamp or stamp.tzinfo is None or not NOW-dt.timedelta(minutes=90)<=stamp<=NOW:
        emit(kind='water_vapor',status='unavailable',reason='No recent timestamp');return passed
    for band in ('B08','B09','B10'):
        try:
            asset=item['assets'][band];url=asset['href'];u=up.urlparse(url)
            if u.hostname!='data.inpe.br' or u.query or u.fragment or not re.fullmatch(r'/bdc/data/GOES19-L2-CMI/ch'+band[1:]+r'/\d{4}/\d{2}/[A-Za-z0-9_-]+\.nc',u.path):raise ValueError('Unexpected product path')
            raw,h=get(url,64*1024*1024)
            if h.get('Access-Control-Allow-Origin') not in ('*',ORIGIN):raise ValueError('Direct browser access not confirmed')
            with Dataset('memory.nc',memory=raw) as ds:
                emit(kind='water_vapor_schema',band=band,bytes=len(raw),format=ds.data_model,dimensions={k:len(v) for k,v in ds.dimensions.items()},variables={k:{'shape':v.shape,'dims':v.dimensions,'units':str(getattr(v,'units','')),'standard_name':str(getattr(v,'standard_name','')),'grid_mapping':str(getattr(v,'grid_mapping',''))} for k,v in ds.variables.items()})
                # Official ABI CMI is a 2-D field. Scalar min/max/mean share the same standard_name.
                v=ds.variables.get('CMI')
                if v is None or v.dimensions!=('y','x') or getattr(v,'standard_name','')!='toa_brightness_temperature':raise ValueError('Official CMI field absent or invalid')
                if int(np.asarray(ds.variables['band_id'][:]).reshape(-1)[0])!=int(band[1:]):raise ValueError('Wrong ABI band')
                quality=ds.variables.get('DQF')
                if quality is None or quality.dimensions!=v.dimensions or quality.shape!=v.shape:raise ValueError('Missing quality flags')
                if v.ndim<2 or any(i!=1 for i in v.shape[:-2]):raise ValueError('Unexpected temperature dimensions')
                units=str(getattr(v,'units','')).lower().strip()
                if units not in ('k','kelvin','degc','celsius','degree_celsius','degrees_celsius','°c'):raise ValueError('Unsupported brightness temperature units '+units)
                yname,xname=v.dimensions[-2:]
                xvar=ds.variables[xname];yvar=ds.variables[yname]
                x=np.asarray(xvar[:],dtype=float);y=np.asarray(yvar[:],dtype=float)
                if x.ndim!=1 or y.ndim!=1 or len(x)!=v.shape[-1] or len(y)!=v.shape[-2] or not np.all(np.isfinite(x)) or not np.all(np.isfinite(y)):raise ValueError('Invalid coordinate vectors')
                if not all(np.all(np.diff(a)>0) or np.all(np.diff(a)<0) for a in (x,y)):raise ValueError('Nonmonotonic coordinate vectors')
                mapping=getattr(v,'grid_mapping','')
                if mapping in ds.variables:
                    projection=ds.variables[mapping];attrs={k:projection.getncattr(k) for k in projection.ncattrs()}
                    emit(kind='water_vapor_projection',band=band,attributes={k:str(a) for k,a in attrs.items()})
                    crs=CRS.from_cf(attrs)
                    transformer=Transformer.from_crs('EPSG:4326',crs,always_xy=True)
                    height=float(attrs.get('perspective_point_height',1))
                    def convert(lon,lat):
                        xx,yy=transformer.transform(lon,lat)
                        if str(getattr(xvar,'units','')).lower() in ('rad','radian','radians'):xx/=height
                        elif str(getattr(xvar,'units','')).lower() not in ('m','meter','metre','meters','metres'):raise ValueError('Unsupported x unit')
                        if str(getattr(yvar,'units','')).lower() in ('rad','radian','radians'):yy/=height
                        elif str(getattr(yvar,'units','')).lower() not in ('m','meter','metre','meters','metres'):raise ValueError('Unsupported y unit')
                        return xx,yy
                elif str(getattr(xvar,'units','')).lower() in ('degrees_east','degree_east') and str(getattr(yvar,'units','')).lower() in ('degrees_north','degree_north'):
                    def convert(lon,lat):return lon,lat
                else:raise ValueError('Unverified projection')
                samples=[]
                for region,lon,lat in points:
                    xx,yy=convert(lon,lat)
                    if not (np.isfinite(xx) and np.isfinite(yy) and x.min()<=xx<=x.max() and y.min()<=yy<=y.max()):raise ValueError('Outside grid: '+region)
                    ix=int(np.argmin(abs(x-xx)));iy=int(np.argmin(abs(y-yy)))
                    value=v[(0,)*(v.ndim-2)+(iy,ix)]
                    if np.ma.is_masked(value):raise ValueError('Missing observation: '+region)
                    c=float(value)-(273.15 if units in ('k','kelvin') else 0)
                    if not -120<=c<=80:raise ValueError('Invalid brightness temperature')
                    flag=quality[iy,ix]
                    if np.ma.is_masked(flag) or int(flag) not in (0,1):raise ValueError('Unusable quality flag: '+region)
                    samples.append({'region':region,'row':iy,'column':ix,'celsius':round(c,2),'dqf':int(flag)})
                emit(kind='water_vapor',band=band,time=iso(stamp),bytes=len(raw),cors=h.get('Access-Control-Allow-Origin'),samples=samples,status='sample_valid')
                # Independent reference: vectorized PROJ conversion and bounded rectangular read.
                # All 90,000 raster positions are compared against the mobile JS decoder.
                size=300
                if str(getattr(xvar,'units',''))!='rad' or str(getattr(yvar,'units',''))!='rad':raise ValueError('Unexpected reference axes')
                top=np.log(np.tan(np.pi/4+np.deg2rad(6)/2));bottom=np.log(np.tan(np.pi/4+np.deg2rad(-35)/2))
                lons=-75+(np.arange(size)+.5)/size*47
                lats=np.rad2deg(2*np.arctan(np.exp(top-(np.arange(size)+.5)/size*(top-bottom)))-np.pi/2)
                glon,glat=np.meshgrid(lons,lats)
                gx,gy=transformer.transform(glon,glat);gx/=height;gy/=height
                def nearest_vector(axis,values):
                    asc=axis[0]<axis[-1];ordered=axis if asc else axis[::-1]
                    indices=np.searchsorted(ordered,values).clip(1,len(axis)-1)
                    lower=indices-1
                    idx=np.where(np.abs(values-ordered[lower])<=np.abs(values-ordered[indices]),lower,indices)
                    return idx if asc else len(axis)-1-idx
                ix=nearest_vector(x,gx);iy=nearest_vector(y,gy)
                inside=np.isfinite(gx)&np.isfinite(gy)&(gx>=x.min())&(gx<=x.max())&(gy>=y.min())&(gy<=y.max())
                ix=np.where(inside,ix,-1);iy=np.where(inside,iy,-1)
                left=int(ix[inside].min());right=int(ix[inside].max());top_row=int(iy[inside].min());bottom_row=int(iy[inside].max())
                if (right-left+1)*(bottom_row-top_row+1)>9000000:raise ValueError('Reference crop exceeds budget')
                data=v[top_row:bottom_row+1,left:right+1]
                flags=quality[top_row:bottom_row+1,left:right+1]
                iy_safe=np.where(inside,iy-top_row,0);ix_safe=np.where(inside,ix-left,0)
                values=np.ma.filled(data[iy_safe,ix_safe],np.nan).astype(float)-273.15
                fq=np.ma.filled(flags[iy_safe,ix_safe],255)
                valid=inside&np.isfinite(values)&(values>=-120)&(values<=80)&np.isin(fq,[0,1])
                from pathlib import Path
                Path('/tmp/argos-goes-'+band+'.nc').write_bytes(raw)
                Path('/tmp/argos-goes-'+band+'.json').write_text(json.dumps({'size':size,'rows':iy.ravel().tolist(),'columns':ix.ravel().tolist(),'values':[float(z) if ok else None for z,ok in zip(values.ravel(),valid.ravel())],'quality':np.where(valid,fq,255).ravel().tolist()},allow_nan=False))
                passed.append('Band'+band[1:])
        except Exception as e:emit(kind='water_vapor',band=band,status='unavailable',reason=str(e)[:800])
    return passed

def inpe_goes_catalog():
    base='https://data.inpe.br/bdc/stac/v1'
    try:
        raw,h=get(base+'/collections/GOES19-L2-CMI-1',2*1024*1024)
        col=json.loads(raw)
        emit(kind='inpe_goes_collection',id=col.get('id'),license=col.get('license'),cors=h.get('Access-Control-Allow-Origin'))
        raw,h=get(query(base+'/search',collections='GOES19-L2-CMI-1',datetime=iso(NOW-dt.timedelta(hours=3))+'/'+iso(NOW),limit=10),4*1024*1024)
        features=json.loads(raw).get('features',[])
        for item in features[:5]:
            assets={k:{'type':v.get('type'),'path':up.urlparse(v.get('href','')).path,'host':up.urlparse(v.get('href','')).hostname} for k,v in item.get('assets',{}).items()}
            emit(kind='inpe_goes_item',id=item.get('id'),time=item.get('properties',{}).get('datetime'),assets=assets)
        emit(kind='inpe_goes_summary',count=len(features))
        eligible=[i for i in features if all(b in i.get('assets',{}) for b in ('B08','B09','B10')) and parse_time(i.get('properties',{}).get('datetime','')) is not None]
        return validate_water_vapor(max(eligible,key=lambda i:parse_time(i['properties']['datetime']))) if eligible else []
    except Exception as e:emit(kind='inpe_goes_catalog',status='unavailable',reason=str(e)[:850]);return []
def main():
    lightning_index()
    water_passed=inpe_goes_catalog()
    raw,_=get(query(WMTS,SERVICE='WMTS',REQUEST='GetCapabilities',VERSION='1.0.0'))
    root=ET.fromstring(raw);layers={};defaults={};formats={}
    for el in root.findall('.//w:Layer',NS):
        ident=el.findtext('o:Identifier',default='',namespaces=NS)
        if ident.startswith('GOES-East_ABI_'):
            layers[ident]=[x.text for x in el.findall('w:TileMatrixSetLink/w:TileMatrixSet',NS) if x.text]
            defaults[ident]=el.findtext('w:Dimension/w:Default',default='',namespaces=NS)
            formats[ident]=[x.text for x in el.findall('w:Format',NS)]
    if not layers:raise RuntimeError('GOES-East ABI catalog absent')
    emit(kind='catalog',layers=layers,defaults=defaults,formats=formats)
    passed=list(water_passed)
    for key in ('GeoColor','Band08','Band09','Band10','Band13','RGB'):
        options=choose(layers,key)
        if not options:emit(kind='category',category=key,status='not_listed');continue
        for layer in options[:3] if key=='RGB' else options[:1]:
            try:test_layer(layer,layers[layer],defaults,formats);passed.append(key)
            except Exception as e:emit(kind='product',layer=layer,status='unavailable',reason=str(e)[:300])
    emit(kind='summary',passed=sorted(set(passed)),required=['GeoColor','Band13','water_vapor'],lightningcast='pending')
    if not ('GeoColor' in passed and 'Band13' in passed and all(x in passed for x in ('Band08','Band09','Band10'))):raise SystemExit('Required satellite product sample not confirmed')
if __name__=='__main__':main()
