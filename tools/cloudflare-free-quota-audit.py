"""Recurring Free quota report. Only aggregate API reads; no production probes or paid-plan queries."""
import datetime as dt
import importlib.util
import json
import os
import re
from collections import Counter,defaultdict
from pathlib import Path
spec=importlib.util.spec_from_file_location('account_audit',Path(__file__).with_name('cloudflare-account-audit.py'));a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
d=a.d
POLICY=Path(__file__).with_name('free-quota-policy.json')
health_spec=importlib.util.spec_from_file_location('system_health_summary',Path(__file__).with_name('system_health_summary.py'));health=importlib.util.module_from_spec(health_spec);health_spec.loader.exec_module(health)

class FreeClient(d.m.Client):
    def call(self,path,method='GET',body=None,content_type='application/json'):
        base='/accounts/'+self.account
        allowed=path==base+'/workers/scripts' or path in [base+'/workers/scripts/'+w+'/settings' for w in ['black-sky-9ba0','monitor']] or bool(re.fullmatch(re.escape(base)+r'/builds/workers/[a-zA-Z0-9_-]+/(?:builds|triggers)',path))
        if path=='/graphql' and method=='POST':
            if not re.match(r'^\s*query\b',json.loads(body).get('query','')):raise ValueError('Only aggregate queries allowed')
        elif method!='GET' or not allowed:raise ValueError('Unreviewed endpoint or mutation refused')
        return super().call(path,method,body,content_type)

def level(percent,policy):
    for name in ['exceeded','critical','high','watch']:
        if percent>=policy['thresholds'][name]:return name
    return 'normal'

def usage(value,key,policy,note=None):
    limit=policy['limits'][key]
    if value is None:return {'label':limit.get('label',key),'available':False,'limit':limit['limit'],'unit':limit['unit'],'level':'unknown','note':note or 'Métrica não obtida; não interpretada como zero.'}
    percent=100*value/limit['limit'];return {'label':limit.get('label',key),'available':True,'value':value,'limit':limit['limit'],'unit':limit['unit'],'percent':round(percent,5),'level':level(percent,policy),**({'note':note} if note else {})}

def totals(dataset):
    grouped={}
    if not dataset:return grouped
    kind=dataset.get('aggregate','sum')
    for row in dataset.get('rows',[]):
        day=(row.get('dimensions',{}).get('date') or row.get('dimensions',{}).get('datetimeHour') or '')[:10]
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',day):continue
        values=grouped.setdefault(day,{})
        for k,v in row.get(kind,{}).items():
            if not isinstance(v,(float,int)) or isinstance(v,bool):continue
            values[k]=max(values.get(k,v),v) if kind=='max' else values.get(k,0)+v
    return grouped

MAP={'workerRequests':('workersInvocationsAdaptive','requests'),'durableRequests':('durableObjectsInvocationsAdaptiveGroups','requests'),'sqlRowsRead':('durableObjectsPeriodicGroups','rowsRead'),'sqlRowsWritten':('durableObjectsPeriodicGroups','rowsWritten'),'sqlStoredBytes':('durableObjectsSqlStorageGroups','storedBytes'),'aiNeurons':('aiInferenceAdaptiveGroups','totalNeurons')}

