import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const resourceOutcomes=new Set(['exceededCpu','exceededMemory','exceededResources']);
const routeName=/^(?:\/[a-z0-9-]+(?:\/\*)?|other|root|public-proxy|scheduled|alarm)$/;
export function summarize(report){
 const rows=[];
 for(const [key,count] of Object.entries(report.counts||{})){
  const [route,outcome,...extra]=key.split(' ');
  if(!extra.length&&routeName.test(route)&&resourceOutcomes.has(outcome)&&Number.isSafeInteger(count)&&count>0)rows.push({route,outcome,count});
 }
 const total=rows.reduce((n,r)=>n+r.count,0),attributed=rows.filter(r=>r.route!=='other');
 const unavailable=report.blocked===true||report.sessionRemoved!==true;
 return {status:unavailable?'observation_unavailable':!total?'no_resource_event_observed':attributed.length?'resource_route_observed':'resource_event_without_route',resourceEvents:total,routes:rows,sessionRemoved:report.sessionRemoved===true,syntheticRequests:0,incidentResolved:false};
}
export function markdown(result){
 const lines=['## Observação de recursos do Worker',''];
 if(result.status==='observation_unavailable')lines.push('Observação indisponível ou sessão sem encerramento confirmado. Não concluir ausência de excesso.');
 else if(!result.resourceEvents)lines.push('Nenhum excesso observado nesta janela. Isso não encerra o incidente nem identifica a rota histórica.');
 else{lines.push('| Rota agregada | Resultado | Ocorrências |','| --- | --- | ---: |');for(const r of result.routes)lines.push(`| ${r.route} | ${r.outcome} | ${r.count} |`);}
 lines.push('','Somente tráfego natural; sem URLs completas, parâmetros, cabeçalhos ou mensagens de erro. Não atribui causa específica nem altera processamento.');
 return lines.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=JSON.parse(await readFile('audit-results/route-tail.json','utf8')),result=summarize(report),text=markdown(result);
 console.log(JSON.stringify(result,null,2));console.log(text);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);
 for(const row of result.routes)console.log(`::warning::Worker ${row.outcome}: ${row.route} (${row.count})`);
}
