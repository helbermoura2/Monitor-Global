// === tsunami-tornado.js — Alertas de tsunami (geral) e tornado (linhas originais 8840-8933 do core-app.js) ===

async function fetchTsunamiAlerts() {
    try {
        const r = await fetch('https://api.weather.gov/alerts/active?event=Tsunami%20Warning,Tsunami%20Watch,Tsunami%20Advisory');
        if (!r.ok) throw new Error('NWS off');
        const d = await r.json();
        const ids = new Set();
        let primeiroNovo = null;

        (d.features || []).forEach(a => {
            ids.add(a.id);
            let coords = null;
            if (a.geometry && a.geometry.type === 'Polygon') {
                const ring = a.geometry.coordinates[0];
                coords = [
                    ring.reduce((s, c) => s + c[0], 0) / ring.length,
                    ring.reduce((s, c) => s + c[1], 0) / ring.length
                ];
            }
            const pr = a.properties;
            const obj = {
                id: a.id, type: 'tsunami',
                place: pr.areaDesc || 'Área não especificada',
                bandeira: '🇺🇸',
                time: new Date(pr.sent || Date.now()).getTime(),
                coords, coordinateRole:'warning-area', source: 'NWS/NOAA', detail: pr.event,
                official:true,hazardNature:'warning',warningLevel:/Watch/i.test(pr.event)?'Vigilância':/Advisory/i.test(pr.event)?'Atenção':'Aviso',
                expiresAt:Date.parse(pr.expires),warningDescription:pr.description,warningInstruction:pr.instruction,
                link:/^https:\/\/api\.weather\.gov\/alerts\//.test(a.id)?a.id:'https://www.weather.gov/',
                locationNote:'O mapa aponta uma referência da área costeira sob aviso, não o epicentro do sismo.'
            };
            const isNew = upsertAlert(obj, { fonte: 'tsunamiNws' });

            if (isNew) {
                primeiroNovo = primeiroNovo || obj;
                playAlertTone('tsunami');
                showToast(`🌊 TSUNAMI: ${pr.event}`, 'error');
                notificarNavegador(`🌊 TSUNAMI — ${pr.event}`, pr.areaDesc || '');
            }
        });

        globalAlerts = globalAlerts.filter(al =>
            al.source !== 'NWS/NOAA' || al.type !== 'tsunami' || ids.has(al.id)
        );
        window.MonitorFreshness?.recordStatus('NWS tsunami','ok');
        marcarBooted('tsunamiNws');
        applyFilters();
        if (primeiroNovo) showAlertDetails(primeiroNovo, true);
    } catch (e) { window.MonitorFreshness?.recordStatus('NWS tsunami','off',e.message);console.error('NWS tsunami:', e); }
}

