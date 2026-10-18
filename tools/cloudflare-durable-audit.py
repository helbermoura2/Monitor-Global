"""Read Cloudflare aggregate analytics only; never invoke objects or modify a Worker."""
import datetime as dt
import importlib.util
import json
import os
import uuid
import urllib.request
from pathlib import Path

spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('cloudflare-worker-maintenance.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TYPE='name kind ofType{name kind ofType{name kind ofType{name kind}}}'
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
    root=graphql(client,'query{__schema{queryType{fields{name type{'+TYPE+'}}}}}')
    viewer=next(f for f in root['__schema']['queryType']['fields'] if f['name']=='viewer')
    accounts=next(f for f in schema(client,typename(viewer['type']))['fields'] if f['name']=='accounts')
    account_type=typename(accounts['type'])
    fields=schema(client,account_type).get('fields',[])
    datasets=[f for f in fields if 'durable' in f['name'].lower()]
    report={'queriedAt':now.isoformat(),'readOnly':True,'reset':'00:00 UTC / 21:00 Sao Paulo','accountType':account_type,'accountFieldCount':len(fields),'datasets':[f['name'] for f in datasets],'results':{},'unavailable':{},'note':'Aggregate analytics may be delayed or sampled. Requests and storage rows are distinct quotas; missing analytics is not zero.'}
    report['storageSchema']={}
    for dataset in datasets:
        name=dataset['name']
        if not any(part in name.lower() for part in ['invocation','storage']):continue
        try:
            shape={f['name']:f for f in schema(client,typename(dataset['type'])).get('fields',[])}
            if 'storage' in name.lower():
                report['storageSchema'][name]={key:[f['name'] for f in schema(client,typename(value['type'])).get('fields',[])] for key,value in shape.items() if key in ['sum','max','dimensions']}
            if 'sum' not in shape or 'dimensions' not in shape:continue
            sums=[f['name'] for f in schema(client,typename(shape['sum']['type'])).get('fields',[])]
            dimensions=[f['name'] for f in schema(client,typename(shape['dimensions']['type'])).get('fields',[])]
            wanted=[f for f in ['requests','errors','rowsRead','rowsWritten','readUnits','writeUnits','readRequests','writeRequests','deleteRequests','readCount','writeCount'] if f in sums]
            if not wanted:continue
            args={a['name']:a for a in dataset.get('args',[])}
            filters={f['name'] for f in schema(client,typename(args['filter']['type'])).get('inputFields',[])}
            temporal='date' if 'date_geq' in filters else 'datetime'
            begin=str(start) if temporal=='date' else str(start)+'T00:00:00Z'
            end=str(now.date()) if temporal=='date' else now.isoformat().replace('+00:00','Z')
            dims=[f for f in ['date','datetimeHour','scriptName','className','namespaceId','objectId','name','type','status','requestSource'] if f in dimensions]
            # Prefer daily grouping; hourly is only a fallback if date is absent.
            if 'date' in dims and 'datetimeHour' in dims:dims.remove('datetimeHour')
            query='query{viewer{accounts(filter:{accountTag:'+json.dumps(account)+'}){'+name+'(limit:10000,filter:{'+temporal+'_geq:'+json.dumps(begin)+','+temporal+'_leq:'+json.dumps(end)+'}){sum{'+' '.join(wanted)+'} dimensions{'+' '.join(dims)+'}}}}}'
            accounts=graphql(client,query).get('viewer',{}).get('accounts',[])
            if len(accounts)!=1:raise m.MaintenanceError('Account analytics unavailable')
            rows=accounts[0].get(name)
            if not isinstance(rows,list) or len(rows)>=10000:raise m.MaintenanceError('Missing or potentially truncated result')
            report['results'][name]={'sumFields':sums,'dimensionFields':dimensions,'rows':rows}
        except (m.MaintenanceError,KeyError,TypeError,ValueError) as error:report['unavailable'][name]=str(error).replace(token,'[token]').replace(account,'[account]')[:600]
    try:
        begin=(now-dt.timedelta(minutes=30)).isoformat().replace('+00:00','Z')
        query='query{viewer{accounts(filter:{accountTag:'+json.dumps(account)+'}){durableObjectsInvocationsAdaptiveGroups(limit:10000,filter:{datetime_geq:'+json.dumps(begin)+',datetime_leq:'+json.dumps(now.isoformat().replace('+00:00','Z'))+'}){sum{requests errors} dimensions{datetimeMinute name status type}}}}}'
        accounts=graphql(client,query).get('viewer',{}).get('accounts',[])
        rows=accounts[0].get('durableObjectsInvocationsAdaptiveGroups') if len(accounts)==1 else None
        if not isinstance(rows,list) or len(rows)>=10000:raise m.MaintenanceError('Missing or truncated recent invocations')
        report['lastThirtyMinutes']={'since':begin,'rows':rows}
    except Exception as error:report['unavailable']['recentInvocations']=str(error).replace(token,'[token]').replace(account,'[account]')[:600]
    try:
        report['deployments']=client.call(client.worker('/deployments'))
        req=urllib.request.Request(m.API+client.worker(),headers={'Authorization':'Bearer '+token})
        with urllib.request.urlopen(req,timeout=30) as response: source=response.read().decode('utf8',errors='replace')
        report['deployedSource']={'largeTelegramChunks':bool(__import__('re').search(r'400[ _]?000',source)),'budgetVersion':'durable-request-budget-v1' in source}
    except Exception as error:report['unavailable']['deployedSource']=type(error).__name__
    try:
        base='/accounts/'+account+'/workers/observability/telemetry/'
        timeframe={'from':int((now-dt.timedelta(hours=1)).timestamp()*1000),'to':int(now.timestamp()*1000)}
        keys=client.call(base+'keys','POST',json.dumps({'timeframe':timeframe,'datasets':[],'limit':500}).encode())
        names=[k.get('key') for k in keys if isinstance(k,dict)]
        report['telemetryKeys']=names
        service=next((k for k in ['$metadata.service','$workers.scriptName'] if k in names),None)
        message=next((k for k in ['$metadata.error','$workers.error.message','message'] if k in names),None)
        if service and message:
            payload={'queryId':'durable-errors-'+uuid.uuid4().hex,'timeframe':timeframe,'view':'calculations','chartType':'aggregate','dry':True,'ignoreSeries':True,'limit':2000,'parameters':{'datasets':[],'filters':[{'key':service,'operation':'eq','type':'string','value':m.WORKER}],'filterCombination':'and','groupBys':[{'value':message,'type':'string'}],'calculations':[{'operator':'count','alias':'events'}]}}
            result=client.call(base+'query','POST',json.dumps(payload).encode()); categories={}
            for calc in result.get('calculations',[]):
                for row in calc.get('aggregates',[]):
                    text=' '.join(str(g.get('value','')).lower() for g in row.get('groups',[]))
                    category=next((label for words,label in [(['exceeded','limit'],'quota exceeded'),(['too many','request'],'request limit'),(['sqlite','full'],'SQLite full'),(['too large'],'value too large'),(['memory'],'memory'),(['cpu'],'CPU'),(['recursive'],'recursion'),(['overloaded'],'overloaded')] if all(w in text for w in words)),'other (message withheld)')
                    categories[category]=categories.get(category,0)+(row.get('count') or row.get('value') or 0)
            report['errorCategoriesLastHour']=categories
    except Exception as error:report['unavailable']['telemetry']=str(error).replace(token,'[token]').replace(account,'[account]')[:600]
    path=Path('audit-results');path.mkdir(exist_ok=True)
    text=json.dumps(report,ensure_ascii=False,indent=2);(path/'durable-requests.json').write_text(text);print(text)
    if not report['results']:raise SystemExit('Durable analytics unavailable; do not infer zero usage.')
if __name__=='__main__':main()
