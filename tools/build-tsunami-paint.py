"""Add genuine shorelines and named Pacific cartographic sectors to coastal bands.
Usage: python tools/build-tsunami-paint.py /path/to/ne_50m_coastline.geojson
Natural Earth 1:50m, public domain; Shapely 2.x. No inundation modelling.
"""
import json,sys,hashlib
from pathlib import Path
from shapely.geometry import shape,mapping,box,MultiPolygon,MultiLineString
from shapely.ops import unary_union
path=Path('assets/tsunami/ne-50m-coastal-regions.geojson')
source=Path(sys.argv[1]);shore=unary_union([shape(f['geometry']) for f in json.loads(source.read_text())['features']])
def rounded(c):return [round(x,5) if isinstance(x,(int,float)) else rounded(x) for x in c]
def polygons(g):
 if g.geom_type=='Polygon':return [g] if g.area>.00001 else []
 return [p for sub in getattr(g,'geoms',[]) for p in polygons(sub)]
def lines(g):
 if g.geom_type=='LineString':return [g] if g.length>.005 else []
 return [p for sub in getattr(g,'geoms',[]) for p in lines(sub)]
def geometry(g,kind):
 parts=(polygons if kind=='polygon' else lines)(g)
 if not parts:return None
 result=mapping((MultiPolygon if kind=='polygon' else MultiLineString)(parts));return {'type':result['type'],'coordinates':rounded(result['coordinates'])}
base=[f for f in json.loads(path.read_text())['features'] if f['properties']['kind']!='sector']
index={f['properties']['name']:f for f in base}
# Natural Earth admin-1 omits the US islands east of +180 in its Alaska row.
# Recover those genuine US coast bands from admin-0, not from a longitude guess.
western=box(170,50,180,55.5)
for key in ['geometry','innerGeometry']:
 index['Alaska'][key]=geometry(unary_union([shape(index['Alaska'][key]),shape(index['United States of America'][key]).intersection(western)]),'polygon')
# Windows identify named geographic reference sectors, not legal alert limits.
sectors=[
 ('Kamchatka','Russia',[(155,50,164,61.5)],['Kamchatka Peninsula','Kamchatka Krai','Península de Kamchatka']),
 ('Kuril Islands','Russia',[(145,43,157,51.5)],['Kurils','Kurile Islands','Ilhas Curilas','Ilhas Kurilas']),
 ('Northeastern Japan','Japan',[(139.5,36.5,142.8,41.6)],['Tohoku','Nordeste do Japão','Japão nordeste']),
 ('Hokkaido','Japan',[(139,41.3,146.5,46)],['Hokkaidō']),
 ('Aleutian Islands','Alaska',[(170,50,180,55.5),(-180,50,-162,55.5)],['Aleutians','Ilhas Aleutas']),
 ('Southern Alaska','Alaska',[(-169,54,-130,62)],['South Alaska','Sul do Alasca','Costa sul do Alasca']),
 ('Pacific coast of Russia','Russia',[(135,42,180,67.5),(-180,50,-169,67.5)],['Russian Pacific coast','Costa pacífica da Rússia'])]
features=list(base)
for name,parent,windows,aliases in sectors:
 mask=unary_union([box(*b) for b in windows]);ref=index[parent]
 outer=geometry(shape(ref['geometry']).intersection(mask),'polygon');inner=geometry(shape(ref['innerGeometry']).intersection(mask),'polygon')
 if not outer:raise ValueError('Empty sector '+name)
 features.append({'type':'Feature','properties':{'name':name,'aliases':aliases,'kind':'sector','parent':parent,'referenceScope':'cartographic-sector'},'geometry':outer,'innerGeometry':inner})
for f in features:
 area=shape(f['geometry']);f['coastlineGeometry']=geometry(shore.intersection(area.buffer(.025)).simplify(.012,preserve_topology=True),'line')
 if not f['coastlineGeometry']:raise ValueError('No shoreline for '+f['properties']['name'])
result={'type':'FeatureCollection','version':3,'features':features}
path.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
print(len(features),'regions;',path.stat().st_size,'bytes; shoreline SHA256',hashlib.sha256(source.read_bytes()).hexdigest())
