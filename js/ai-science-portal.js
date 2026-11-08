/* Opt-in scientific AI, same backend and verified facts as TV and Android phone.
 * No automatic inference, no DOM changes to the event map or alarm overlays. */
(function(){
'use strict';
const ROOT='https://black-sky-9ba0.terrestre.workers.dev';
let panel=null,output=null,busy=false;
const line=(host,tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;host.append(e);return e;};
const query=async path=>{
 const ctrl=new AbortController(),cancel=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(ROOT+path,{signal:ctrl.signal,cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok||Number(r.headers.get('content-length'))>9000)throw Error('unavailable');
  const raw=await r.text();if(raw.length>9000)throw Error('oversized');return JSON.parse(raw);
 }finally{clearTimeout(cancel);}
};
async function request(path,kind){
 if(busy||!output)return;
 busy=true;output.replaceChildren();line(output,'p','Consultando fontes verificadas. Nenhum alerta ou replay é alterado.');
 try{
  let data;
  for(let attempt=0;attempt<9;attempt++){
   data=await query(path);
   if(data.status!=='pending')break;
   if(!output?.isConnected)return;
   await new Promise(ok=>setTimeout(ok,2500));
  }
  if(!output?.isConnected)return;
  output.replaceChildren();
  if(kind==='weather'){
   if(data?.version!=='rain-outlook-v1'||data.ok!==true||data.horizonMinutes!==30||data.area!=='liberdade'||data.source!=='Rainbow Weather'||data.expiresAt<=Date.now()||!Array.isArray(data.groups)||data.groups.length!==3){
    line(output,'p','Previsão de 30 minutos indisponível ou vencida. Nenhum dado foi estimado por conta própria.');return;
   }
   line(output,'h4','Chuva na Liberdade · próximos 30 minutos');
   for(const b of data.groups){
    if(!Number.isInteger(b.startMinute)||!Number.isInteger(b.endMinute)||typeof b.level!=='string'||b.level.length>40)return;
    line(output,'p',b.startMinute+'–'+b.endMinute+' min · '+b.level);
   }
   line(output,'p','Acumulado estimado: '+data.totalMm.toLocaleString('pt-BR')+' mm. Tendência: '+data.trend+'.');
   line(output,'small','Rainbow Weather · fonte da previsão. Não são medições em tempo real; os valores podem mudar.');
   return;
  }
  if(data?.version!=='seismic-insight-v1'||data.status!=='ready'||!Array.isArray(data.sections)||data.sections.length!==6||data.title?.length>190){
   line(output,'p','Nenhuma análise científica compatível com o evento foi encontrada no feed; não foi usada informação de outro sismo.');return;
  }
  line(output,'h4',data.title||'Sismo no catálogo');
  line(output,'small','Fonte: '+(data.source||'não informada')+' · '+(data.model==='gemini-3.8-flash'?'Gemini':String(data.model||'').startsWith('@cf/')?'Cloudflare reserva':'regras científicas'));
  for(const section of data.sections){
   if(typeof section.title!=='string'||typeof section.text!=='string'||section.title.length>70||section.text.length>550||!section.text)return;
   const block=document.createElement('section');block.className='mg-ai-section';
   line(block,'strong',section.title);line(block,'p',section.text);output.append(block);
  }
  line(output,'small','Interpretação educativa dos dados publicados. Não prevê terremotos nem emite avisos oficiais.');
 }catch{
  if(output?.isConnected){output.replaceChildren();line(output,'p','Não foi possível consultar agora. Dados e alertas do Monitor Global continuam funcionando.');}
 }finally{busy=false;}
}
function selectedId(){
 const e=window.EventStore?.getSelected?.();
 if(!e||(e.type!=='earthquake'&&e.kind!=='earthquake'))return '';
 const id=String(e.id||'');
 return id.length>=2&&id.length<=170?id:'';
}
function button(host,label,fn){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);host.append(b);return b;
}
function install(){
 if(panel?.isConnected)return;
 const host=document.getElementById('pd-more-details')||document.getElementById('painel-direito');
 if(!host)return;
 panel=document.createElement('details');panel.id='mg-ai-science';panel.className='mg-ai-science';
 const heading=document.createElement('summary');heading.textContent='Análises científicas · IA e projeção 30 min';panel.append(heading);
 const actions=document.createElement('div');actions.className='mg-ai-actions';panel.append(actions);
 button(actions,'Analisar sismo selecionado',()=>{const id=selectedId();if(!id){output.replaceChildren();line(output,'p','Selecione primeiro um sismo do feed de alertas.');return;}request('/seismic-insight?id='+encodeURIComponent(id),'seismic');});
 button(actions,'Analisar último sismo do feed',()=>request('/seismic-insight','seismic'));
 button(actions,'Projetar chuva · próximos 30 min',()=>request('/weather-outlook?area=liberdade','weather'));
 output=document.createElement('div');output.className='mg-ai-output';
 line(output,'p','As análises são solicitadas somente ao selecionar uma opção. As fontes oficiais continuam independentes da IA.');
 panel.append(output);host.append(panel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
