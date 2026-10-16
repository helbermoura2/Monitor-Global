"""Manual account maintenance. Never prints credentials or changes cron/bindings."""
import datetime as dt
import hashlib
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
BUNDLE_SHA256 = 'e6def3c7ee29ae8d06baff31f336cdda99a5fa3a6d6140606b099b0b5980f670'

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
    result={'main_module':'worker.mjs','compatibility_date':date,'keep_bindings':sorted(set(b['type'] for b in bindings)),'keep_assets':True,'annotations':{'workers/message':'Monitor Global: remove electoral polling collector and its KV operations'}}
    for k in ['compatibility_flags','limits','logpush','observability','placement','tail_consumers']:
        if k in settings and settings[k] is not None:result[k]=settings[k]
    return result

def bundle(path):
    data=Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=BUNDLE_SHA256:raise MaintenanceError('Reviewed bundle checksum mismatch')
    with zipfile.ZipFile(path) as z:source=z.read('monitor-global-worker-7_7_0.js')
    if MARKER.encode() not in source or b'maybeRefreshPollsAverageNightly' in source or b'POLLS_KV_KEY' in source:raise MaintenanceError('Bundle still contains polling collector or lacks the health marker')
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
            # Do not print raw provider responses or the request headers/body.
            raise MaintenanceError('Cloudflare HTTP '+str(e.code)+' for '+('analytics' if path=='/graphql' else 'Worker API')+'; verify token permissions, account scope and expiry') from None
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
    with urllib.request.urlopen(PUBLIC+'/health?maintenance='+str(time.time_ns()),timeout=20) as r:return json.load(r)

def main():
    token,account=credentials(os.environ);client=Client(token,account);mode=os.environ.get('MAINTENANCE_MODE','inspect')
    if mode not in ['inspect','deploy']:raise MaintenanceError('Invalid maintenance mode')
    settings=client.call(client.worker('/settings'));schedules=client.call(client.worker('/schedules'))
    report={'mode':mode,'worker':WORKER,'bindings':[{'name':b.get('name'),'type':b.get('type')} for b in settings.get('bindings',[])],'schedules':schedules,'compatibilityDate':settings.get('compatibility_date')}
    try:report['kv']=analytics(client)
    except MaintenanceError as e:report['analyticsUnavailable']=str(e)
    if mode=='deploy':
        meta=metadata(settings);source=bundle('downloads/monitor-global-worker-sem-pesquisas.zip')
        # Preflight all required GETs before any mutation. Leave rollout history intact.
        deployments=client.call(client.worker('/deployments'))
        previous=deployments.get('deployments',[])
        if not previous or len(previous[0].get('versions',[]))!=1 or previous[0]['versions'][0].get('percentage')!=100:raise MaintenanceError('Expected a single active version at 100%; deployment refused')
        report['previousVersion']=previous[0]['versions'][0]['version_id']
        body,content_type=multipart(meta,source)
        result=client.call(client.worker()+'?bindings_inherit=strict','PUT',body,content_type)
        report['uploaded']=True;report['deploymentId']=result.get('deployment_id')
        after=client.call(client.worker('/settings'))
        if sorted(after.get('bindings',[]),key=lambda b:b.get('name',''))!=sorted(settings.get('bindings',[]),key=lambda b:b.get('name','')):raise MaintenanceError('Post-deployment binding mismatch; inspect version history immediately')
        if client.call(client.worker('/schedules'))!=schedules:raise MaintenanceError('Post-deployment cron mismatch; inspect schedules immediately')
        health=None
        for attempt in range(8):
            try:
                health=public_health()
                if health.get('electionPolls')==MARKER:break
            except (OSError,ValueError):pass
            if attempt<7:time.sleep(5)
        if not health or health.get('electionPolls')!=MARKER:raise MaintenanceError('Code uploaded, but public health has not confirmed the no-polls marker; inspect deployment')
        report['verified']={'electionPolls':health.get('electionPolls'),'dailySummaryDesign':health.get('dailySummaryDesign'),'rainbowProtectedBudget':health.get('rainbowNowcast',{}).get('protectedBudget'),'bindingsPreserved':True,'schedulesPreserved':True}
    else:
        # Verify compatibility now; inspection never modifies anything.
        metadata(settings)
        report['deploymentReady']=True
    # Keep binding values, tokens, account ID and raw settings out of logs/artifacts.
    print(json.dumps(report,ensure_ascii=False,indent=2))
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a') as f:f.write('## Cloudflare Worker maintenance\n\n```json\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n```\n')
if __name__=='__main__':
    try:main()
    except MaintenanceError as e:print('Maintenance stopped: '+str(e),file=sys.stderr);sys.exit(1)