def quota_summary(report,policy):
    data=report.get('analytics',{});all_days=sorted({day for value in data.values() for day in totals(value)})
    today=dt.datetime.fromisoformat(report['queriedAt']).date().isoformat();days=[]
    for day in all_days:
        row={'day':day,'complete':day<today,'quotas':{key:usage(None,key,policy) for key in policy['limits'] if key!='workerBuildMinutes'}}
        for key,(name,metric) in MAP.items():
            value=totals(data.get(name)).get(day,{}).get(metric);row['quotas'][key]=usage(value,key,policy)
        periodic=data.get('durableObjectsPeriodicGroups',{});description=(periodic.get('metricDescriptions',{}).get('duration') or '').lower()
        gb_seconds=bool(re.search(r'(?:gb[- *·]?s(?:econds)?\b|gigabyte[- ]seconds)',description))
        duration=totals(periodic).get(day,{}).get('duration')
        row['quotas']['durableDuration']=usage(duration if gb_seconds else None,'durableDuration',policy,None if gb_seconds else 'Unidade de duration não confirmada no schema; valor bruto permanece no relatório.')
        kv=data.get('kvOperationsAdaptiveGroups',{});ops={}
        for item in kv.get('rows',[]):
            dims=item.get('dimensions',{})
            if dims.get('date')!=day:continue
            action=dims.get('actionType')
            if action in ['read','write','delete','list']:ops[action]=ops.get(action,0)+item.get(kv.get('aggregate','sum'),{}).get('requests',0)
        for action in ['read','write','delete','list']:row['quotas']['kv'+action.title()]=usage(ops.get(action),'kv'+action.title(),policy)
        storage=totals(data.get('kvStorageAdaptiveGroups')).get(day,{})
        value=next((storage[k] for k in ['byteCount','storedBytes','storageBytes'] if k in storage),None);row['quotas']['kvStoredBytes']=usage(value,'kvStoredBytes',policy)
        row['ranking']=sorted([{'metric':key,**value} for key,value in row['quotas'].items() if value['available']],key=lambda r:r['percent'],reverse=True)
        days.append(row)
    return {'plan':'Free','days':days,'latestCompleteDay':next((x['day'] for x in reversed(days) if x['complete']),None),'nonDaily':{'workerBuildMinutes':usage(None,'workerBuildMinutes',policy,'Minutos mensais não confirmados; listagens recentes de builds não comprovam consumo completo.')},'missingIsNotZero':True,'storageComparison':'Conservadora em GB decimal; max diário é capacidade observada, não gasto diário.'}

def family(name):
    return d.family(name)

def hot_families(dataset):
    grouped=defaultdict(Counter)
    for row in (dataset or {}).get('rows',[]):
        dims=row.get('dimensions',{});grouped[dims.get('date','unknown')][family(dims.get('name',''))]+=row.get('sum',{}).get('requests',0)
    return {day:[{'family':k,'requests':v,'percentOfMeasuredDORequests':round(100*v/sum(values.values()),2)} for k,v in values.most_common()] for day,values in grouped.items() if sum(values.values())}

def number(value):
    if value is None:return 'indisponível'
    return f'{value:,.3f}'.rstrip('0').rstrip('.').replace(',','_').replace('.',',').replace('_','.')

def summary_markdown(report):
    q=report['freeQuotas'];lines=[health.owner_summary(report),'## Monitor Global — cotas Free','',f"Consulta UTC: {report['queriedAt']}. Reinício diário: 00:00 UTC / 21h Brasília.",'','Dados adaptativos; dias parciais não são projetados. Métrica ausente não é consumo zero. Nenhum plano, limite ou prazo de alerta foi alterado.','']
    for day in q['days']:
        lines+=['### '+day['day']+(' · completo' if day['complete'] else ' · parcial'),'','| Recurso | Uso observado | Limite Free | % | Estado |','| --- | ---: | ---: | ---: | --- |']
        for key,v in day['quotas'].items():
            state={'normal':'normal','watch':'atenção','high':'alto','critical':'crítico','exceeded':'limite atingido','unknown':'não medido'}[v['level']]
            lines.append(f"| {v['label']} | {number(v.get('value'))} | {number(v['limit'])} {v['unit']} | {number(v['percent']) if v['available'] else '—'} | {state} |")
        lines.append('')
    excess=[(day,state,count) for day,states in report.get('resourceExcesses',{}).items() for state,count in states.items()]
    if excess:
        lines+=['','### Invocações com recurso excedido','','| Dia UTC | Status retornado | Quantidade |','| --- | --- | ---: |']
        for day,state,count in sorted(excess):lines.append(f'| {day} | {state} | {number(count)} |')
        lines+=['','O status não atribui sozinho CPU, memória ou rota. Quantis de CPU/memória, quando disponíveis, são de cada grupo e não um máximo de todas as invocações.']
    lines+=['Builds mensais e volume de logs têm cobertura própria; consultar limitações no JSON. CPU é limitada por invocação: média diária não comprova que cada chamada respeitou 10 ms.','',f"Consultas indisponíveis: {len(report.get('unavailable',{}))}. Resultados detalhados, famílias DO e schema de unidades no artifact."]
    return '\n'.join(lines)+'\n'

