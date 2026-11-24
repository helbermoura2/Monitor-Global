/* Argos Orbis - national IDAP/CAP Severe/Extreme, informational only.
 * Never treats INMET/CEMADEN categories as Cell Broadcast severities.
 */
(function(){
 'use strict';
 const URL='https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/data/defesa-civil-br.json';
 const SOURCE='https://idapfile.mdr.gov.br/idap/api/rss/cap';
 let last=0,busy=false;
 const el=id=>document.getElementById(id);
 const date=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',
  month:'2-digit',hour:'2-digit',minute:'2-digit'});
 function clear(node){if(node)node.replaceChildren();}
 function draw(data,now){
  const status=el('bh-cap-br-status'),out=el('bh-cap-br-rows');
  if(!status||!out)return;
  if(!data||data.version!==1||data.source!==SOURCE||data.scope!=='BRASIL'
    ||!Number.isFinite(data.updatedAt)||!Number.isFinite(data.checkedAt)
    ||data.updatedAt>now+60000||data.checkedAt>now+60000
    ||now-data.checkedAt>15*60000
    ||!Array.isArray(data.alerts)||data.alerts.length>1500
    ||!Number.isInteger(data.total)||data.total<data.alerts.length){
    status.textContent='Boletins CAP nacionais sem atualização recente. Consulte a fonte oficial.';
    clear(out);return;
  }
  const active=data.alerts.filter(x=>x&&Number.isFinite(x.expires)&&x.expires>now
    &&x.sent<=now&&x.sent>0&&(x.severity==='Severe'||x.severity==='Extreme')
    &&typeof x.area==='string'&&x.area.length<=350
    &&typeof x.message==='string'&&x.message.length<=500
    &&typeof x.issuer==='string'&&x.issuer.length<=120);
  const extreme=active.filter(x=>x.severity==='Extreme').length;
  const severe=active.length-extreme;
  status.textContent='IDAP/CAP nacional · '+active.length+' registros exibidos · '
    +extreme+' extremos, '+severe+' severos · Atualizado: '+date(data.checkedAt)
    +(data.truncated?' · Lista parcial!':'')+'.';
  clear(out);
  if(!active.length){
    const p=document.createElement('p');
    p.textContent='Nenhum aviso público CAP vigente nesta consulta. Isso não significa ausência de risco.';
    out.append(p);return;
  }
  for(const item of active.slice(0,16)){
    const div=document.createElement('div');div.className='bh-cap-item';
    const title=document.createElement('strong');
    title.textContent=(item.severity==='Extreme'?'EXTREMO':'SEVERO')+' · '+item.area;
    title.style.color=item.severity==='Extreme'?'#ff777f':'#f6c25c';
    const issuer=document.createElement('small');
    issuer.textContent=item.issuer+' · '+date(item.sent)+' · válido até '+date(item.expires);
    const message=document.createElement('p');message.textContent=item.message;
    div.append(title,issuer,message);out.append(div);
  }
  if(active.length>16){
    const p=document.createElement('p');
    p.textContent='Exibindo os 16 registros mais recentes de '+active.length+' registros. Consulte o feed oficial para a lista completa.';
    out.append(p);
  }
 }
 async function refresh(force=false){
  const status=el('bh-cap-br-status');
  if(!status||busy)return;
  const now=Date.now();
  if(!force&&now-last<120000)return;
  last=now;busy=true;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(URL+'?minute='+Math.floor(now/60000),{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const body=await response.text();
   if(body.length>2500000)throw Error('Catálogo nacional muito grande');
   draw(JSON.parse(body),Date.now());
  }catch(error){
   status.textContent='Consulta CAP nacional indisponível ou desatualizada. Confira a fonte oficial.';
   clear(el('bh-cap-br-rows'));
  }finally{clearTimeout(timer);busy=false;}
 }
 window.ArgosOfficialCapBR={refresh};
})();