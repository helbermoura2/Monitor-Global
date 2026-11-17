#!/usr/bin/env python3
"""Import the owner's exact, publicly posted Imperial Bronze PNG from the Worker.

No Telegram or GitHub credentials are fetched by this script. It only imports
one fixed digest-verified public artifact. Missing upload is a normal no-op.
"""
from __future__ import annotations

import hashlib
import pathlib
import struct
import urllib.error
import urllib.request

SHA256 = "ed3cf9da86aa041673d98a40172649b498e879137da9a2b8a40810f6fe699a75"
SOURCE = (
    "https://black-sky-9ba0.terrestre.workers.dev/"
    f"telegram-imperial-preview-source/{SHA256}.png"
)
DEST = pathlib.Path("assets/telegram/m6/imperial-bronze-preview-2026-11-16-m6-6.png")
MAX_BYTES = 6 * 1024 * 1024

def verify_image(data: bytes) -> None:
    if len(data) < 24 or len(data) > MAX_BYTES:
        raise ValueError("approved image size out of range")
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("invalid PNG header")
    if struct.unpack(">II", data[16:24]) != (1024, 1536):
        raise ValueError("unexpected image dimensions")
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError("original PNG checksum differs from approved file")

def import_approved_art(destination: pathlib.Path = DEST, url: str = SOURCE) -> str:
    if destination.exists():
        verify_image(destination.read_bytes())
        return "already-present"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError(f"unexpected HTTP {response.status}")
            size = response.headers.get("Content-Length")
            if size and int(size) > MAX_BYTES:
                raise ValueError("remote PNG is too large")
            data = response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return "not-uploaded"
        raise
    verify_image(data)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_name(destination.name + ".tmp")
    try:
        tmp.write_bytes(data)
        tmp.replace(destination)
    finally:
        tmp.unlink(missing_ok=True)
    return "imported"

if __name__ == "__main__":
    print("Argos Orbis Imperial Bronze import:", import_approved_art())