def main():
    token,account=d.m.credentials(os.environ);client=FreeClient(token,account);now=dt.datetime.now(dt.timezone.utc);policy=json.loads(POLICY.read_text())
    report={'queriedAt':now.isoformat(),'readOnly':True,'planBasis':policy['basis'],'analytics':{},'unavailable':{},'settings':{},'notes':policy['notes']}
    def collect(key,fn):
        try:return fn()
        except (d.m.MaintenanceError,ValueError,KeyError,TypeError,OSError) as e:report['unavailable'][key]=str(e).replace(token,'[token]').replace(account,'[account]')[:500];return None
    def analytics():
        root=d.graphql(client,'query{__schema{queryType{fields{name type{'+d.TYPE+'}}}}}');viewer=next(f for f in root['__schema']['queryType']['fields'] if f['name']=='viewer');accounts=next(f for f in d.schema(client,d.typename(viewer['type']))['fields'] if f['name']=='accounts');fields=d.schema(client,d.typename(accounts['type'])).get('fields',[])
        report['additionalDatasetCandidates']=[f['name'] for f in fields if re.search(r'(?:workers.*(?:log|build)|build.*workers)',f['name'],re.I)]
        wanted=set(name for name,_ in MAP.values())|{'durableObjectsPeriodicGroups','kvOperationsAdaptiveGroups','kvStorageAdaptiveGroups'}
        for field in fields:
            if field['name'] not in wanted:continue
            name=field['name'];extra=('actionType',) if name=='kvOperationsAdaptiveGroups' else ('status','requestSource') if name=='workersInvocationsAdaptive' else ()
            value=collect(name,lambda f=field:a.dataset(client,f,now,lookback_days=6,extra_dimensions=extra,with_quantiles=name=='workersInvocationsAdaptive'))
            if value is None:
                value=collect(name+'-shorter-window',lambda f=field:a.dataset(client,f,now,lookback_days=1,extra_dimensions=extra,with_quantiles=name=='workersInvocationsAdaptive'))
            if value is not None:report['analytics'][name]=value
            if name=='durableObjectsInvocationsAdaptiveGroups':
                detail=collect('durableFamilies',lambda f=field:a.dataset(client,f,now,lookback_days=1,extra_dimensions=('name','type','status','className')))
                report['durableFamilies']=hot_families(detail);report['durableFamilyCoverage']={'rows':len((detail or {}).get('rows',[])),'note':'Último dia UTC completo e parcial atual; detalhamento independente da janela histórica de totais.'}
    collect('analytics',analytics)
    for worker in ['black-sky-9ba0','monitor']:
        settings=collect('settings-'+worker,lambda w=worker:client.call('/accounts/'+account+'/workers/scripts/'+w+'/settings'))
        if isinstance(settings,dict):
            obs=settings.get('observability') or {};logs=obs.get('logs') or {};report['settings'][worker]={'observability':{k:obs[k] for k in ['enabled','head_sampling_rate'] if k in obs},'logs':{k:logs[k] for k in ['enabled','head_sampling_rate','invocation_logs'] if k in logs},'limits':{k:v for k,v in (settings.get('limits') or {}).items() if isinstance(v,(int,float,bool))},'logpush':settings.get('logpush')}
    scripts=collect('workerBuildInventory',lambda:client.call('/accounts/'+account+'/workers/scripts'))
    report['buildSnapshots']={}
    if isinstance(scripts,list):
        for worker in scripts:
            if worker.get('id') not in ['black-sky-9ba0','monitor'] or not worker.get('tag'):continue
            base='/accounts/'+account+'/builds/workers/'+worker['tag']
            result=collect('builds-'+worker['id'],lambda:client.call(base+'/builds'))
            if result is not None:
                rows=result.get('builds',[]) if isinstance(result,dict) else result if isinstance(result,list) else []
                report['buildSnapshots'][worker['id']]={'countReturned':len(rows),'completeMonthlyCoverage':False,'note':'Listagem recente não comprova minutos mensais faturáveis. Nenhum percentual de cota é inferido de contagens de builds.'}
            triggers=collect('build-triggers-'+worker['id'],lambda:client.call(base+'/triggers'))
            if triggers is not None:
                rows=triggers.get('triggers',[]) if isinstance(triggers,dict) else triggers if isinstance(triggers,list) else []
                report.setdefault('buildWatchPaths',{})[worker['id']]=[{k:x[k] for k in ['build_watch_paths','path_includes','path_excludes'] if k in x} for x in rows]
    report['workerStatuses']={}
    for item in report['analytics'].get('workersInvocationsAdaptive',{}).get('rows',[]):
        dims=item.get('dimensions',{});day=dims.get('date');state=dims.get('status','unknown');tot=report['workerStatuses'].setdefault(day,{});tot[state]=tot.get(state,0)+item.get('sum',{}).get('requests',0)
    report['resourceExcesses']={day:{key:count for key,count in statuses.items() if 'exceed' in key.lower() and count>0} for day,statuses in report['workerStatuses'].items()}
    report['policyAgeDays']=(now.date()-dt.date.fromisoformat(policy['verifiedAt'])).days
    report['policyReviewDue']=report['policyAgeDays']>policy.get('maxPolicyAgeDays',30)
    report['freeQuotas']=quota_summary(report,policy)
    report['automationHealth']=health.read_automations()
    out=Path('audit-results');out.mkdir(exist_ok=True);(out/'cloudflare-free-quota.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');markdown=summary_markdown(report);(out/'cloudflare-free-quota.md').write_text(markdown)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(markdown)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    expectedYesterday=(now-dt.timedelta(days=1)).date().isoformat()
    if not report['freeQuotas']['days'] or report['freeQuotas']['latestCompleteDay']!=expectedYesterday:
        print('::warning title=Cobertura incompleta::Não foi confirmado o último dia UTC completo; dados faltantes não significam consumo zero.')
    for day,states in report['resourceExcesses'].items():
        if day in [expectedYesterday,now.date().isoformat()] and states:print('::warning title=Limite de execução Worker::'+day+' registra '+str(sum(states.values()))+' invocações com recurso excedido. Verificar CPU/memória/status no relatório; não atribuir causa sem logs.')
    if report['policyReviewDue']:print('::warning title=Revisar limites Free::Referência de cotas tem mais de 30 dias. Conferir fontes oficiais.')
    for day in report['freeQuotas']['days']:
        for item in day['ranking']:
            if day['day'] in [expectedYesterday,now.date().isoformat()] and item['level']!='normal':print('::warning title=Cota Free '+item['metric']+'::'+day['day']+' atingiu '+str(round(item['percent'],2))+'% da cota ('+('completo' if day['complete'] else 'parcial')+').')
    if not any(day['quotas']['workerRequests']['available'] for day in report['freeQuotas']['days']):raise SystemExit(2)
    if any(item['level'] in ['critical','exceeded'] for day in report['freeQuotas']['days'] if day['day'] in [expectedYesterday,now.date().isoformat()] for item in day['ranking']):raise SystemExit(1)
if __name__=='__main__':main()
