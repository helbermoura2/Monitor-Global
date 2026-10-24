"""Manual account maintenance. Never prints credentials or changes cron/bindings."""
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
import zipfile

API = 'https://api.cloudflare.com/client/v4'
WORKER = 'black-sky-9ba0'
PUBLIC = 'https://black-sky-9ba0.terrestre.workers.dev'
MARKER = 'removed-no-kv-v1'
WORKER_MODULES = 'maintenance-modules-v1'
TELEGRAM_SOLUTION_POLICY = 'reviewed-seismic-priority-v1'
TELEGRAM_IMAGE_STATUS = 'editorial-v16'
REQUEST_BUDGET = 'durable-request-budget-v1'
SOURCE_EDGE_BUDGET = 'shared-source-edge-v2'
DEMAND_BUDGET = 'demand-enrichment-v1'
PUBLIC_SOURCE_RUNTIME = 'edge-collectors-v1'
OPTIMIZATION = 'shared-population-voice-v1'
BUNDLE_SHA256 = '98ea3f08d2e3b9e54fb41eae7cf712ad4ed7047a22faaf170d90bc2c5e6c67eb'

class MaintenanceError(Exception):
    pass

def credentials(env):
    token, account = env.get('CLOUDFLARE_API_TOKEN','').strip(), env.get('CLOUDFLARE_ACCOUNT_ID','').strip()
    if not token: raise MaintenanceError('Missing repository secret CLOUDFLARE_API_TOKEN')
    if not re.fullmatch(r'[a-fA-F0-9]{32}',account): raise MaintenanceError('CLOUDFLARE_ACCOUNT_ID must contain only the 32-character account ID, not a URL or Worker ID')
    return token, account

def metadata(settings):
    bindings=settings.get('bindings')
    if not isinstance(bindings,list) or not bindings: raise MaintenanceError('Existing bindings unavailable; deployment refused')
    required={'TTS_USAGE':'kv_namespace','DAILY_SUMMARY':'durable_object_namespace','EARTHQUAKE_ALERTS':'durable_object_namespace'}
    by_name={b.get('name'):b.get('type') for b in bindings}
    if any(by_name.get(k)!=v for k,v in required.items()): raise MaintenanceError('Existing storage bindings differ from the reviewed Worker; deployment refused')
    date=settings.get('compatibility_date')
    if not isinstance(date,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date):raise MaintenanceError('Existing compatibility date unavailable; deployment refused')
    result={'main_module':'worker.mjs','compatibility_date':date,'keep_bindings':sorted(set(b['type'] for b in bindings)),'keep_assets':True,'annotations':{'workers/message':'Monitor Global: modular rendering, seismic adapters and Telegram transport'}}
    for k in ['compatibility_flags','limits','logpush','observability','placement','tail_consumers']:
        if k in settings and settings[k] is not None:result[k]=settings[k]
    return result

def bundle(path):
    data=Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=BUNDLE_SHA256:raise MaintenanceError('Reviewed bundle checksum mismatch')
    with zipfile.ZipFile(path) as z:source=z.read('monitor-global-worker-7_7_0.js')
    if PUBLIC_SOURCE_RUNTIME.encode() not in source or DEMAND_BUDGET.encode() not in source or SOURCE_EDGE_BUDGET.encode() not in source or REQUEST_BUDGET.encode() not in source or WORKER_MODULES.encode() not in source or b'shared-sources-v1' not in source or b'durable-history-v1' not in source or OPTIMIZATION.encode() not in source or MARKER.encode() not in source or b'maybeRefreshPollsAverageNightly' in source or b'POLLS_KV_KEY' in source:raise MaintenanceError('Bundle still contains polling collector or lacks the health marker')
    return source

