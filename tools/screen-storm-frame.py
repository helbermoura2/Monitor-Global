"""CI-only screening of real CAPPI frames. No relaxed thresholds."""
import json,sys
import numpy as np
from netCDF4 import Dataset
from scipy.ndimage import label
with Dataset(sys.argv[1]) as ds:
    v=ds.variables['dbz']
    if v.dimensions!=('time','lat','lon') or v.shape!=(1,500,500):
        raise ValueError('Unexpected CAPPI shape')
    z=np.ma.asarray(v[0],dtype=float).filled(np.nan)
    valid=np.isfinite(z)&(z>=-30)&(z<=100)&(z!=-99)
    labels,n=label(valid&(z>=40),structure=np.array([[0,1,0],[1,1,1],[0,1,0]]))
    sizes=np.bincount(labels.ravel(),minlength=n+1)
    print(json.dumps({'objects':int(np.count_nonzero(sizes[1:]>=9)),'peakDbz':float(z[valid].max()) if valid.any() else None,'validFraction':float(valid.mean())}))
