"""Independent SciPy reference for actual CAPPI observations."""
import json
from pathlib import Path
import numpy as np
from netCDF4 import Dataset
from scipy.ndimage import label,find_objects
ROOT=Path('/tmp/argos-storm-sequences')
manifest=json.loads((ROOT/'manifest.json').read_text())
def load(f,meta):
    with Dataset(f['file']) as ds:
        v=ds.variables['dbz']
        if v.dimensions!=('time','lat','lon') or v.shape!=(1,500,500):raise ValueError('Unexpected CAPPI shape')
        x=np.asarray(ds.variables['lon'][:],dtype=float);y=np.asarray(ds.variables['lat'][:],dtype=float)
        z=np.ma.asarray(v[0],dtype=float).filled(np.nan)
        valid=np.isfinite(z)&(z>=-30)&(z<=100)&(z!=-99)
        labels,n=label(valid&(z>=40),structure=np.array([[0,1,0],[1,1,1],[0,1,0]]))
        objects=[]
        for i,sl in enumerate(find_objects(labels),start=1):
            if sl is None:continue
            rows,cols=np.where(labels[sl]==i);rows=rows+sl[0].start;cols=cols+sl[1].start
            if len(rows)<9:continue
            objects.append({'center':[float(x[cols].mean()),float(y[rows].mean())],'pixels':int(len(rows)),'peakDbz':float(z[rows,cols].max())})
        overflow=len(objects)>80
        return {'time':f['time'],'radar':meta['radar'],'owner':meta['owner'],'product':meta['product'],'altitude':meta['altitude'],'lon':x.tolist(),'lat':y.tolist(),'values':[float(a) if ok else None for a,ok in zip(z.ravel(),valid.ravel())],'reference':[] if overflow else objects,'overflow':overflow,'validFraction':float(valid.mean())}
for i,seq in enumerate(manifest):
    frames=[load(f,seq) for f in seq['frames']]
    (ROOT/f'{i}.json').write_text(json.dumps({'meta':seq,'frames':frames},allow_nan=False))
    print(json.dumps({'sequence':i,'radar':seq['radar'],'mode':seq['mode'],'referenceObjects':[len(f['reference']) for f in frames]}),flush=True)
