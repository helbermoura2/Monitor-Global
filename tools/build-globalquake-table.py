"""Repack GlobalQuake's Java tables without changing Float32 bits.
Dev-only dependencies: pip install javaobj-py3 numpy
Usage: python tools/build-globalquake-table.py /path/to/travel_table.dat
"""
import gzip, hashlib, json, pathlib, struct, sys
import javaobj.v2 as javaobj
import numpy as np
source = pathlib.Path(sys.argv[1])
with source.open('rb') as stream:
    original = javaobj.load(stream)
chunks, metadata = [], {}
for fields in original.field_data.values():
    for field, rows in fields.items():
        values = np.asarray(rows, dtype='<f4')
        words = values.view('<u4')
        delta = words.copy()
        delta[:, 1:] ^= words[:, :-1]
        planes = np.frombuffer(delta.tobytes(), dtype='u1').reshape(-1, 4).T.tobytes()
        metadata[field.name] = dict(rows=values.shape[0], cols=values.shape[1], bytes=len(planes))
        chunks.append(planes)
header = json.dumps(metadata, separators=(',', ':')).encode()
data = b'GQTT0001' + struct.pack('<I', len(header)) + header + b''.join(chunks)
target = pathlib.Path(__file__).resolve().parents[1] / 'assets/seismic/globalquake-iasp91.bin.gz'
target.write_bytes(gzip.compress(data, compresslevel=9, mtime=0))
print('Source SHA256:', hashlib.sha256(source.read_bytes()).hexdigest())
print('Packed SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())
