// Publish actionable failure names in Actions, even when the browser never ran.
const fs=require('node:fs');
const output=process.env.GITHUB_STEP_SUMMARY;
if(output){
 const text=['## Resultado das verificações locais','Os testes usam dados simulados. Uma falha abaixo exige análise; o teste não corrige o projeto sozinho.',''];
 let found=false;
 const browserReports=fs.existsSync('test-diagnostics')?fs.readdirSync('test-diagnostics').filter(name=>name.endsWith('.json')).sort().map(name=>'test-diagnostics/'+name):[];
 for(const file of ['test-logs/unit-checks.log','test-results/results.json',...browserReports]){
  if(!fs.existsSync(file))continue;
  if(file.endsWith('.log')){
   const errors=fs.readFileSync(file,'utf8').replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(l=>/^✖|^not ok|AssertionError|^FAIL/.test(l));
   if(errors.length){found=true;text.push('### Testes internos',...errors.slice(0,20).map(l=>'- '+l.replace(/`/g,'')),'');}
  }else{
   try{
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    text.push('### '+file,'');
    for(const error of data.errors||[]){found=true;text.push('```text',String(error.message||error.value||'Erro de preparação do navegador').replace(/\x1b\[[0-9;]*m/g,'').slice(0,1200),'```');}
    if(data.stats)text.push('Navegador: '+(data.stats.expected||0)+' aprovados; '+(data.stats.unexpected||0)+' falhas; '+(data.stats.flaky||0)+' instáveis; '+(data.stats.skipped||0)+' não executados.','');
    function visit(suite,parents=[]){
     for(const spec of suite.specs||[])for(const t of spec.tests||[])if(t.status==='unexpected'){
      found=true;text.push('- '+[...parents,spec.title].join(' → ').replace(/`/g,''));
      const e=t.results?.find(r=>r.error)?.error?.message;
      if(e)text.push('```text',e.replace(/\x1b\[[0-9;]*m/g,'').slice(0,1200),'```');
     }
     for(const child of suite.suites||[])visit(child,[...parents,child.title]);
    }
    for(const suite of data.suites||[])visit(suite,[suite.title]);
   }catch{found=true;text.push('Relatório do navegador incompleto ('+file+'); consulte o log anexado.');}
  }
 }
 if(!found)text.push('Nenhuma falha registrada nesses relatórios. Consulte também o status das etapas: uma falha de preparação pode impedir a execução.');
 text.push('','Logs e relatórios disponíveis nos artefatos desta execução.');fs.appendFileSync(output,text.join('\n')+'\n');
}
