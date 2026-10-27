"""Only backend build watch paths; never static hosting, credentials, commands or branches."""
import importlib.util,json,os,re
from pathlib import Path
spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('cloudflare-worker-maintenance.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
POLICY={'path_includes':['monitor-global-worker-7_7_0.js','*.mjs','worker/**','js/**','data/**','wrangler.toml','package.json','package-lock.json','tools/**','downloads/monitor-global-worker-otimizado.zip'],'path_excludes':[]}
def apply(client,write=False):
    scripts=client.call('/accounts/'+client.account+'/workers/scripts')
    backend=next((s for s in scripts if s.get('id')=='black-sky-9ba0'),None)
    tag=(backend or {}).get('tag','')
    if not re.fullmatch('[a-f0-9]{32}',tag):raise ValueError('Backend Worker tag unavailable; no changes')
    base='/accounts/'+client.account+'/builds'
    triggers=client.call(base+'/workers/'+tag+'/triggers')
    if isinstance(triggers,dict):triggers=triggers.get('triggers')
    if not isinstance(triggers,list) or len(triggers)!=1:raise ValueError('Expected exactly one backend trigger; no changes')
    t=triggers[0];uid=t.get('trigger_uuid','')
    if not re.fullmatch('[a-f0-9-]{32,36}',uid):raise ValueError('Invalid trigger ID; no changes')
    before={k:t.get(k) for k in POLICY};result={'worker':'black-sky-9ba0','before':before,'proposed':POLICY,'applied':False,'staticHostingChanged':False}
    if write:
        client.call(base+'/triggers/'+uid,'PATCH',json.dumps(POLICY).encode())
        checked=client.call(base+'/workers/'+tag+'/triggers')
        if isinstance(checked,dict):checked=checked.get('triggers',[])
        after=next((x for x in checked if x.get('trigger_uuid')==uid),{})
        if any(after.get(k)!=v for k,v in POLICY.items()):raise ValueError('Filter verification failed; inspect configuration')
        # Do not persist commands, repository connection details or build token identifiers.
        result['applied']=True
    return result
if __name__=='__main__':
    report={'applied':False}
    try:
        token,account=m.credentials(os.environ);report=apply(m.Client(token,account),os.environ.get('APPLY_BUILD_FILTERS')=='true')
    except Exception as e:report={'applied':False,'blocked':True,'reason':str(e)[:1000]}
    Path('audit-results').mkdir(exist_ok=True);Path('audit-results/build-filters.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
    if report.get('blocked'):raise SystemExit(2)
