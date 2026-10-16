"""Read-only historical audit. No KV operations, raw logs, or runtime changes."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import uuid

spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('cloudflare-worker-maintenance.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def graphql(client,query,variables=None):
    data=client.call('/graphql','POST',json.dumps({'query':query,'variables':variables or {}}).encode())
    return data.get('data',{})
def fields(client,name):
    value=graphql(client,'query($name:String!){__type(name:$name){fields{name}}}',{'name':name})
    return [f['name'] for f in (value.get('__type') or {}).get('fields',[])]
def operation_rows(client,start,end,dimensions,temporal='date'):
    scalar='Date' if temporal=='date' else 'Time'
    suffix='date' if temporal=='date' else 'datetime'
    query='query($accountTag:string!,$start:'+scalar+'!,$end:'+scalar+'!){viewer{accounts(filter:{accountTag:$accountTag}){kvOperationsAdaptiveGroups(limit:10000,filter:{'+suffix+'_geq:$start,'+suffix+'_leq:$end}){sum{requests} dimensions{'+' '.join(dimensions)+'}}}}}'
    data=graphql(client,query,{'accountTag':client.account,'start':start,'end':end})
    accounts=data.get('viewer',{}).get('accounts',[])
    if len(accounts)!=1:raise m.MaintenanceError('Missing account; usage not inferred as zero')
    rows=accounts[0].get('kvOperationsAdaptiveGroups')
    if not isinstance(rows,list) or len(rows)>=10000:raise m.MaintenanceError('Missing or potentially truncated operations')
    return rows

def safe_log_aggregates(data):
    out=[]
    for calculation in data.get('calculations',[]):
        for row in calculation.get('aggregates',[]):
            groups=[]
            for group in row.get('groups',[]):
                key=group.get('key','');value=group.get('value')
                if key.endswith('.path'):
                    path=str(value or '').split('?',1)[0]
                    known=['/population-exposure','/tts','/translate-pt','/rain-nowcast','/rain-weather','/rainbow-tile','/global-feeds','/polls-average','/health','/telegram-m6-check','/telegram-daily-summary']
                    value=next((k for k in known if path==k or path.startswith(k+'/')),'other')
                elif key not in ['$metadata.type','$workers.eventType']:continue
                groups.append({'key':key,'value':value})
            out.append({'groups':groups,**{k:row[k] for k in ['value','count','sampleInterval'] if k in row}})
    return out

def telemetry(client,now,start):
    path='/accounts/'+client.account+'/workers/observability/telemetry/'
    timeframe={'from':int(start.timestamp()*1000),'to':int(now.timestamp()*1000)}
    keys=client.call(path+'keys','POST',json.dumps({'timeframe':timeframe,'datasets':[],'limit':500}).encode())
    if not isinstance(keys,list):raise m.MaintenanceError('Telemetry keys unavailable')
    names=[k.get('key') for k in keys if isinstance(k,dict)]
    service=next((key for key in ['$metadata.service','$workers.scriptName'] if key in names),None)
    route='$workers.event.request.path'
    if not service or route not in names:return {'availableKeys':names,'routeCountsUnavailable':True}
    groups=[{'value':route,'type':'string'}]
    for key in ['$metadata.type','$workers.eventType']:
        if key in names:groups.append({'value':key,'type':'string'})
    payload={'queryId':'mg-kv-audit-'+uuid.uuid4().hex,'timeframe':timeframe,'view':'calculations','chartType':'aggregate','dry':True,'ignoreSeries':True,'limit':2000,'parameters':{'datasets':[],'filters':[{'key':service,'operation':'eq','type':'string','value':m.WORKER}],'filterCombination':'and','groupBys':groups,'calculations':[{'operator':'count','alias':'events'}]}}
    result=client.call(path+'query','POST',json.dumps(payload).encode())
    return {'from':start.isoformat(),'to':now.isoformat(),'aggregates':safe_log_aggregates(result),'availableKeys':names,'note':'Recorded log events, possibly sampled; not exact KV operations. Query values and raw events are not exported.'}

def main():
    token,account=m.credentials(os.environ);client=m.Client(token,account);now=dt.datetime.now(dt.timezone.utc);today=now.date()
    report={'queriedAt':now.isoformat(),'readOnly':True,'calendar':'UTC','unavailable':{}}
    def collect(name,fn):
        try:report[name]=fn()
        except (m.MaintenanceError,ValueError,KeyError,OSError) as e:report['unavailable'][name]=str(e).replace(token,'[token]').replace(account,'[account]')[:700]
    settings=client.call(client.worker('/settings'))
    report['bindings']=[{'name':b.get('name'),'type':b.get('type'),'namespaceId':b.get('namespace_id')} for b in settings.get('bindings',[]) if b.get('type')=='kv_namespace']
    obs=settings.get('observability') or {};report['observability']={k:obs[k] for k in ['enabled','head_sampling_rate','logs'] if k in obs}
    report['schedules']=client.call(client.worker('/schedules'))
    collect('kvDimensionFields',lambda:fields(client,'AccountKvOperationsAdaptiveGroupsDimensions'))
    collect('daily',lambda:operation_rows(client,str(today-dt.timedelta(days=7)),str(today),['date','namespaceId','actionType']))
    dims=report.get('kvDimensionFields',[])
    if 'datetimeHour' in dims:collect('hourly',lambda:operation_rows(client,(now-dt.timedelta(days=2)).isoformat(),now.isoformat(),['datetimeHour','namespaceId','actionType'],'datetime'))
    if 'datetimeFiveMinutes' in dims:collect('fiveMinutes',lambda:operation_rows(client,(now-dt.timedelta(hours=4)).isoformat(),now.isoformat(),['datetimeFiveMinutes','namespaceId','actionType'],'datetime'))
    if 'scriptName' in dims:collect('byWorker',lambda:operation_rows(client,str(today-dt.timedelta(days=2)),str(today),['date','namespaceId','actionType','scriptName']))
    collect('logs24h',lambda:telemetry(client,now,now-dt.timedelta(hours=24)))
    collect('logsAfterDeployment',lambda:telemetry(client,now,dt.datetime(2026,10,16,14,53,tzinfo=dt.timezone.utc)))
    print(json.dumps(report,ensure_ascii=False,indent=2));out=Path('audit-results');out.mkdir(exist_ok=True);(out/'cloudflare-kv-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