def multipart(meta, source):
    boundary='mg-'+uuid.uuid4().hex
    parts=[]
    for name, filename, content_type, content in [('metadata',None,'application/json',json.dumps(meta).encode()),('worker.mjs','worker.mjs','application/javascript+module',source)]:
        disposition='Content-Disposition: form-data; name="'+name+'"'+('' if not filename else '; filename="'+filename+'"')
        parts.append(('--'+boundary+'\r\n'+disposition+'\r\nContent-Type: '+content_type+'\r\n\r\n').encode()+content+b'\r\n')
    return b''.join(parts)+('--'+boundary+'--\r\n').encode(),'multipart/form-data; boundary='+boundary

class Client:
    def __init__(self,token,account):self.token=token;self.account=account
    def call(self,path,method='GET',body=None,content_type='application/json'):
        req=urllib.request.Request(API+path,data=body,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':content_type,'User-Agent':'MonitorGlobal-maintenance'})
        try:
            with urllib.request.urlopen(req,timeout=60) as r:data=json.load(r)
        except urllib.error.HTTPError as e:
            # Only structured error codes/messages, never raw responses or request bodies.
            detail=''
            try:
                errors=json.load(e).get('errors',[])
                detail='; '.join(str(x.get('code','unknown'))+': '+str(x.get('message','request rejected')) for x in errors if isinstance(x,dict))
                for private in [self.token,self.account,metrics_token(self.token,self.account)]:detail=detail.replace(private,'[redacted]')
            except (ValueError,AttributeError):pass
            endpoint='analytics' if path=='/graphql' else method+' Worker '+path.split('/scripts/'+WORKER)[-1].split('?')[0]
            raise MaintenanceError('Cloudflare HTTP '+str(e.code)+' for '+endpoint+('; '+detail[:600] if detail else '; check permissions and configuration')) from None
        if data.get('success') is False or data.get('errors'):
            details=[str(e.get('code','unknown'))+': '+str(e.get('message','request rejected')) for e in data.get('errors',[]) if isinstance(e,dict)]
            safe='; '.join(details).replace(self.token,'[token]').replace(self.account,'[account]')[:600]
            raise MaintenanceError('Cloudflare rejected '+('analytics' if path=='/graphql' else 'Worker API')+'; '+safe)
        return data.get('result',data)
    def worker(self,suffix=''):return '/accounts/'+self.account+'/workers/scripts/'+WORKER+suffix

def analytics(client, now=None):
    now=now or dt.datetime.now(dt.timezone.utc);today=now.date();start=today-dt.timedelta(days=2)
    query='''query($accountTag:string!,$start:Date!,$end:Date!){viewer{accounts(filter:{accountTag:$accountTag}){kvOperationsAdaptiveGroups(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{requests} dimensions{date actionType namespaceId}}}}}'''
    data=client.call('/graphql','POST',json.dumps({'query':query,'variables':{'accountTag':client.account,'start':str(start),'end':str(today)}}).encode())
    accounts=data.get('data',{}).get('viewer',{}).get('accounts',[])
    if len(accounts)!=1:raise MaintenanceError('Analytics did not return this account; no zero-usage inference')
    rows=accounts[0].get('kvOperationsAdaptiveGroups')
    if not isinstance(rows,list) or len(rows)>=10000:raise MaintenanceError('Incomplete KV analytics response')
    return {'queriedAt':now.isoformat(),'calendar':'UTC; daily reset 00:00 UTC / 21:00 Sao Paulo','rows':rows,'note':'Adaptive analytics can be delayed or sampled; not an invoice or real-time quota meter.'}

def public_health():
    request=urllib.request.Request(PUBLIC+'/health?maintenance='+str(time.time_ns()),headers={'User-Agent':'MonitorGlobal-maintenance/1.0','Accept':'application/json','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=20) as r:return json.load(r)

def public_source_probe():
    # Three public, unpaid reads only. No Telegram delivery or administrative writes.
    path='/?url=https%3A%2F%2Fearthquake.usgs.gov%2Fearthquakes%2Ffeed%2Fv1.0%2Fsummary%2Fall_hour.geojson'
    rows=[]
    for attempt in range(3):
        request=urllib.request.Request(PUBLIC+path,headers={'User-Agent':'MonitorGlobal-maintenance/1.0','Accept':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=20) as response:
                response.read(3*1024*1024+1)
                rows.append({'attempt':attempt+1,'httpStatus':response.status,'state':response.headers.get('X-Monitor-Source-State'),'edge':response.headers.get('X-Monitor-Source-Edge')})
        except urllib.error.HTTPError as error:rows.append({'attempt':attempt+1,'httpStatus':error.code,'state':error.headers.get('X-Monitor-Source-State'),'edge':error.headers.get('X-Monitor-Source-Edge')})
        except OSError:rows.append({'attempt':attempt+1,'available':False})
    return {'reads':rows,'note':'Public feed reads; provider failures are retained as failures. No paid calls or delivery actions.'}

def verify_public(check=public_health, wait=time.sleep, attempts=25):
    failure='previous public version'
    for attempt in range(attempts):
        try:
            health=check()
            if health.get('publicSourceRuntime')==PUBLIC_SOURCE_RUNTIME and health.get('demandBudget')==DEMAND_BUDGET and health.get('sourceEdgeBudget')==SOURCE_EDGE_BUDGET and health.get('durableRequestBudget')==REQUEST_BUDGET and health.get('workerModules')==WORKER_MODULES and health.get('electionPolls')==MARKER and health.get('kvOptimization')==OPTIMIZATION and health.get('kvUsageMetrics') is True and health.get('telegramStorage')=='durable-history-v1' and health.get('telegramSolutionPolicy')==TELEGRAM_SOLUTION_POLICY and health.get('telegramImageStatus')==TELEGRAM_IMAGE_STATUS and health.get('sharedSources',{}).get('version')=='shared-sources-v1' and health.get('sharedSources',{}).get('enabled') is True:return health
        except urllib.error.HTTPError as e:failure='public HTTP '+str(e.code)
        except (OSError,ValueError):failure='public response unavailable or invalid'
        if attempt+1<attempts:wait(5)
    raise MaintenanceError('Public health has not confirmed the optimization markers ('+failure+'); use verify mode without redeploying')

def metrics_token(token,account):
    # A separate read-only credential; the Cloudflare API credential never reaches the Worker.
    return hmac.new(token.encode(),('MonitorGlobal:kv-metrics:'+account).encode(),hashlib.sha256).hexdigest()

def provision_metrics(client,token):
    client.call(client.worker('/secrets'),'PUT',json.dumps({'name':'KV_METRICS_READ_TOKEN','type':'secret_text','text':token}).encode())

def read_usage(token,day=None):
    request=urllib.request.Request(PUBLIC+'/kv-usage'+('?day='+day if day else ''),headers={'Authorization':'Bearer '+token,'User-Agent':'MonitorGlobal-maintenance/1.0','Accept':'application/json','Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(request,timeout=20) as r:return json.load(r)
    except urllib.error.HTTPError as e:return {'available':False,'httpStatus':e.code}
    except (OSError,ValueError):return {'available':False,'note':'Application metrics unavailable; not interpreted as zero.'}

def main():
    token,account=credentials(os.environ);client=Client(token,account);mode=os.environ.get('MAINTENANCE_MODE','inspect')
    if mode not in ['inspect','deploy','verify']:raise MaintenanceError('Invalid maintenance mode')
    settings=client.call(client.worker('/settings'));schedules=client.call(client.worker('/schedules'))
    report={'mode':mode,'worker':WORKER,'bindings':[{'name':b.get('name'),'type':b.get('type')} for b in settings.get('bindings',[])],'schedules':schedules,'compatibilityDate':settings.get('compatibility_date')}
    try:report['kv']=analytics(client)
    except MaintenanceError as e:report['analyticsUnavailable']=str(e)
    if mode=='deploy':
        metadata(settings);source=bundle('downloads/monitor-global-worker-otimizado.zip')
        # Preflight all required GETs before any mutation. Leave rollout history intact.
        deployments=client.call(client.worker('/deployments'))
        previous=deployments.get('deployments',[])
        if not previous or len(previous[0].get('versions',[]))!=1 or previous[0]['versions'][0].get('percentage')!=100:raise MaintenanceError('Expected a single active version at 100%; deployment refused')
        report['previousVersion']=previous[0]['versions'][0]['version_id']
        # A newer undeployed preview blocks unnecessary secret edits (error 10215).
        # Preserve the valid secret and all other bindings during the upload.
        meta=metadata(settings)
        body,content_type=multipart(meta,source)
        result=client.call(client.worker()+'?bindings_inherit=strict','PUT',body,content_type)
        report['uploaded']=True;report['deploymentId']=result.get('deployment_id')
        after=client.call(client.worker('/settings'))
        if sorted(after.get('bindings',[]),key=lambda b:b.get('name',''))!=sorted(settings.get('bindings',[]),key=lambda b:b.get('name','')):raise MaintenanceError('Post-deployment binding mismatch; inspect version history immediately')
        if client.call(client.worker('/schedules'))!=schedules:raise MaintenanceError('Post-deployment cron mismatch; inspect schedules immediately')
        access=read_usage(metrics_token(token,account))
        if access.get('httpStatus')==401:
            # Provision only when needed, after deploying the reviewed source.
            provision_metrics(client,metrics_token(token,account))
            report['metricsReadCredentialUpdated']=True
        health=verify_public()
        report['verified']={'publicSourceRuntime':health.get('publicSourceRuntime'),'demandBudget':health.get('demandBudget'),'sourceEdgeBudget':health.get('sourceEdgeBudget'),'durableRequestBudget':health.get('durableRequestBudget'),'workerModules':health.get('workerModules'),'electionPolls':health.get('electionPolls'),'kvOptimization':health.get('kvOptimization'),'kvUsageMetrics':health.get('kvUsageMetrics'),'telegramStorage':health.get('telegramStorage'),'telegramSolutionPolicy':health.get('telegramSolutionPolicy'),'telegramImageStatus':health.get('telegramImageStatus'),'sharedSources':health.get('sharedSources'),'dailySummaryDesign':health.get('dailySummaryDesign'),'rainbowProtectedBudget':health.get('rainbowNowcast',{}).get('protectedBudget'),'bindingsPreserved':True,'schedulesPreserved':True}
    else:
        # Verify compatibility now; inspection never modifies anything.
        metadata(settings)
        report['deploymentReady']=True
        if mode=='verify':
            health=verify_public()
            report['verified']={'publicSourceRuntime':health.get('publicSourceRuntime'),'demandBudget':health.get('demandBudget'),'sourceEdgeBudget':health.get('sourceEdgeBudget'),'durableRequestBudget':health.get('durableRequestBudget'),'workerModules':health.get('workerModules'),'electionPolls':health.get('electionPolls'),'kvOptimization':health.get('kvOptimization'),'kvUsageMetrics':health.get('kvUsageMetrics'),'telegramStorage':health.get('telegramStorage'),'telegramSolutionPolicy':health.get('telegramSolutionPolicy'),'telegramImageStatus':health.get('telegramImageStatus'),'sharedSources':health.get('sharedSources'),'dailySummaryDesign':health.get('dailySummaryDesign'),'rainbowProtectedBudget':health.get('rainbowNowcast',{}).get('protectedBudget'),'currentConfigurationValid':True,'redeployed':False}
    if mode=='verify':report['sourceProbe']=public_source_probe()
    report['applicationUsage']=read_usage(metrics_token(token,account))
    # Keep binding values, tokens, account ID and raw settings out of logs/artifacts.
    print(json.dumps(report,ensure_ascii=False,indent=2))
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a') as f:f.write('## Cloudflare Worker maintenance\n\n```json\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n```\n')
if __name__=='__main__':
    try:main()
    except MaintenanceError as e:print('Maintenance stopped: '+str(e),file=sys.stderr);sys.exit(1)
