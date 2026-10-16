#!/usr/bin/env python3
"""Compact published European/INGV grids. No fabricated MMI or earthquake feed.

Read only instrumental products; reported-intensity products remain separate.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = {'eu': ('https://shakemapeu.ingv.it', 'ShakeMap-EU / INGV · EMSC / ORFEUS / EFEHR'),
           'ingv': ('https://shakemap.ingv.it', 'INGV ShakeMap')}


def read(url, limit=4_000_000):
    if urllib.parse.urlparse(url).hostname not in {'shakemapeu.ingv.it', 'shakemap.ingv.it'}:
        raise ValueError('Untrusted product host')
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MonitorGlobal/1.0 (monitorglobal.top)'}), timeout=25) as r:
        raw = r.read(limit + 1)
    if len(raw) > limit:
        raise ValueError('Product too large')
    return raw


def epoch(value):
    return round(dt.datetime.fromisoformat(value.replace('Z', '+00:00')).replace(tzinfo=dt.timezone.utc).timestamp() * 1000)


def origin(row):
    t = dt.datetime(row['year'], row['month'], row['day'], row['h'], row['m'], tzinfo=dt.timezone.utc)
    return {'time': round((t.timestamp() + float(row['s'])) * 1000), 'lat': float(row['lat']),
            'lng': float(row['lon']), 'mag': float(row['mag'])}


def same(a, b):
    # Conservative association; ambiguous catalogue matches are rejected by the client.
    return (abs(a['time'] - b['time']) <= 30_000 and abs(a['mag'] - b['mag']) <= 1.5
            and abs(a['lat'] - b['lat']) <= .7
            and abs((a['lng'] - b['lng'] + 180) % 360 - 180) * math.cos(math.radians(a['lat'])) <= .7)


def compact_grid(raw, expected, event_id):
    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
        raise ValueError('Unexpected XML declaration')
    xml = ET.fromstring(raw)
    children = {c.tag.split('}')[-1]: c for c in xml}
    e, spec = children['event'].attrib, children['grid_specification'].attrib
    actual = {'time': epoch(e['event_timestamp']), 'lat': float(e['lat']), 'lng': float(e['lon']), 'mag': float(e['magnitude'])}
    if e['event_id'] != event_id or not same(expected, actual) or xml.attrib.get('shakemap_event_type') != 'ACTUAL':
        raise ValueError('Unmatched or simulated origin')
    nx, ny = int(spec['nlon']), int(spec['nlat'])
    if not (2 <= nx <= 10000 and 2 <= ny <= 10000 and nx * ny <= 2_000_000):
        raise ValueError('Unsupported grid dimensions')
    x0, x1, y0, y1 = (float(spec[k]) for k in ['lon_min', 'lon_max', 'lat_min', 'lat_max'])
    if not (0 < x1 - x0 <= 60 and -90 <= y0 < y1 <= 90 and y1 - y0 <= 60):
        raise ValueError('Unsupported grid extent')
    fields = {c.attrib['name'].upper(): int(c.attrib['index']) - 1 for c in xml if c.tag.split('}')[-1] == 'grid_field'}
    if not {'LON', 'LAT', 'MMI'} <= fields.keys():
        raise ValueError('No published intensity')
    # At most 16k published samples; keep endpoints, never interpolate or invent values.
    scale = max(1, math.sqrt(nx * ny / 16000))
    ox, oy = max(2, math.floor(nx / scale)), max(2, math.floor(ny / scale))
    xs = {round(i * (nx - 1) / (ox - 1)): i for i in range(ox)}
    ys = {round(i * (ny - 1) / (oy - 1)): i for i in range(oy)}
    values, seen, count = [None] * (ox * oy), set(), 0
    for line in children['grid_data'].text.splitlines():
        if not line.strip():
            continue
        count += 1
        cols = line.split()
        lon, lat = float(cols[fields['LON']]), float(cols[fields['LAT']])
        ix, iy = round((lon - x0) / (x1 - x0) * (nx - 1)), round((lat - y0) / (y1 - y0) * (ny - 1))
        if ix not in xs or iy not in ys:
            continue
        if abs(lon - (x0 + ix * (x1 - x0) / (nx - 1))) > (x1 - x0) / (nx - 1) * .15 or abs(lat - (y0 + iy * (y1 - y0) / (ny - 1))) > (y1 - y0) / (ny - 1) * .15:
            raise ValueError('Irregular grid axes')
        pos = ys[iy] * ox + xs[ix]
        if pos in seen:
            raise ValueError('Duplicate cell')
        seen.add(pos)
        mmi = float(cols[fields['MMI']])
        values[pos] = round(mmi, 3) if math.isfinite(mmi) and 0 <= mmi <= 12 else None
    if count != nx * ny or len(seen) != ox * oy:
        raise ValueError('Incomplete published grid')
    # Nonuniform sampled indices are resampled to a regular grid using nearest
    # original cells: spacing error is at most half an original pixel.
    return {'nx': ox, 'ny': oy, 'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'values': values}


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def refresh(output, max_events=24):
    now = dt.datetime.now(dt.timezone.utc)
    old = json.loads((output / 'index.json').read_text()) if (output / 'index.json').exists() else {'events': []}
    rows, healthy = [], set()
    for code, (base, _) in SOURCES.items():
        try:
            catalogue = json.loads(read(base + '/events.json'))
            candidates = []
            for months in catalogue.values():
                for month in months.values():
                    for row in month:
                        if row['year'] < 2000 or not re.fullmatch(r'[\w-]{2,100}', str(row['id']), flags=re.ASCII):
                            continue
                        q = origin(row)
                        if q['mag'] >= 5.5 and q['time'] <= now.timestamp() * 1000 + 60000:
                            candidates.append((row, q))
            candidates.sort(key=lambda x: x[1]['time'], reverse=True)
            selected = [r for r in candidates if r[1]['time'] >= (now.timestamp() - 7 * 86400) * 1000][:max_events]
            # One real historical example per provider also verifies the pipeline during quiet periods.
            if not selected and candidates:
                selected = candidates[:1]
            rows += [(code, row, q) for row, q in selected]
            healthy.add(code)
        except Exception as error:
            print(code, 'catalogue unavailable:', type(error).__name__)
    if not healthy:
        raise RuntimeError('All catalogues unavailable; retaining last publication')

    def product(job):
        code, row, q = job
        base, credit = SOURCES[code]
        event_id = str(row['id'])
        root = f'{base}/data/{event_id}/current/products/'
        path = f'{code}/{event_id}.json'
        previous = next((r for r in old['events'] if r['source'] == code and r['eventId'] == event_id), None)
        try:
            info_raw = read(root + 'info.json')
            info = json.loads(info_raw)
            inp = info['input']['event_information']
            check = {'time': epoch(inp['origin_time']), 'lat': float(inp['latitude']), 'lng': float(inp['longitude']), 'mag': float(inp['magnitude'])}
            if inp['event_type'] != 'ACTUAL' or inp['event_id'] != event_id or not same(q, check):
                raise ValueError('Unmatched product metadata')
            version = code + '-' + event_id + '-' + hashlib.sha256(info_raw).hexdigest()[:16]
            if previous and previous['version'] == version and (output / path).exists():
                return previous
            grid = compact_grid(read(root + 'grid.xml', 100_000_000), check, event_id)
            raw_rupture = None
            try:
                candidate = json.loads(read(root + 'rupture.json', 1_500_000))
                if str(candidate.get('metadata', {}).get('id')) == event_id:
                    raw_rupture = candidate
            except Exception:
                pass
            updated = info.get('processing', {}).get('shakemap_versions', {}).get('process_time')
            data = {'status': 'available', 'method': code + '-shakemap-grid', 'provider': credit,
                    'eventId': event_id, 'source': code, 'version': version, 'updatedAt': epoch(updated) if updated else None,
                    'origin': check, 'grid': grid, 'ruptureRaw': raw_rupture,
                    'url': base + '/#/event/' + event_id,
                    'note': credit + '. Grade MMI publicada, amostrada em resolução reduzida. Não confirma relatos ou danos.'}
            dump(output / path, data)
            return {**q, 'eventId': event_id, 'source': code, 'version': version, 'path': path}
        except Exception as error:
            print(code, event_id, 'product unavailable:', type(error).__name__, str(error)[:100])
            return previous  # Preserve confirmed products during transient upstream errors.

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        entries = [r for r in pool.map(product, rows) if r]
    entries += [r for r in old['events'] if r['source'] not in healthy]
    entries.sort(key=lambda r: (r['source'], -r['time']))
    # Do not create timestamp-only commits on every quiet refresh.
    if entries != old['events']:
        dump(output / 'index.json', {'updatedAt': now.isoformat(), 'minMagnitude': 5.5, 'events': entries})
    elif not (output / 'index.json').exists():
        dump(output / 'index.json', {'updatedAt': now.isoformat(), 'minMagnitude': 5.5, 'events': []})
    keep = {r['path'] for r in entries}
    for p in output.glob('*/*.json'):
        if str(p.relative_to(output)) not in keep:
            p.unlink()
    print('Published official maps:', len(entries), '; healthy catalogues:', ', '.join(sorted(healthy)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'data/official-shaking')
    parser.add_argument('--max-events', type=int, default=24)
    args = parser.parse_args()
    refresh(args.output, args.max_events)
