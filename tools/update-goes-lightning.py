#!/usr/bin/env python3
"""Build the South America lightning layer from NOAA GOES-19 GLM Level 2 flashes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree
import collections
import json
import re

from netCDF4 import Dataset
import numpy as np

ORIGIN = "https://noaa-goes19.s3.amazonaws.com"
WINDOW = timedelta(minutes=15)
CADENCE = 20
BOUNDS = (-90, -60, -30, 18)
NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
NAME = re.compile(r"GLM-L2-LCFA/\d{4}/\d{3}/\d{2}/OR_GLM-L2-LCFA_G19_s(\d{13})\d_e\d{14}_c\d{14}\.nc")


def fetch(url, limit):
    with urlopen(url, timeout=10) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("NOAA response exceeds size limit")
    return data


def objects(start, end):
    cursor = start.replace(minute=0, second=0, microsecond=0)
    while cursor < end:
        prefix = cursor.strftime("GLM-L2-LCFA/%Y/%j/%H/")
        result = ElementTree.fromstring(fetch(ORIGIN + "/?" + urlencode(
            {"list-type": 2, "prefix": prefix}), 250_000))
        for node in result.findall("s3:Contents/s3:Key", NS):
            key = node.text or ""
            match = NAME.fullmatch(key)
            if not match:
                continue
            observed = datetime.strptime(match.group(1), "%Y%j%H%M%S").replace(tzinfo=timezone.utc)
            if start <= observed < end:
                yield observed, key
        cursor += timedelta(hours=1)


def parse(data):
    # Read in the caller thread: the underlying netCDF C library is not thread-safe.
    with Dataset("glm.nc", memory=data) as product:
        lat = product["flash_lat"][:].filled(np.nan)
        lon = product["flash_lon"][:].filled(np.nan)
        quality = product["flash_quality_flag"][:].filled(1)
    west, south, east, north = BOUNDS
    valid = (quality == 0) & (lon >= west) & (lon < east) & (lat >= south) & (lat < north)
    # Quarter-degree cell centers. Each accepted flash is counted once.
    return collections.Counter(zip(np.floor(lon[valid] * 4).astype(int), np.floor(lat[valid] * 4).astype(int)))


def generate(now):
    seconds = (int(now.timestamp()) - 180) // CADENCE * CADENCE
    end = datetime.fromtimestamp(seconds, timezone.utc)
    start = end - WINDOW
    candidates = dict(objects(start, end))
    minimum = int(WINDOW.total_seconds() / CADENCE * .85)
    if len(candidates) < minimum:
        raise ValueError(f"NOAA catalogue incomplete: {len(candidates)} files")

    def download(entry):
        time, key = entry
        try:
            return time, fetch(ORIGIN + "/" + key, 3_000_000)
        except (OSError, ValueError):
            return time, None

    cells = collections.Counter()
    complete = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for time, data in pool.map(download, sorted(candidates.items())):
            if data is not None:
                try:
                    cells.update(parse(data))
                except (KeyError, OSError, ValueError):
                    continue
                complete.append(time)
    expected = int(WINDOW.total_seconds() / CADENCE)
    if len(complete) < minimum or end - complete[-1] > timedelta(minutes=2):
        raise ValueError(f"NOAA observations incomplete: {len(complete)}/{expected}")
    observed_start, observed_end = complete[0], complete[-1] + timedelta(seconds=CADENCE)
    return {
        "version": 1, "source": "NOAA GOES-19 GLM",
        "start": int(observed_start.timestamp() * 1000), "end": int(observed_end.timestamp() * 1000),
        "files": len(complete), "expected": expected, "resolution": .25,
        "cells": [[x / 4 + .125, y / 4 + .125, count] for (x, y), count in sorted(cells.items())],
    }


if __name__ == "__main__":
    payload = generate(datetime.now(timezone.utc))
    target = Path("data/goes-19-lightning.json")
    target.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Published {len(payload['cells'])} cells from {payload['files']}/{payload['expected']} files")
