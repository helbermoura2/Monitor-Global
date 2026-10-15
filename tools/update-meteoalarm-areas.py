#!/usr/bin/env python3
"""Refresh official area *bounds*, never import cached warnings into the live feed.
Source: Meteoalarm visualisation service, CC BY 4.0. No API key or KV required.
"""
import concurrent.futures, datetime as dt, json, pathlib, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data/meteoalarm-areas.json'
CODES = 'DE FR ES PT IT UK AT BE NL CH PL NO SE FI DK IE'.split()
BASE = 'https://visservice.meteoalarm.org/api/v1/'
now = dt.datetime.now(dt.timezone.utc)

def get(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'MonitorGlobal/1.0 (monitorglobal.top)'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

def valid(bb):
    return (isinstance(bb, list) and len(bb) == 2 and all(isinstance(p, list) and len(p) == 2 for p in bb)
            and all(isinstance(n, (int, float)) for p in bb for n in p)
            and -180 <= bb[0][0] < bb[1][0] <= 180 and -90 <= bb[0][1] < bb[1][1] <= 90)

old = json.loads(TARGET.read_text()) if TARGET.exists() else {}
cutoff = (now - dt.timedelta(days=90)).date().isoformat()
areas = {code: {name: row for name, row in old.get('areas', {}).get(code, {}).items()
                if row.get('verified', '') >= cutoff and valid(row.get('bb'))} for code in CODES}
countries = {r['code']: r['bb'] for r in get('regions')['regions'] if r['code'] in CODES and valid(r.get('bb'))}
if len(countries) != len(CODES):
    raise ValueError('Incomplete official country catalogue; retaining previous file')

def load(job):
    code, day = job
    date = (now + dt.timedelta(days=day)).strftime('%Y-%m-%dT00:00:00Z')
    query = urllib.parse.urlencode({'referenceDate': date, 'preset': 'day0'})
    return code, get(f'stream-buffers/live/hazards/{code}?{query}')['areas']

success = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    jobs = [pool.submit(load, (code, day)) for code in CODES for day in range(3)]
    for job in concurrent.futures.as_completed(jobs):
        try:
            code, rows = job.result()
            success += 1
            grouped = {}
            for row in rows:
                if valid(row.get('bb')) and isinstance(row.get('name'), str):
                    grouped.setdefault(row['name'], []).append(row['bb'])
            for name, boxes in grouped.items():
                # Same official area may appear once per hazard. Union its published extents.
                bb = [[min(b[0][i] for b in boxes) for i in range(2)],
                      [max(b[1][i] for b in boxes) for i in range(2)]]
                areas[code][name] = {'bb': bb, 'verified': now.date().isoformat()}
        except Exception as e:
            print('Catalogue request failed:', type(e).__name__)
if not success:
    raise RuntimeError('No area catalogue available; retaining previous file')
result = {'source': BASE, 'credit': 'Meteoalarm / serviços meteorológicos nacionais · CC BY 4.0',
          'updated': now.isoformat(), 'countries': countries, 'areas': areas}
TARGET.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n')
print(f'Official reference bounds: {sum(map(len, areas.values()))} areas, {len(countries)} countries; {success}/48 requests')
