"""Read-only account consumption and notification capabilities; no bill/plan/policy changes."""
import datetime as dt
import importlib.util
import json
import os
import re
from pathlib import Path

spec=importlib.util.spec_from_file_location('durable_audit',Path(__file__).with_name('cloudflare-durable-audit.py'))
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)

class ReadOnlyClient(d.m.Client):
    def call(self,path,method='GET',body=None,content_type='application/json'):
        allowed={'/accounts/'+self.account+x for x in ['/subscriptions','/alerting/v3/available_alerts','/alerting/v3/destinations/eligible','/alerting/v3/policies']}
        if path=='/graphql' and method=='POST':
            if not re.match(r'^\s*query\b',json.loads(body).get('query','')):raise ValueError('Only GraphQL queries are allowed')
        elif method!='GET' or path not in allowed:raise ValueError('Mutation or unreviewed endpoint refused')
        return super().call(path,method,body,content_type)

def alert_types(value):
    out=[]
    def visit(v):
        if isinstance(v,list):
            for x in v:visit(x)
        elif isinstance(v,dict):
            kind=v.get('type') or v.get('alert_type')
            if isinstance(kind,str):out.append({k:v[k] for k in ['type','alert_type','display_name','description'] if isinstance(v.get(k),str)})
            else:
                for x in v.values():visit(x)
    visit(value)
    return out

def policies(value):
    rows=value if isinstance(value,list) else value.get('policies',[]) if isinstance(value,dict) else []
    return [{'alertType':p.get('alert_type'),'enabled':p.get('enabled'), 'destinationCounts':{k:len(v) for k,v in (p.get('mechanisms') or {}).items() if isinstance(v,list)}} for p in rows if isinstance(p,dict)]

def destinations(value):
    if not isinstance(value,dict):return {'available':False}
    return {k:({'eligible':v} if isinstance(v,bool) else {name:v[name] for name in ['eligible','ready'] if name in v}) for k,v in value.items() if isinstance(v,(dict,bool))}

def subscriptions(value):
    if not isinstance(value,list):return []
    out=[]
    for item in value:
        plan=item.get('rate_plan') or {}
        out.append({'plan':plan.get('public_name') or plan.get('id'),'state':item.get('state'),'frequency':item.get('frequency'),'currency':item.get('currency') or plan.get('currency'),'reportedPrice':item.get('price') if isinstance(item.get('price'),(int,float)) else None})
    return out

def scalar(value):
    while value.get("ofType"):value=value["ofType"]
    return value.get("kind")=="SCALAR"

def dataset(client,field,now,lookback_days=2,extra_dimensions=()):
    shape={f['name']:f for f in d.schema(client,d.typename(field['type'])).get('fields',[])}
    aggregate='sum' if 'sum' in shape else 'max' if 'max' in shape else None
    if aggregate is None or 'dimensions' not in shape:raise ValueError('Dataset has no supported aggregate/dimensions')
    sum_type=d.typename(shape[aggregate]['type'])
    sums=d.graphql(client,'query{__type(name:'+json.dumps(sum_type)+'){fields{name description type{'+d.TYPE+'}}}}').get('__type',{}).get('fields',[])
    metrics=[f['name'] for f in sums if any(x in f['name'].lower() for x in ['request','error','duration','cputime','gbsecond','rowsread','rowswritten','byte','keycount','neurons','tokens','cost','storage','readunits','writeunits']) and scalar(f['type'])]
    if not metrics:raise ValueError('No supported consumption metrics; not inferred as zero')
    dims=[f['name'] for f in d.schema(client,d.typename(shape['dimensions']['type'])).get('fields',[])]
    chosen=([ 'date' ] if 'date' in dims else ['datetimeHour'] if 'datetimeHour' in dims else [])+(['scriptName'] if 'scriptName' in dims else [])
    chosen += [x for x in extra_dimensions if x in dims and x not in chosen]
    if not chosen:raise ValueError('Dataset has no supported safe grouping')
    args={a['name']:a for a in field.get('args',[])}
    filters={f['name'] for f in d.schema(client,d.typename(args['filter']['type'])).get('inputFields',[])}
    temporal='date' if 'date_geq' in filters else 'datetime'
    start=(now-dt.timedelta(days=lookback_days)).date();begin=str(start) if temporal=='date' else str(start)+'T00:00:00Z';end=str(now.date()) if temporal=='date' else now.isoformat().replace('+00:00','Z')
    name=field['name'];query='query{viewer{accounts(filter:{accountTag:'+json.dumps(client.account)+'}){'+name+'(limit:10000,filter:{'+temporal+'_geq:'+json.dumps(begin)+','+temporal+'_leq:'+json.dumps(end)+'}){'+aggregate+'{'+' '.join(metrics)+'} dimensions{'+' '.join(chosen)+'}}}}}'
    accounts=d.graphql(client,query).get('viewer',{}).get('accounts',[])
    rows=accounts[0].get(name) if len(accounts)==1 else None
    if not isinstance(rows,list) or len(rows)>=10000:raise ValueError('Missing or potentially truncated analytics')
    return {'from':begin,'until':end,'aggregate':aggregate,'metricDescriptions':{f['name']:f.get('description') for f in sums if f['name'] in metrics},'metrics':metrics,'dimensions':chosen,'rows':rows,'note':'Adaptive analytics may be sampled/delayed; current UTC day is partial. Not an invoice.'}

