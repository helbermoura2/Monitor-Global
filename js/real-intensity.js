(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const workerBase=()=>{try{return typeof WORKER_PROXY==='function'?WORKER_PROXY('').split('?')[0].replace(/\/$/,''):''}catch(e){return ''}};
  const cache=new Map();

  function setIntensityUI(item, value, kind, sourceLabel, impactText, feltCount){
    const val=Number(value);
    if(!Number.isFinite(val)) return false;
    const merc=$('pd-mercalli'), label=$('pd-mercalli-label'), impact=$('pd-impact');
    if(!merc||!label||!impact) return false;
    const roman=val>=10?'X':val>=9?'IX':val>=8?'VIII':val>=7?'VII':val>=6?'VI':val>=5?'V':val>=4?'IV':val>=3?'III':val>=2?'II':'I';
    const desc={I:'Não perceptível',II:'Muito fraco',III:'Fraco',IV:'Leve',V:'Moderado',VI:'Forte',VII:'Muito forte',VIII:'Severo',IX:'Violento',X:'Extremo'}[roman]||'';
    const cls=kind==='official'?'official':kind==='shakemap'?'shakemap':kind==='observed'?'observed':'estimated';
    const badge=kind==='official'?'FONTE':kind==='shakemap'?'SHAKEMAP':kind==='observed'?'OBSERVADO':'EST';
    const title=kind==='official'?`MMI fornecido pela fonte ${sourceLabel}`:kind==='shakemap'?'MMI do produto ShakeMap':kind==='observed'?'Dados de pessoas que relataram o tremor':'Estimativa automática do Monitor Global';
    label.innerHTML=`Intensidade (MMI) <span class="pd-intensity-source ${cls}" title="${esc(title)}">${badge}</span>`;
    merc.innerHTML=`<span style="color:#7dd3fc">${roman} · ${esc(desc)}</span>`;
    let text=impactText||`${desc}.`;
    if(feltCount!=null && Number(feltCount)>0) text += ` · ${Number(feltCount).toLocaleString('pt-BR')} relato${Number(feltCount)===1?'':'s'} de pessoas.`;
    impact.textContent=text;
    const old=impact.parentElement?.querySelector('.pd-impact-source');
    if(old) old.remove();
    const note=document.createElement('div'); note.className='pd-impact-source';
    note.textContent=kind==='official'?`✓ Dado de intensidade fornecido por ${sourceLabel}.`:kind==='shakemap'?'✓ Produto instrumental ShakeMap do USGS.':kind==='observed'?'✓ Relatos de percepção registrados pela rede.':'• Resultado calculado pelo Monitor Global.';
    impact.insertAdjacentElement('afterend',note);
    return true;
  }

  async function fetchUSGS(eventId){
    const base=workerBase(); if(!base||!eventId) return null;
    if(cache.has(eventId)) return cache.get(eventId);
    const url='https://earthquake.usgs.gov/fdsnws/event/1/query?eventid='+encodeURIComponent(eventId)+'&format=geojson';
    try{
      const r=await fetch(base+'?url='+encodeURIComponent(url),{cache:'no-store'});
      if(!r.ok) return null;
      const d=await r.json();
      const p=d?.properties||{};
      const products=p.products||{};
      const sm=Array.isArray(products.shakemap)?products.shakemap[0]:null;
      const sp=sm?.properties||{};
      const out={mmi:Number.isFinite(Number(p.mmi))?Number(p.mmi):null, felt:Number.isFinite(Number(p.felt))?Number(p.felt):null, maxmmi:Number.isFinite(Number(sp.maxmmi))?Number(sp.maxmmi):null, hasShake:!!sm};
      cache.set(eventId,out); return out;
    }catch(e){ return null; }
  }

  window.enriquecerIntensidadeSismicaReal=async function(item, fallback){
    if(!item||item.type!=='earthquake') return;
    // Só fazemos consulta extra para o USGS, evitando custo/rede para todos os eventos.
    if(String(item.source||'').toUpperCase()!=='USGS') {
      const ml=$('pd-mercalli-label'), imp=$('pd-impact');
      if(ml) ml.innerHTML='Intensidade (MMI) <span class="pd-intensity-source estimated" title="Não há MMI oficial disponível para este evento nesta fonte">EST</span>';
      if(imp) imp.textContent=typeof fallback==='function'?fallback():'Estimativa do app.';
      return;
    }
    const eventId=String(item.sourceEventId||item.id||'').replace(/^USGS-/i,'');
    if(!eventId) return;
    const d=await fetchUSGS(eventId);
    if(!d) return;
    if(d.mmi!=null){
      setIntensityUI(item,d.mmi,'official','USGS',`MMI ${d.mmi} — intensidade reportada no registro USGS.`,d.felt);
      return;
    }
    if(d.maxmmi!=null){
      setIntensityUI(item,d.maxmmi,'shakemap','USGS',`MMI máximo do ShakeMap: ${d.maxmmi}.`,d.felt);
      return;
    }
    if(d.felt!=null && d.felt>0){
      const ml=$('pd-mercalli-label'), merc=$('pd-mercalli'), imp=$('pd-impact');
      if(ml) ml.innerHTML='Intensidade (MMI) <span class="pd-intensity-source observed" title="Há relatos de pessoas que sentiram o evento, mas a fonte não forneceu um MMI consolidado">OBSERVADO</span>';
      if(merc) merc.innerHTML='<span style="color:#d8b4fe">Relatos de tremor</span>';
      if(imp) imp.textContent=`O evento possui ${d.felt.toLocaleString('pt-BR')} relato${d.felt===1?'':'s'} de pessoas que sentiram o sismo; não há MMI consolidado disponível.`;
      return;
    }
  };
})();

