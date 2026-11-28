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
            if len(p)>2 and not re.fullmatch(r'PT(?:\d+M|\d+S)',p[2]):continue
            if NOW-dt.timedelta(minutes=90)<=last<=NOW:out.add(last)
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
    if not times:
        # WMTS GetCapabilities advertises a concrete default time; never use unverified "now".
        t=parse_time(defaults.get(layer,''))
        if t and t.tzinfo and NOW-dt.timedelta(minutes=90)<=t<=NOW:
            times=[t];method='catalog_default'
    if not times:raise ValueError('No recent confirmed frames')
    t=times[-1]
    last=None
    for mime in ('image/png','image/jpeg'):
        try:
            raw,h2=get(query(WMS,SERVICE='WMS',VERSION='1.1.1',REQUEST='GetMap',LAYERS=layer,STYLES='',SRS='EPSG:3857',BBOX='-8348961.81,-4163881.14,-3116945.74,669141.06',WIDTH=600,HEIGHT=600,FORMAT=mime,TRANSPARENT='TRUE' if mime=='image/png' else 'FALSE',TIME=iso(t)),4*1024*1024)
            with Image.open(io.BytesIO(raw)) as image:
                if image.size!=(600,600) or image.format not in ('PNG','JPEG'):raise ValueError('Invalid WMS image')
                image.verify()
            break
        except Exception as e:last=e;emit(kind='image_error',layer=layer,mime=mime,reason=str(e)[:850])
    else:raise ValueError(str(last))
    with Image.open(io.BytesIO(raw)) as image:
        assert image.size==(600,600)
        rgba=image.convert('RGBA')
        alpha=rgba.getchannel('A')
        hist=alpha.histogram()
        visible=sum(hist[1:])
        # Report rather than infer full national coverage. Central sample helps reject empty images.
        if not visible:raise ValueError('Empty image')
        rgb=rgba.convert('RGB')
        extrema=rgb.getextrema()
        if all(lo==hi for lo,hi in extrema):raise ValueError('Constant image')
        emit(kind='product',layer=layer,matrix=matrix,time=iso(t),age_minutes=round((NOW-t).total_seconds()/60,1),image_format=image.format,image_bytes=len(raw),time_method=method,visible_fraction=round(visible/360000,4),domain_cors=h.get('Access-Control-Allow-Origin'),image_cors=h2.get('Access-Control-Allow-Origin'),status='sample_valid')
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
    except Exception as e:emit(kind='lightningcast_index',status='unavailable',reason=str(e)[:250])
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
        emit(kind='inpe_goes_summary',count=len(features),note='Metadata only; water vapor geometry and decoding not validated')
    except Exception as e:emit(kind='inpe_goes_catalog',status='unavailable',reason=str(e)[:850])
def main():
    lightning_index()
    inpe_goes_catalog()
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
    passed=[]
    for key in ('GeoColor','Band08','Band09','Band10','Band13','RGB'):
        options=choose(layers,key)
        if not options:emit(kind='category',category=key,status='not_listed');continue
        for layer in options[:3] if key=='RGB' else options[:1]:
            try:test_layer(layer,layers[layer],defaults,formats);passed.append(key)
            except Exception as e:emit(kind='product',layer=layer,status='unavailable',reason=str(e)[:300])
    emit(kind='summary',passed=sorted(set(passed)),required=['GeoColor','Band13','water_vapor'],lightningcast='pending')
    if not ('GeoColor' in passed and 'Band13' in passed and any(x in passed for x in ('Band08','Band09','Band10'))):raise SystemExit('Required satellite product sample not confirmed')
if __name__=='__main__':main()