// Independent international feed: NWS domestic cleanup must never erase it.
async function fetchOfficialTsunamiAlerts(){
 try{
  const url=new URL(WORKER_PROXY(''));url.pathname='/tsunami-alerts';url.search='';
  const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  for(const name of ['PTWC','NTWC']){const rows=(data.sources||[]).filter(s=>s.source===name);const ok=rows.some(s=>s.ok);const partial=ok&&rows.some(s=>!s.ok);window.MonitorFreshness?.recordStatus(name+' boletins',partial?'warn':ok?'ok':'off',rows.filter(s=>!s.ok).map(s=>s.error||'Produto indisponível').join(' · '));}
  if(!data.ok)throw Error('Centros oficiais indisponíveis');
  const online=new Set((data.sources||[]).filter(s=>s.ok).map(s=>s.feedKey||s.source));
  const selectedBefore=globalAlerts.find(item=>item.id===eventoSelecionadoId);
  const beforeSignature=globalAlerts.filter(item=>['PTWC','NTWC'].includes(item.source)).map(item=>item.id+'|'+item.time+'|'+item.warningLevel).sort().join(';');
  const items=window.TsunamiLink.latest((data.items||[]).filter(item=>item.type==='tsunami'&&['PTWC','NTWC'].includes(item.source)));
  const ids=new Set(items.map(item=>item.id));
  globalAlerts=globalAlerts.filter(item=>!online.has(item.feedKey||item.source)||item.type!=='tsunami'||ids.has(item.id));
  for(const item of items){
   const isNew=upsertAlert(item,{fonte:'tsunamiOfficial'});
   if(isNew&&item.hazardNature==='warning'){
    playAlertTone('tsunami');showToast('🌊 '+item.displayLabel+' · '+item.place,'error');
    notificarNavegador(item.displayLabel,item.place);
   }
  }
  const latestOfficial=window.TsunamiLink.latest(globalAlerts.filter(item=>['PTWC','NTWC'].includes(item.source)));
  const latestIds=new Set(latestOfficial.map(item=>item.id));
  globalAlerts=globalAlerts.filter(item=>!['PTWC','NTWC'].includes(item.source)||item.type!=='tsunami'||latestIds.has(item.id));
  const afterSignature=latestOfficial.map(item=>item.id+'|'+item.time+'|'+item.warningLevel).sort().join(';');
  if(beforeSignature!==afterSignature)window.monitorGlobalCorrelationInvalidate?.();
  if(selectedBefore&&!globalAlerts.some(item=>item.id===selectedBefore.id)){
   const replacement=latestOfficial.find(item=>(item.feedKey||item.source)===(selectedBefore.feedKey||selectedBefore.source)&&window.TsunamiLink.sameEvent(item,selectedBefore));
   if(replacement){
    showAlertDetails(replacement,false,true);
    if(window.__mgRevisionProtectedId===selectedBefore.id)window.__mgRevisionProtectedId=replacement.id;
    if(window.__mgLiveQuakeId===selectedBefore.id)window.__mgLiveQuakeId=replacement.id;
   }
  }
  window.NewEventPriority?.queue(items);applyFilters();
  const sorted=latestOfficial.sort((a,b)=>(b.sev||0)-(a.sev||0)||b.time-a.time);
  let chip=document.getElementById('chip-tsunami-official');
  if(!chip){chip=document.createElement('button');chip.id='chip-tsunami-official';chip.type='button';chip.className='chip';document.getElementById('chips-row')?.append(chip);}
  chip.hidden=!sorted.length;chip.style.setProperty('display',sorted.length?'inline-flex':'none','important');chip.textContent='🌊 Tsunami: '+(sorted[0]?.warningLevel||'Boletim');chip.title=sorted.map(item=>item.source+' · '+item.displayLabel+' · '+item.place).join('\n');
  chip.setAttribute('aria-haspopup',sorted.length>1?'dialog':'false');
  chip.onclick=()=>{
   // A manual bulletin selection must not inherit an automatic replay flag.
   const items=window.TsunamiLink.latest(globalAlerts.filter(item=>['PTWC','NTWC'].includes(item.source))).sort((a,b)=>(b.sev||0)-(a.sev||0)||b.time-a.time);
   window.TsunamiLinkedPanel?.choose(items);
  };
  marcarBooted('tsunamiOfficial');window.NewEventPriority?.focus();
 }catch(error){for(const name of ['PTWC boletins','NTWC boletins'])window.MonitorFreshness?.recordStatus(name,'off',error.message);console.error('Tsunami oficial:',error);}
}

async function fetchTornadoAlerts() {
    try {
        const r = await fetch('https://api.weather.gov/alerts/active?event=Tornado%20Warning,Tornado%20Watch');
        if (!r.ok) throw new Error('NWS off');
        const d = await r.json();
        const ids = new Set();
        let grave = null;

        (d.features || []).forEach(a => {
            ids.add(a.id);
            let coords = null;
            if (a.geometry && a.geometry.type === 'Polygon') {
                const ring = a.geometry.coordinates[0];
                coords = [
                    ring.reduce((s, c) => s + c[0], 0) / ring.length,
                    ring.reduce((s, c) => s + c[1], 0) / ring.length
                ];
            }
            const pr = a.properties;
            const obj = {
                id: a.id, type: 'tornado',
                place: pr.areaDesc || 'Área não especificada',
                bandeira: '🇺🇸',
                time: new Date(pr.sent || Date.now()).getTime(),
                coords, source: 'NWS/NOAA', detail: pr.event
            };
            const isNew = upsertAlert(obj, { fonte: 'tornado' });

            if (isNew && pr.event && pr.event.toLowerCase().includes('warning')) {
                grave = obj;
                playAlertTone('tornado');
                showToast(`🌪️ TORNADO: ${obj.place}`, 'error');
                notificarNavegador(`🌪️ TORNADO WARNING`, obj.place);
            }
        });

        globalAlerts = globalAlerts.filter(al => al.type !== 'tornado' || ids.has(al.id));
        window.MonitorFreshness?.recordStatus('NWS tornados','ok');
        marcarBooted('tornado');
        applyFilters();
        if (grave) showAlertDetails(grave, true);
    } catch (e) { window.MonitorFreshness?.recordStatus('NWS tornados','off',e.message);console.error('NWS tornado:', e); }
}

/* ═══════════════ INCÊNDIOS + EONET ═══════════════ */
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3';

// Incêndios: mantemos só América do Sul (nunca apagam os globais, geram muito ruído)
