"""Publish official Severe/Extreme CAP records locally and for a national information catalogue."""
import gzip
import json
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

from shapely import make_valid
from shapely.geometry import Point, Polygon, shape
from shapely.errors import GEOSException
from pyproj import Transformer
from pyproj.exceptions import ProjError
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://idapfile.mdr.gov.br/idap/api/rss/cap"
CAP = "{urn:oasis:names:tc:emergency:cap:1.2}"
ATOM = "{http://www.w3.org/2005/Atom}"
BOUNDARIES = ROOT / "android-mobile/app/src/main/assets/data/br-municipalities-sp.geojson"
OUTPUT = ROOT / "data/defesa-civil-sp.json"
NATIONAL_OUTPUT = ROOT / "data/defesa-civil-br.json"


def epoch(value):
    try:
        parsed = datetime.fromisoformat(value)
        return int(parsed.timestamp() * 1000) if parsed.tzinfo else 0
    except (TypeError, ValueError, OverflowError):
        return 0


def applies(area, city):
    for item in area.findall(CAP + "geocode"):
        if item.findtext(CAP + "value") == "3550308":
            return True
    for item in area.findall(CAP + "polygon"):
        try:
            points = [tuple(map(float, pair.split(","))) for pair in item.text.split()]
            polygon = make_valid(Polygon([(lon, lat) for lat, lon in points]))
            if polygon.intersection(city).area > 0:
                return True
        except (AttributeError, ValueError, GEOSException, ProjError):
            continue
    for item in area.findall(CAP + "circle"):
        try:
            center, radius = item.text.split()
            lat, lon = map(float, center.split(","))
            if float(radius) == 0 and city.covers(Point(lon, lat)):
                return True
            # Intersect using a local azimuthal-equidistant projection, in metres.
            project = Transformer.from_crs("EPSG:4326", f"+proj=aeqd +lat_0={lat} +lon_0={lon} +ellps=WGS84", always_xy=True)
            if float(radius) > 0 and transform(project.transform, city).distance(Point(0, 0)) < float(radius) * 1000:
                return True
        except (AttributeError, ValueError, GEOSException, ProjError):
            continue
    return False


def parse(stream, city, now, include_national=False):
    alerts, national, superseded, national_superseded = {}, {}, set(), set()
    updated = 0
    events = ET.iterparse(stream, events=("start", "end"))
    _, root = next(events)
    if root.tag != ATOM + "feed":
        raise ValueError("Unexpected IDAP CAP feed format")
    for event, element in events:
        if event != "end":
            continue
        if element.tag == ATOM + "updated" and not updated:
            updated = epoch(element.text)
        if element.tag != ATOM + "entry":
            continue
        alert = element.find(f".//{CAP}alert")
        if alert is not None:
            read = lambda key: alert.findtext(CAP + key, "").strip()
            sent = epoch(read("sent"))
            identifier = read("identifier")
            kind = read("msgType")
            if read("status") == "Actual" and read("scope") == "Public" and identifier and 0 < sent <= now:
                if kind in ("Update", "Cancel"):
                    for reference in read("references").split():
                        parts = reference.split(",")
                        if len(parts) == 3 and parts[0] == read("sender"):
                            superseded.add(parts[1])
                            national_superseded.add((parts[0], parts[1]))
                if kind in ("Alert", "Update"):
                    for info in alert.findall(CAP + "info"):
                        get = lambda key: info.findtext(CAP + key, "").strip()
                        issuer = get("senderName")
                        severity = get("severity")
                        expires = epoch(get("expires"))
                        effective = epoch(get("effective")) or sent
                        if (severity not in {"Severe", "Extreme"} or not effective <= now < expires
                                or not get("language").lower().startswith("pt")):
                            continue
                        message = get("headline") or get("description")
                        if not issuer or not message or len(message) > 500:
                            continue
                        areas = info.findall(CAP + "area")
                        descriptions = [a.findtext(CAP + "areaDesc", "").strip()[:180]
                                        for a in areas if a.findtext(CAP + "areaDesc", "").strip()]
                        # CAP notices need an explicit named area for national display.
                        if include_national and descriptions:
                            national[(read("sender"), identifier)] = dict(
                                id=identifier, sent=sent, expires=expires, issuer=issuer[:120],
                                severity=severity, message=message,
                                area="; ".join(descriptions[:3])[:350])
                        # Only SP official issuers and geographic overlap can trigger TV.
                        if (issuer.casefold() in {"defesa civil estadual de são paulo", "defesa civil de são paulo (sp)"}
                                and any(applies(a, city) for a in areas)):
                            alerts[identifier] = dict(id=identifier, sent=sent, expires=expires,
                                issuer=issuer, severity=severity, message=message)
                        break
        root.remove(element)
    if not updated or updated > now + 60_000:
        raise ValueError("IDAP feed timestamp is missing or invalid")
    local = sorted((a for key, a in alerts.items() if key not in superseded),
                   key=lambda a: a["sent"], reverse=True)[:20]
    if not include_national:
        return updated, local
    nationwide = sorted((a for key, a in national.items() if key not in national_superseded),
                        key=lambda a: (a["sent"], a["id"]), reverse=True)
    return updated, local, nationwide


def main():
    features = json.loads(BOUNDARIES.read_text())["features"]
    city = make_valid(shape(next(f["geometry"] for f in features if f["properties"]["cd_geocmu"] == "3550308")))
    now = int(time.time() * 1000)
    if len(sys.argv) == 2:
        with open(sys.argv[1], "rb") as stream:
            updated, alerts, nationwide = parse(stream, city, now, include_national=True)
    else:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "ArgosOrbis/1.0 (+https://argosorbis.com.br)", "Accept-Encoding": "gzip"})
        with urllib.request.urlopen(request, timeout=25) as response, tempfile.TemporaryFile() as stream:
            if response.geturl() != SOURCE:
                raise ValueError("Unexpected IDAP redirect")
            body = gzip.GzipFile(fileobj=response) if response.headers.get("Content-Encoding") == "gzip" else response
            while chunk := body.read(65536):
                stream.write(chunk)
                if stream.tell() > 85_000_000 or time.time() * 1000 - now > 175_000:
                    raise ValueError("IDAP response exceeds budget")
            stream.seek(0)
            now = int(time.time() * 1000)
            updated, alerts, nationwide = parse(stream, city, now, include_national=True)
    payload = dict(version=1, checkedAt=now, updatedAt=updated, source=SOURCE, municipality="3550308", alerts=alerts)
    # Keep a finite transport size. Report total and truncation rather than claiming completeness.
    limit = 1500
    national_payload = dict(version=1, checkedAt=now, updatedAt=updated, source=SOURCE,
                            scope="BRASIL", total=len(nationwide),
                            truncated=len(nationwide)>limit, alerts=nationwide[:limit])
    for path, data in ((OUTPUT, payload), (NATIONAL_OUTPUT, national_payload)):
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
        temporary.replace(path)
    print(f"IDAP: {len(alerts)} avisos na capital; {len(nationwide)} avisos CAP nacionais Severe/Extreme")


if __name__ == "__main__":
    main()
