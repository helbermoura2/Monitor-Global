"""Read-only budget and feature report; no deployments, KV writes or messages."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path

spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('cloudflare-worker-maintenance.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
LIMITS={'read':100000,'write':1000,'delete':1000,'list':1000}

def budget(rows,day):
    counts={op:0 for op in LIMITS}
    for row in rows:
        d=row.get('dimensions',{});op=d.get('actionType')
        if d.get('date')==day and op in counts:counts[op]+=row['sum']['requests']
    result={}
    for op,count in counts.items():
        percent=100*count/LIMITS[op]
        result[op]={'operations':count,'freeDailyLimit':LIMITS[op],'percent':round(percent,3),'level':'exceeded' if percent>=100 else 'critical' if percent>=95 else 'high' if percent>=85 else 'watch' if percent>=70 else 'normal'}
    return result

def coverage(data,day,now):
    start=dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc)
    end=start+dt.timedelta(days=1)
    began=data.get('coverageStartedAt') if data.get('available') else None
    full=isinstance(began,(int,float)) and began<=start.timestamp()*1000 and now>=end
    return {'dayClosed':now>=end,'observationWindowComplete':full,'coverageStartedAt':began,'note':'Application batches are best-effort. A complete time window is not a billing guarantee; missing data is not zero.'}

def main():
    token,account=m.credentials(os.environ);client=m.Client(token,account);now=dt.datetime.now(dt.timezone.utc)
    result={'queriedAt':now.isoformat(),'readOnly':True,'reset':'00:00 UTC / 21:00 Sao Paulo','limitsBasis':'Workers KV Free daily operation limits; account analytics may be delayed or sampled. Other services have separate quotas.','days':[]}
    analytics=m.analytics(client,now);secret=m.metrics_token(token,account)
    for date in [now.date()-dt.timedelta(days=1),now.date()]:
        day=str(date);usage=m.read_usage(secret,day)
        result['days'].append({'day':day,'kv':budget(analytics['rows'],day),'application':usage,'coverage':coverage(usage,day,now)})
    output=Path('audit-results');output.mkdir(exist_ok=True)
    text=json.dumps(result,ensure_ascii=False,indent=2)
    (output/'kv-daily-report.json').write_text(text)
    print(text)
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        lines=['## Monitor Global — saúde do KV','','Reinício: 21h São Paulo. Dados podem ter atraso. Métricas por função são observadas pela aplicação.','','| Dia UTC | Leituras | Gravações | Nível das gravações | Janela completa por função |','| --- | ---: | ---: | --- | --- |']
        for d in result['days']:
            v=d['kv'];lines.append(f"| {d['day']} | {v['read']['operations']} | {v['write']['operations']} / 1000 ({v['write']['percent']}%) | {v['write']['level']} | {d['coverage']['observationWindowComplete']} |")
        lines+=['','Limiares: atenção 70%, alto 85%, crítico 95%, esgotado 100%. Não envia mensagens nem muda o serviço.','','```json',text,'```','']
        with open(summary,'a') as f:f.write('\n'.join(lines))
if __name__=='__main__':
    try:main()
    except (m.MaintenanceError,OSError,ValueError,KeyError) as e:
        raise SystemExit('Read-only KV report unavailable; no zero-usage inference. '+type(e).__name__) from None
