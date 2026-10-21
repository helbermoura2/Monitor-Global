(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const workerBase=()=>{try{return typeof WORKER_PROXY==='function'?WORKER_PROXY('').split('?')[0].replace(/\/$/,''):''}catch(e){return ''}};
  const cache=new Map();

  function setIntensityUI(item, value, kind, sourceLabel, impactText, feltCount){
    const val=Number(value);
    if(value==null||String(value).trim()===''||!Number.isFinite(val)||val<1||val>12) return false;
    window.SeismicCinema?.recordIntensity(item.id,val,kind==='shakemap'?'ShakeMap USGS':sourceLabel);
    const merc=$('pd-mercalli'), label=$('pd-mercalli-label'), impact=$('pd-impact');
    if(!merc||!label||!impact) return false;
    const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Math.max(1,Math.min(12,Math.round(val)))-1];
    const desc={I:'Não perceptível',II:'Muito fraco',III:'Fraco',IV:'Leve',V:'Moderado',VI:'Forte',VII:'Muito forte',VIII:'Severo',IX:'Violento',X:'Extremo',XI:'Extremo',XII:'Extremo'}[roman]||'';
    const badge=kind==='official'?'FONTE':kind==='shakemap'?'SHAKEMAP':kind==='observed'?'OBSERVADO':'EST';
    label.innerHTML='Intensidade (MMI) '+(window.DataContext?.markup(kind==='observed'?'perception':kind==='official'||kind==='shakemap'?'intensity':'estimate',kind==='observed'?'RELATOS':kind==='shakemap'?'SHAKEMAP':kind==='official'?'DA FONTE':'ESTIMATIVA')||esc(badge));
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

  async function fetchUSGS(eventId,item){
    const base=workerBase(); if((!base&&!window.EventProducts)||!eventId) return null;
    const cached=cache.get(eventId);if(cached&&Date.now()-cached.at<600000)return cached.data;
    const url='https://earthquake.usgs.gov/fdsnws/event/1/query?eventid='+encodeURIComponent(eventId)+'&format=geojson';
    try{
      let d;
      if(window.EventProducts){d=await window.EventProducts.detail(item);if(!d)return null;window.EventInsights?.products(item,d);}
      else{const r=await fetch(base+'?url='+encodeURIComponent(url),{cache:'no-store'});if(!r.ok)return null;d=await r.json();}
      const p=d?.properties||{};
      const products=p.products||{};
      const sm=window.EventProducts?EventProducts.products(d,'shakemap')[0]:(Array.isArray(products.shakemap)?products.shakemap[0]:null);
      const sp=sm?.properties||{};
      const mmi=v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=1&&Number(v)<=12?Number(v):null;
      const out={mmi:mmi(p.mmi), felt:p.felt!=null&&String(p.felt).trim()!==''&&Number.isFinite(Number(p.felt))?Number(p.felt):null, maxmmi:mmi(sp.maxmmi), hasShake:!!sm};
      cache.set(eventId,{at:Date.now(),data:out});if(cache.size>200)cache.delete(cache.keys().next().value);return out;
    }catch(e){ return null; }
  }

  window.enriquecerIntensidadeSismicaReal=async function(item, fallback){
    if(!item || !(item.type==='earthquake' || (!item.type && Number.isFinite(item.mag)))) return;
    const direct=[item.sourceMmi,item.maxmmi,item.mmi].find(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=1&&Number(v)<=12);
    if(direct!=null){setIntensityUI(item,direct,'official',item.source||'agência sísmica','Intensidade reportada pela fonte.');return;}
    // Só fazemos consulta extra para o USGS, evitando custo/rede para todos os eventos.
    const report=(item.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||'')) || (/^USGS(?:-RT)?$/i.test(item.source||'')?item:null);
    if(!report) {
      const ml=$('pd-mercalli-label'), imp=$('pd-impact');
      if(ml&&window.SeismicCinema?.intensitySummary(item).kind==='estimated') ml.innerHTML='Intensidade estimada (MMI) '+(window.DataContext?.markup('estimate','ESTIMATIVA')||'EST');
      if(imp) imp.textContent=typeof fallback==='function'?fallback():'Estimativa do app.';
      return;
    }
    const eventId=String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,'');
    if(!eventId) return;
    const d=await fetchUSGS(eventId,item);
    if(!d || (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id)) return;
    if(d.mmi!=null){
      setIntensityUI(item,d.mmi,'official','USGS','Intensidade reportada no registro USGS.',d.felt);
      return;
    }
    if(d.maxmmi!=null){
      setIntensityUI(item,d.maxmmi,'shakemap','USGS','Intensidade máxima publicada no ShakeMap USGS.',d.felt);
      return;
    }
    if(d.felt!=null && d.felt>0){
      const ml=$('pd-mercalli-label'), merc=$('pd-mercalli'), imp=$('pd-impact');
      if(ml) ml.innerHTML='Intensidade (MMI) '+(window.DataContext?.markup('perception','RELATOS')||'RELATOS');
      if(merc) merc.innerHTML='<span style="color:#d8b4fe">Intensidade não informada</span>';
      if(imp) imp.textContent=`O evento possui ${d.felt.toLocaleString('pt-BR')} relato${d.felt===1?'':'s'} de pessoas que sentiram o sismo; não há MMI consolidado disponível.`;
      return;
    }
  };
})();

