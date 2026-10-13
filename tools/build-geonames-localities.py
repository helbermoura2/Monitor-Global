"""Build the compact GeoNames city population reserve from a pinned cities500 JSON.
Usage: python3 tools/build-geonames-localities.py /path/to/cities500.json
"""
import sys,json,struct,hashlib,unicodedata,math
from pathlib import Path
source=Path(sys.argv[1]);rows=json.loads(source.read_text());places={};names={}
for row in rows:
 try:
  ident=int(row['id']);lat=float(row['lat']);lon=float(row['lon']);pop=int(row['pop'])
 except (ValueError,TypeError,KeyError):continue
 if not (0<ident<2**32 and 0<pop<2**32 and math.isfinite(lat) and math.isfinite(lon) and abs(lat)<=90 and abs(lon)<=180):continue
 name=''.join(c for c in unicodedata.normalize('NFKD',row['name']).lower() if c.isalnum());key=(row.get('country'),name)
 duplicate=None
 for old in names.get(key,[]):
  # Same named locality within two km: keep the larger source population.
  if math.hypot((lat-old[1])*111,(lon-old[2])*111*math.cos(math.radians(lat)))<=2:duplicate=old;break
 if duplicate:
  if duplicate[3]>=pop:continue
  places.pop(duplicate[0],None);names[key].remove(duplicate)
 place=(ident,lat,lon,pop);places[ident]=place;names.setdefault(key,[]).append(place)
records=sorted(places.values(),key=lambda p:p[1]);data=b'MGP1'+struct.pack('<III',len(records),16,1)+b''.join(struct.pack('<IffI',*p) for p in records)
target=Path('assets/population/geonames-localities-v1.bin');target.write_bytes(data)
metadata={'source':'GeoNames cities500','sourceUrl':'https://raw.githubusercontent.com/lmfmaier/cities-json/aed0822519df832873f6cca8e05d5224c418e657/cities500.json','license':'GeoNames CC BY 3.0','licenseUrl':'https://www.geonames.org/about.html','records':len(records),'sha256':hashlib.sha256(data).hexdigest(),'format':'MGP1; little-endian header and 16-byte records (id, latitude, longitude, population), sorted by latitude','note':'Populations are registered locality values from a pinned catalog, not a current census grid. Rural coverage is incomplete; urban areas may overlap. No matched localities does not mean zero residents.'}
Path('assets/population/geonames-localities-v1.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n');print({'records':len(records),'bytes':len(data)})
