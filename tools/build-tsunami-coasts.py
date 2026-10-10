"""Build cartographic coastal references from public-domain Natural Earth 1:50m.
Usage: python build-tsunami-coasts.py /path/to/ne_50m_geojson_directory
Requires shapely 2.x. Sources: nvkelso/natural-earth-vector/geojson on GitHub.
These outlines are geographic references, never tsunami inundation polygons.
"""
import json,sys,hashlib
from pathlib import Path
from shapely.geometry import shape,mapping
from shapely.ops import unary_union
root=Path(sys.argv[1]);coasts=unary_union([shape(f['geometry']) for f in json.loads((root/'ne_50m_coastline.geojson').read_text())['features']])
features=[]
for filename in ['ne_50m_admin_0_countries','ne_50m_admin_1_states_provinces']:
 for f in json.loads((root/(filename+'.geojson')).read_text())['features']:
  p=f['properties'];state='admin_1' in filename
  if state and not ((p.get('iso_a2')=='US' and p.get('name') in ['Alaska','Hawaii','Washington','Oregon','California']) or (p.get('iso_a2')=='CA' and p.get('name')=='British Columbia')):continue
  land=shape(f['geometry']);geometry=land.buffer(.001)
  coast=coasts.intersection(geometry).simplify(.025,preserve_topology=True)
  if coast.is_empty:continue
  def lines(g):
   if g.geom_type=='LineString':return [list(g.coords)] if g.length>.005 else []
   return [part for sub in getattr(g,'geoms',[]) for part in lines(sub)]
  coords=lines(coast)
  if not coords:continue
  names=[p.get(k) for k in (['name','name_en'] if state else ['ADMIN','NAME','NAME_LONG','NAME_EN','FORMAL_EN']) if p.get(k)]
  def polygon_band(width):
   # A cartographic coastal highlight on land, never a tsunami flood model.
   g=land.intersection(coast.buffer(width,quad_segs=3)).simplify(.015,preserve_topology=True)
   def polygons(g):
    if g.geom_type=='Polygon':return [g] if g.area>.00001 else []
    return [p for sub in getattr(g,'geoms',[]) for p in polygons(sub)]
   from shapely.geometry import MultiPolygon
   data=mapping(MultiPolygon(polygons(g)))
   def rounded(c):return [round(x,5) if isinstance(x,(int,float)) else rounded(x) for x in c]
   return {'type':data['type'],'coordinates':rounded(data['coordinates'])}
  features.append({'type':'Feature','properties':{'name':names[0],'aliases':list(dict.fromkeys(names)),'kind':'region' if state else 'country'},'geometry':polygon_band(.22),'innerGeometry':polygon_band(.10)})
out=Path('assets/tsunami/ne-50m-coastal-regions.geojson');out.write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'))+'\n')
print(len(features),'regions;',out.stat().st_size,'bytes')
for f in ['ne_50m_coastline','ne_50m_admin_0_countries','ne_50m_admin_1_states_provinces']:print(f,hashlib.sha256((root/(f+'.geojson')).read_bytes()).hexdigest())
