"""Read-only LightningCast candidate diagnostic; no production use or redistribution."""
import datetime as dt,json,math,re,urllib.request as ur,urllib.parse as up
from html.parser import HTMLParser
BASE='https://realearth.ssec.wisc.edu'
PRODUCT='PLTGGOESEastRadF'
NOW=dt.datetime.now(dt.timezone.utc)
ORIGIN='https://appassets.androidplatform.net'
class NoRedirect(ur.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
def emit(**x):print(json.dumps(x,ensure_ascii=False),flush=True)
def get(path,limit=2*1024*1024,**params):
    url=BASE+path+'?'+up.urlencode(params)
    with ur.build_opener(NoRedirect()).open(ur.Request(url,headers={'Origin':ORIGIN,'User-Agent':'ArgosOrbis-diagnostic/1.0'}),timeout=25) as r:
        raw=r.read(limit+1)
        if len(raw)>limit:raise ValueError('Response exceeds budget')
        return json.loads(raw),r.headers.get('Access-Control-Allow-Origin')
def inspect_geometry(data):
    if not isinstance(data,dict) or data.get('type')!='FeatureCollection' or not isinstance(data.get('features'),list):raise ValueError('Expected GeoJSON FeatureCollection')
    features=data['features']
    if len(features)>5000:raise ValueError('Too many features')
    types={};keys=set();count=0;inside=0;bounds=[180,90,-180,-90]
    def walk(v,depth=0):
        nonlocal count,inside
        if depth>6 or not isinstance(v,list):raise ValueError('Invalid coordinates')
        if len(v)>=2 and all(isinstance(n,(int,float)) and not isinstance(n,bool) for n in v[:2]):
            lon,lat=v[:2]
            if not math.isfinite(lon) or not math.isfinite(lat) or not -180<=lon<=180 or not -90<=lat<=90:raise ValueError('Non-geographic coordinate')
            count+=1
            if count>200000:raise ValueError('Too many vertices')
            if -75<=lon<=-28 and -35<=lat<=6:inside+=1
            bounds[0]=min(bounds[0],lon);bounds[1]=min(bounds[1],lat);bounds[2]=max(bounds[2],lon);bounds[3]=max(bounds[3],lat)
        else:
            for p in v:walk(p,depth+1)
    for feature in features:
        g=feature.get('geometry') or {};kind=g.get('type')
        if kind not in ('Polygon','MultiPolygon','LineString','MultiLineString','Point','MultiPoint'):raise ValueError('Unexpected geometry')
        types[kind]=types.get(kind,0)+1
        props=feature.get('properties') or {}
        if not isinstance(props,dict):raise ValueError('Invalid properties')
        keys.update(str(k)[:100] for k in props)
        walk(g.get('coordinates'))
    return dict(features=len(features),types=types,property_keys=sorted(keys),vertices=count,vertices_in_brazil_bbox=inside,bounds=bounds if count else None,note='Geometry schema only; probability semantics, national coverage, valid time and product permission unverified')
def main():
    for endpoint in ('products','latest','extents','shapes'):
        try:
            params={'products':PRODUCT}
            if endpoint=='products':params['exclude']='times'
            if endpoint=='shapes':params['databounds']='-35,-75,6,-28'
            data,cors=get('/api/'+endpoint,8*1024*1024 if endpoint=='shapes' else 2*1024*1024,**params)
            if endpoint=='shapes':emit(endpoint=endpoint,cors=cors,status='inspectable',**inspect_geometry(data))
            else:emit(endpoint=endpoint,cors=cors,status='inspectable',metadata=str(data)[:4000])
        except Exception as e:emit(endpoint=endpoint,status='unavailable',reason=str(e)[:300])
    emit(status='research_only',production_ready=False,reason='No assumption of freshness, validated probability or specific redistribution permission')
if __name__=='__main__':main()