def main():
    token,account=d.m.credentials(os.environ);client=ReadOnlyClient(token,account);now=dt.datetime.now(dt.timezone.utc)
    report={'queriedAt':now.isoformat(),'readOnly':True,'unavailable':{},'analytics':{},'note':'No plans, policies or recipients changed. Missing analytics is not zero; reported plan prices are not a consolidated invoice.'}
    def collect(key,fn):
        try:return fn()
        except (d.m.MaintenanceError,ValueError,KeyError,TypeError,OSError) as e:report['unavailable'][key]=str(e).replace(token,'[token]').replace(account,'[account]')[:500];return None
    base='/accounts/'+account
    report['subscriptions']=collect('subscriptions',lambda:subscriptions(client.call(base+'/subscriptions')))
    report['notificationOptions']=collect('notificationOptions',lambda:alert_types(client.call(base+'/alerting/v3/available_alerts')))
    report['notificationDestinations']=collect('notificationDestinations',lambda:destinations(client.call(base+'/alerting/v3/destinations/eligible')))
    report['notificationPolicies']=collect('notificationPolicies',lambda:policies(client.call(base+'/alerting/v3/policies')))
    def analytics():
        root=d.graphql(client,'query{__schema{queryType{fields{name type{'+d.TYPE+'}}}}}')
        viewer=next(f for f in root['__schema']['queryType']['fields'] if f['name']=='viewer');accounts=next(f for f in d.schema(client,d.typename(viewer['type']))['fields'] if f['name']=='accounts')
        fields=d.schema(client,d.typename(accounts['type'])).get('fields',[])
        matches=[f for f in fields if any(x in f['name'].lower() for x in ['workersinvocations','durableobject','kvoperations','kvstorage','aiinference','workersai'])]
        report['availableDatasets']=[f['name'] for f in matches]
        selected=[f for f in matches if f['name'].endswith('Groups') or f['name']=='workersInvocationsAdaptive' or 'aiinference' in f['name'].lower() or 'workersai' in f['name'].lower()][:12]
        for f in selected:
            value=collect(f['name'],lambda f=f:dataset(client,f,now))
            if value is not None:report['analytics'][f['name']]=value
    collect('analyticsSchema',analytics)
    out=Path('audit-results');out.mkdir(exist_ok=True);(out/'cloudflare-account-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    lines=['## Cloudflare: consumo e opções de avisos','',f"Consulta UTC: {report['queriedAt']}",'','Consulta somente de leitura; não é uma fatura. Não foram configurados destinatários nem alterados planos.','',f"Datasets obtidos: {len(report['analytics'])}. Consultas indisponíveis: {len(report['unavailable'])}.",'','Consulte o artifact JSON para métricas e limitações. Ausência de uma métrica não significa consumo zero.']
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write('\n'.join(lines)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
