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
                coords, source: 'NWS/NOAA', detail: pr.event
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
        marcarBooted('tsunamiNws');
        applyFilters();
        if (primeiroNovo) showAlertDetails(primeiroNovo, true);
    } catch (e) { console.error('NWS tsunami:', e); }
}

// Independent international feed: NWS domestic cleanup must never erase it.
async function fetchOfficialTsunamiAlerts(){
 try{
  const url=new URL(WORKER_PROXY(''));url.pathname='/tsunami-alerts';url.search='';
  const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!data.ok)throw Error('Centros oficiais indisponíveis');
  const online=new Set((data.sources||[]).filter(s=>s.ok).map(s=>s.feedKey||s.source));
  const items=(data.items||[]).filter(item=>item.type==='tsunami'&&['PTWC','NTWC'].includes(item.source)&&Number.isFinite(item.time)&&Date.now()-item.time<=72*3600000);
  const ids=new Set(items.map(item=>item.id));
  globalAlerts=globalAlerts.filter(item=>!online.has(item.feedKey||item.source)||item.type!=='tsunami'||ids.has(item.id));
  for(const item of items){
   const isNew=upsertAlert(item,{fonte:'tsunamiOfficial'});
   if(isNew&&item.hazardNature==='warning'){
    playAlertTone('tsunami');showToast('🌊 '+item.displayLabel+' · '+item.place,'error');
    notificarNavegador(item.displayLabel,item.place);
   }
  }
  window.NewEventPriority?.queue(items);applyFilters();
  const sorted=globalAlerts.filter(item=>item.type==='tsunami'&&['PTWC','NTWC'].includes(item.source)).sort((a,b)=>(b.sev||0)-(a.sev||0)||b.time-a.time);
  let chip=document.getElementById('chip-tsunami-official');
  if(!chip){chip=document.createElement('button');chip.id='chip-tsunami-official';chip.type='button';chip.className='chip';document.getElementById('chips-row')?.append(chip);}
  chip.hidden=!sorted.length;chip.style.setProperty('display',sorted.length?'inline-flex':'none','important');chip.textContent='🌊 Tsunami: '+(sorted[0]?.warningLevel||'Boletim');chip.title=sorted.map(item=>item.source+' · '+item.displayLabel+' · '+item.place).join('\n');
  chip.onclick=()=>{
   // A manual bulletin selection must not inherit an automatic replay flag.
   const current=globalAlerts.filter(item=>item.type==='tsunami'&&['PTWC','NTWC'].includes(item.source)).sort((a,b)=>(b.sev||0)-(a.sev||0)||b.time-a.time)[0];
   if(!current)return;
   window.__mgSoftCycle=false;window.__mgRotationDisplay=false;
   showAlertDetails(current,false);
  };
  marcarBooted('tsunamiOfficial');window.NewEventPriority?.focus();
 }catch(error){console.error('Tsunami oficial:',error);}
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
        marcarBooted('tornado');
        applyFilters();
        if (grave) showAlertDetails(grave, true);
    } catch (e) { console.error('NWS tornado:', e); }
}

/* ═══════════════ INCÊNDIOS + EONET ═══════════════ */
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3';

// Incêndios: mantemos só América do Sul (nunca apagam os globais, geram muito ruído)
