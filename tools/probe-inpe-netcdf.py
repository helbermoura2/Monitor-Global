"""Diagnostic only: inspect real radar coordinates and values before mapping.
No guessing CRS or orientation from thumbnail colours."""
import json, sys, tempfile, urllib.request, urllib.parse
from pathlib import Path
import numpy as np
from netCDF4 import Dataset
from PIL import Image

MAX=32*1024*1024
def safe_url(url):
    u=urllib.parse.urlparse(url)
    return u.scheme=='https' and not u.username and not u.password and u.port in (None,443) and (u.hostname=='inpe.br' or (u.hostname or '').endswith('.inpe.br'))
class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if not safe_url(newurl): raise ValueError('Redirect outside INPE')
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def download(url,destination,limit):
    if not safe_url(url): raise ValueError('Invalid source')
    with urllib.request.build_opener(Redirect()).open(url,timeout=30) as r, open(destination,'wb') as out:
        length=int(r.headers.get('Content-Length') or 0)
        if length>limit: raise ValueError('Asset exceeds budget')
        size=0
        while chunk:=r.read(65536):
            size+=len(chunk)
            if size>limit: raise ValueError('Asset exceeds budget')
            out.write(chunk)
    return size

def inspect(path,expected):
    with Dataset(path) as ds:
        assert 'dbz' in ds.variables,'Missing official dbz variable'
        var=ds.variables['dbz']
        shape=tuple(var.shape)
        assert shape[-2:]==(500,500),shape
        if expected==15: assert len(shape)>=3 and shape[-3]==15,shape
        else: assert len(shape)==2 or all(d==1 for d in shape[:-2]),shape
        info={'dimensions':dict((k,len(v)) for k,v in ds.dimensions.items()),'dbz_dimensions':var.dimensions,'shape':shape,'dbz_units':str(getattr(var,'units','')),'global_attrs':{k:str(ds.getncattr(k))[:500] for k in ds.ncattrs()},'coordinates':{}}
        for name,v in ds.variables.items():
            if name=='dbz':continue
            row={'dimensions':v.dimensions,'shape':v.shape,'units':str(getattr(v,'units','')),'standard_name':str(getattr(v,'standard_name','')),'attrs':{k:str(v.getncattr(k))[:500] for k in v.ncattrs()}}
            if v.size<=250000 and np.issubdtype(v.dtype,np.number):
                data=np.ma.asarray(v[:],dtype=float).filled(np.nan)
                if np.any(np.isfinite(data)):
                    row.update(min=float(np.nanmin(data)),max=float(np.nanmax(data)),first=float(data.flat[0]) if np.isfinite(data.flat[0]) else None,last=float(data.flat[-1]) if np.isfinite(data.flat[-1]) else None)
                    if data.ndim==1 and data.size>1: row['monotonic']=bool(np.all(np.diff(data)>0) or np.all(np.diff(data)<0))
                    if data.size<=20:row['values']=[float(x) if np.isfinite(x) else None for x in data.flat]
            info['coordinates'][name]=row
        values=np.ma.asarray(var[:],dtype=float).filled(np.nan)
        finite=values[np.isfinite(values)]
        info['finite_dbz']=int(finite.size)
        info['dbz_range']=[float(finite.min()),float(finite.max())] if finite.size else None
        print(json.dumps(info,ensure_ascii=False,indent=2))
        return info

sample=json.loads(Path(sys.argv[1]).read_text())
print('Sample:',sample['id'],'bbox:',sample['bounds'])
with tempfile.TemporaryDirectory() as tmp:
    found=False
    for product,levels in [('cappi3km',1),('cappi15l',15)]:
        asset=sample['products'].get(product)
        if not asset:continue
        found=True
        target=Path(tmp)/(product+'.nc')
        size=download(asset['href'],target,MAX)
        print(product,'bytes',size)
        inspect(target,levels)
    assert found,'No available NetCDF product'
    if sample['products'].get('thumbnail'):
        target=Path(tmp)/'preview.png'
        print('PNG bytes:',download(sample['products']['thumbnail']['href'],target,4*1024*1024))
        with Image.open(target) as image:
            assert image.size==(500,500)
            rgba=np.asarray(image.convert('RGBA'))
            print('PNG alpha range:',int(rgba[:,:,3].min()),int(rgba[:,:,3].max()))
    print('Schema inspected. Review axis order and pixel alignment before rendering; no map activated.')
