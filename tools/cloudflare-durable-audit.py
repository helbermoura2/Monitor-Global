"""Read Cloudflare aggregate analytics only; never invoke objects or modify a Worker."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path

spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('cloudflare-worker-maintenance.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TYPE='name kind ofType{name kind ofType{name kind}}'
def graphql(client,query):
    result=client.call('/graphql','POST',json.dumps({'query':query}).encode())
    if result.get('errors'):raise m.MaintenanceError('Analytics query rejected: '+json.dumps(result['errors'])[:500])
    return result.get('data',{})
def schema(client,name):
    query='query{__type(name:'+json.dumps(name)+'){fields{name type{'+TYPE+'} args{name type{'+TYPE+'}}} inputFields{name}}}'
    return graphql(client,query).get('__type') or {}
def typename(value):
    while value and not value.get('name'):value=value.get('ofType')
    return value.get('name') if value else None

def main():
    token,account=m.credentials(os.environ);client=m.Client(token,account)
    now=dt.datetime.now(dt.timezone.utc);start=(now-dt.timedelta(days=1)).date()
    fields=schema(client,'Account').get('fields',[])
    datasets=[f for f in fields if f['name'].startswith('durableObjects')]
    report={'queriedAt':now.isoformat(),'readOnly':True,'reset':'00:00 UTC / 21:00 Sao Paulo','datasets':[f['name'] for f in datasets],'results':{},'unavailable':{},'note':'Aggregate analytics may be delayed or sampled. Requests and storage rows are distinct quotas; missing analytics is not zero.'}
    for dataset in datasets:
        name=dataset['name']
        if not any(part in name.lower() for part in ['invocation','storage']):continue
        try:
            shape={f['name']:f for f in schema(client,typename(dataset['type'])).get('fields',[])}
            if 'sum' not in shape or 'dimensions' not in shape:continue
            sums=[f['name'] for f in schema(client,typename(shape['sum']['type'])).get('fields',[])]
            dimensions=[f['name'] for f in schema(client,typename(shape['dimensions']['type'])).get('fields',[])]
            wanted=[f for f in ['requests','rowsRead','rowsWritten','readUnits','writeUnits'] if f in sums]
            if not wanted:continue
            args={a['name']:a for a in dataset.get('args',[])}
            filters={f['name'] for f in schema(client,typename(args['filter']['type'])).get('inputFields',[])}
            temporal='date' if 'date_geq' in filters else 'datetime'
            begin=str(start) if temporal=='date' else str(start)+'T00:00:00Z'
            end=str(now.date()) if temporal=='date' else now.isoformat().replace('+00:00','Z')
            dims=[f for f in ['date','datetimeHour','scriptName','className','namespaceId','type','status','requestSource'] if f in dimensions]
            # Prefer daily grouping; hourly is only a fallback if date is absent.
            if 'date' in dims and 'datetimeHour' in dims:dims.remove('datetimeHour')
            query='query{viewer{accounts(filter:{accountTag:'+json.dumps(account)+'}){'+name+'(limit:10000,filter:{'+temporal+'_geq:'+json.dumps(begin)+','+temporal+'_leq:'+json.dumps(end)+'}){sum{'+' '.join(wanted)+'} dimensions{'+' '.join(dims)+'}}}}}'
            accounts=graphql(client,query).get('viewer',{}).get('accounts',[])
            if len(accounts)!=1:raise m.MaintenanceError('Account analytics unavailable')
            rows=accounts[0].get(name)
            if not isinstance(rows,list) or len(rows)>=10000:raise m.MaintenanceError('Missing or potentially truncated result')
            report['results'][name]={'sumFields':sums,'dimensionFields':dimensions,'rows':rows}
        except (m.MaintenanceError,KeyError,TypeError,ValueError) as error:report['unavailable'][name]=str(error).replace(token,'[token]').replace(account,'[account]')[:600]
    path=Path('audit-results');path.mkdir(exist_ok=True)
    text=json.dumps(report,ensure_ascii=False,indent=2);(path/'durable-requests.json').write_text(text);print(text)
    if not report['results']:raise SystemExit('Durable analytics unavailable; do not infer zero usage.')
if __name__=='__main__':main()
