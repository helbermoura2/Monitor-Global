"""Snapshot the public current-alert catalogue, without interpreting unzoned source clocks."""
import json,sys,datetime,urllib.request
from pathlib import Path
SOURCE='https://painelalertas.cemaden.gov.br/wsAlertas2'
def normalize(raw,checked_at):
    if not isinstance(raw,dict) or not isinstance(raw.get('alertas'),list) or len(raw['alertas'])>5000:
        raise ValueError('Invalid Cemaden catalogue')
    alerts=[]
    for a in raw['alertas']:
        if a.get('status')!=1: continue
        try:
            lat,lng=float(a['latitude']),float(a['longitude'])
            code=str(a['codibge']);level=a['nivel'];ident=str(a['cod_alerta'])
            if not(-90<=lat<=90 and -180<=lng<=180 and code.isdigit() and len(code)==7 and ident.isdigit() and level in ['Moderado','Alto','Muito Alto']): raise ValueError()
            alerts.append(dict(id='cemaden-'+ident,ibge=code,city=str(a['municipio'])[:100],uf=str(a['uf'])[:2],event=str(a['evento'])[:150],level=level,status=1,lat=lat,lng=lng,sourceIssuedText=str(a.get('datahoracriacao',''))[:50],sourceUpdatedText=str(a.get('ult_atualizacao',''))[:50]))
        except (KeyError,ValueError,TypeError): raise ValueError('Invalid active Cemaden row; preserve previous snapshot')
    return dict(version=1,source=SOURCE,checkedAt=checked_at,sourceTimeZone=None,alerts=sorted(alerts,key=lambda a:a['id']))
def main():
    req=urllib.request.Request(SOURCE,headers={'User-Agent':'MonitorGlobal/1.0 (https://monitorglobal.top)','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as response:
        body=response.read(2000001)
    if len(body)>2000000: raise ValueError('Catalogue too large')
    now=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000)
    data=normalize(json.loads(body),now)
    path=Path('data/cemaden-alerts.json');path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(len(data['alerts']),'active Cemaden municipal alerts')
if __name__=='__main__':main()
