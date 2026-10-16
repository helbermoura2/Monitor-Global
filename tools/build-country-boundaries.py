"""Build point-in-country reference polygons from public-domain Natural Earth 1:10m.
Usage: python tools/build-country-boundaries.py /path/to/ne_10m_admin_0_countries.geojson
Requires shapely. Simplification <= .005 degrees; runtime abstains within 2 km of edges.
"""
import json, sys, hashlib
from pathlib import Path
from shapely.geometry import shape, mapping
source=Path(sys.argv[1]); features=[]
def rounded(x):
    return round(x,5) if isinstance(x,(int,float)) else [rounded(v) for v in x]
for f in json.loads(source.read_text())['features']:
    p=f['properties']; code=p.get('ISO_A2_EH')
    if not isinstance(code,str) or len(code)!=2 or not code.isalpha(): continue
    g=shape(f['geometry']).simplify(.005,preserve_topology=True)
    features.append({'type':'Feature','properties':{'countryCode':code,'name':p.get('NAME_PT') or p['ADMIN']},'geometry':{'type':g.geom_type,'coordinates':rounded(mapping(g)['coordinates'])}})
out=Path('assets/geography/countries-10m.json');out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'type':'FeatureCollection','source':'Natural Earth 1:10m admin_0_countries · public domain','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'features':features},ensure_ascii=False,separators=(',',':'))+'\n')
print(len(features), 'countries/territories;',out.stat().st_size,'bytes')
