/* ================= MONITOR GLOBAL =================
   Camada adicional: risco, fontes, radar observado e replay. */
(function(){
'use strict';
const CEMADEN={
  enabled:true,
  layer:true,
  sourceState:'idle',
  stations:[],
  lastFetch:0,
  lastSuccess:0,
  lastDataTime:0,
  fetching:false,
  failures:0,
  timer:null
};

function setCemadenStatus(status,text){
  safeText('cemaden-uf',weatherLoc?.uf||'SP');
  const e=q('cemaden-status');
  if(!e)return;
  e.className='cemaden-status '+status;
  e.textContent=text||({ok:'ONLINE',warn:'ATENÇÃO',off:'OFFLINE',idle:'CONECTANDO'}[status]||status);
  syncMobileCemaden(status);
}

function cemadenNum(o,keys){
  for(const k of keys){
    if(o&&o[k]!==undefined&&o[k]!==null&&o[k]!==''){
      const n=Number(String(o[k]).replace(',','.'));
      if(Number.isFinite(n))return n;
    }
  }
  return null;
}

function cemadenStr(o,keys,def=''){
  for(const k of keys){
    if(o&&o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return String(o[k]);
  }
  return def;
}

function cemadenDate(v){
  if(!v)return null;
  if(v instanceof Date)return Number.isNaN(v.getTime())?null:v;
  const s=String(v).trim();
  let d=new Date(s);
  if(!Number.isNaN(d.getTime()))return d;
  const m=s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if(m){
    d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)));
    if(!Number.isNaN(d.getTime()))return d;
  }
  const digits=s.replace(/\D/g,'');
  if(digits.length>=12){
    const y=+digits.slice(0,4),mo=+digits.slice(4,6),da=+digits.slice(6,8),
          h=+digits.slice(8,10),mi=+digits.slice(10,12),se=+(digits.slice(12,14)||0);
    if(y>2000&&mo>=1&&mo<=12&&da>=1&&da<=31){
      d=new Date(Date.UTC(y,mo-1,da,h,mi,se));
      if(!Number.isNaN(d.getTime()))return d;
    }
  }
  return null;
}


function cemadenAgeText(ms){
  if(!Number.isFinite(ms)||ms<0)return 'idade indisponível';
  const min=Math.floor(ms/60000);
  if(min<1)return 'agora mesmo';
  if(min<60)return `há ${min} min`;
  const h=Math.floor(min/60), r=min%60;
  return r?`há ${h}h ${r}min`:`há ${h}h`;
}


// ================= 4.0.13: CEMADEN trocado por estimativa Open-Meteo =================
// O CEMADEN (sws.cemaden.gov.br / resources.cemaden.gov.br) não expõe CORS e todos os
// proxies públicos usados como fallback (corsfix, isomorphic-git, codetabs, workers.dev)
// estão fora do ar ou bloqueando as chamadas — por isso o card ficava travado em
// "CONECTANDO". A troca abaixo usa a API do Open-Meteo (já usada no resto do painel,
// com CORS liberado direto, sem proxy) para estimar chuva em pontos espalhados pela
// capital, no lugar dos pluviômetros oficiais do CEMADEN.
const SP_RAIN_GRID=[
  {id:'se',name:'Sé - Centro',lat:-23.5505,lng:-46.6333},
  {id:'santana',name:'Santana',lat:-23.5052,lng:-46.6291},
  {id:'itaquera',name:'Itaquera',lat:-23.5326,lng:-46.4525},
  {id:'stoamaro',name:'Santo Amaro',lat:-23.6543,lng:-46.7128},
  {id:'butanta',name:'Butantã',lat:-23.5709,lng:-46.7141},
  {id:'mboi',name:"M'Boi Mirim",lat:-23.6739,lng:-46.7614},
  {id:'vmaria',name:'Vila Maria/Guilherme',lat:-23.5081,lng:-46.5763},
  {id:'vprudente',name:'Vila Prudente',lat:-23.5824,lng:-46.5820},
  {id:'socorro',name:'Capela do Socorro',lat:-23.7256,lng:-46.7186}
];

// Segunda fonte, agora com "condição observada" (não só modelo): a WeatherAPI
// agrega estações/METAR reais e reporta precip_mm da última hora. A key já
// existe no painel (usada nas rajadas globais) — aqui é só mais uma chamada
// com ela, sem precisar de conta nova.
async function fetchWeatherApiObservado(){
  try{
    const lat=weatherLoc?.lat||-23.5505, lng=weatherLoc?.lng||-46.6333;
    const r=await fetch(weatherApiUrl(`${lat},${lng}`));
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    const mm=Number(d?.current?.precip_mm);
    const cond=d?.current?.condition?.text||'';
    if(Number.isFinite(mm)){
      safeText('cemaden-observed',`👁️ Observado: ${mm.toFixed(1)} mm/h${cond?' • '+cond:''}`);
      const cc=q('cemaden-card');
      if(cc)cc.title=(q('cemaden-last')?.textContent||'')+' — '+(q('cemaden-observed')?.textContent||'');
    }
  }catch(e){
    safeText('cemaden-observed','');
    console.warn('WeatherAPI observado indisponível:',e);
  }
}

async function fetchCemaden(){
  if(!CEMADEN.enabled||CEMADEN.fetching)return;
  CEMADEN.fetching=true;
  const t=performance.now();

  if(!CEMADEN.lastSuccess)setCemadenStatus('idle','CONECTANDO');
  else setCemadenStatus('warn','ATUALIZANDO');

  let data=null,lastErr=null;
  try{
    const lats=SP_RAIN_GRID.map(p=>p.lat).join(',');
    const lngs=SP_RAIN_GRID.map(p=>p.lng).join(',');
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&hourly=precipitation&past_days=1&forecast_days=1&timezone=auto`;
    if(typeof throttleOpenMeteo==='function')await throttleOpenMeteo(url);
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const json=await r.json();
    const arr=Array.isArray(json)?json:[json];
    const now=Date.now();
    data=arr.map((res,i)=>{
      const p=SP_RAIN_GRID[i]||{};
      const times=res?.hourly?.time||[];
      const rain=res?.hourly?.precipitation||[];
      // Só até "agora": o pedido inclui as horas restantes do dia (previsão), que
      // não podem entrar na conta de chuva acumulada nem na idade do dado
      // (senão a idade fica negativa e vira "idade indisponível" na tela).
      const past=times.map((tm,idx)=>({tm,val:Number(rain[idx])||0,ms:new Date(tm).getTime()}))
        .filter(x=>Number.isFinite(x.ms)&&x.ms<=now);
      const last24=past.slice(-24);
      const rain24=last24.reduce((a,b)=>a+b.val,0);
      const lastPt=past[past.length-1];
      const rain1=lastPt?lastPt.val:0;
      const lastTime=lastPt?lastPt.tm:'';
      const dt=lastPt?lastPt.ms:null;
      return{
        id:p.id||String(i),lat:p.lat,lng:p.lng,
        rain24:Math.round(rain24*10)/10,rain1:Math.round(rain1*10)/10,
        city:'São Paulo',name:p.name||('Ponto '+(i+1)),uf:'SP',
        time:lastTime||'',timeMs:dt||Date.now()
      };
    }).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
    if(!data.length)data=null;
  }catch(e){lastErr=e}

  const elapsed=performance.now()-t;

  if(!data){
    CEMADEN.failures++;
    setSource('CEMADEN','off',elapsed,lastErr?.message||'Modelo Open-Meteo sem resposta');

    if(CEMADEN.lastSuccess){
      const age=Date.now()-CEMADEN.lastSuccess;
      setCemadenStatus(age>75*60000?'off':'warn',age>75*60000?'DADO ANTIGO':'ATENÇÃO');
      safeText('cemaden-last',`📊 Última OK: ${cemadenAgeText(age)}`);
    }else{
      setCemadenStatus('off','SEM CONEXÃO');
      safeText('cemaden-last','📊 Sem resposta • tentando de novo');
    }
    console.warn('Chuva SP (Open-Meteo) indisponível:',lastErr);
    CEMADEN.fetching=false;
    fetchWeatherApiObservado();
    return;
  }

  CEMADEN.failures=0;
  CEMADEN.stations=data;
  CEMADEN.lastFetch=Date.now();
  CEMADEN.lastSuccess=CEMADEN.lastFetch;

  const validTimes=data.map(x=>x.timeMs).filter(Number.isFinite).filter(x=>x>0);
  CEMADEN.lastDataTime=validTimes.length?Math.max(...validTimes):0;

  const dataAge=CEMADEN.lastDataTime?Date.now()-CEMADEN.lastDataTime:null;
  const stale=dataAge!=null&&dataAge>70*60000;
  const veryStale=dataAge!=null&&dataAge>130*60000;
  setCemadenStatus(veryStale?'off':stale?'warn':'ok',veryStale?'DADO ANTIGO':stale?'ATENÇÃO':'ONLINE');
  setSource('CEMADEN',veryStale?'warn':stale?'warn':'ok',elapsed);

  const max24=Math.max(...data.map(x=>x.rain24).filter(Number.isFinite),0);
  safeText('cemaden-stations',data.length);
  safeText('cemaden-max24',max24.toFixed(1));

  safeText(
    'cemaden-last',
    dataAge!=null
      ? `📊 Modelo: ${cemadenAgeText(dataAge)}`
      : `📊 Modelo: agora`
  );

  if(map)renderCemadenLayer();
  CEMADEN.fetching=false;
  const cc=q('cemaden-card');
  if(cc)cc.title=q('cemaden-last')?.textContent||'';
  fetchWeatherApiObservado();
}

// Referências estáveis pros handlers do layer do CEMADEN — precisa da MESMA
// referência de função pra map.off() conseguir remover o listener certo
// antes de renderCemadenLayer() re-adicionar (chamado a cada 2min via
// agendarBusca(fetchCemaden,...); sem isso, cada ciclo empilhava mais um
// conjunto de listeners de click/hover pro mesmo layer, indefinidamente,
// pra quem deixa a aba aberta por horas).
function onCemadenClick(e){const p=e.features?.[0]?.properties;if(!p)return;new maplibregl.Popup({closeButton:true,maxWidth:'260px'}).setLngLat(e.lngLat).setHTML(`<b>🌧️ Chuva estimada</b><br>${String(p.name||'Ponto').replace(/[<>]/g,'')}<br>${String(p.city||'').replace(/[<>]/g,'')}<br><b>24h:</b> ${p.rain24!=null?p.rain24+' mm':'N/D'}<br><b>Última hora:</b> ${p.rain1!=null?p.rain1+' mm':'N/D'}<br><small>Estimativa por modelo meteorológico (Open-Meteo), não é medição de pluviômetro físico</small>`).addTo(map)}
function onCemadenEnter(){map.getCanvas().style.cursor='pointer'}
function onCemadenLeave(){map.getCanvas().style.cursor=''}
function renderCemadenLayer(){if(!map)return;try{
  map.off('click','cemaden-stations-layer',onCemadenClick);
  map.off('mouseenter','cemaden-stations-layer',onCemadenEnter);
  map.off('mouseleave','cemaden-stations-layer',onCemadenLeave);
  if(map.getLayer('cemaden-stations-layer'))map.removeLayer('cemaden-stations-layer');if(map.getSource('cemaden-stations-source'))map.removeSource('cemaden-stations-source')}catch(e){}
  const features=CEMADEN.stations.map(s=>({type:'Feature',geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:{id:s.id,name:s.name,city:s.city,rain24:s.rain24,rain1:s.rain1,time:s.time}}));
  map.addSource('cemaden-stations-source',{type:'geojson',data:{type:'FeatureCollection',features}});
  map.addLayer({id:'cemaden-stations-layer',type:'circle',source:'cemaden-stations-source',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,3,7,5,11,7],'circle-color':['case',['>=',['coalesce',['get','rain24'],0],50],'#ef4444',['>=',['coalesce',['get','rain24'],0],20],'#facc15',['>=',['coalesce',['get','rain24'],0],5],'#38bdf8','#22c55e'],'circle-stroke-color':'#fff','circle-stroke-width':1.2,'circle-opacity':.88}});
  map.on('click','cemaden-stations-layer',onCemadenClick);
  map.on('mouseenter','cemaden-stations-layer',onCemadenEnter);map.on('mouseleave','cemaden-stations-layer',onCemadenLeave);
}
function toggleCemadenLayer(){CEMADEN.layer=!CEMADEN.layer;if(!map)return;const l=map.getLayer('cemaden-stations-layer');if(l)map.setLayoutProperty('cemaden-stations-layer','visibility',CEMADEN.layer?'visible':'none');q('btn-cemaden-layer')?.classList.toggle('active',CEMADEN.layer)}

/* ═══════════════ REDEMET (DECEA) — estações METAR reais, cadastro gratuito ═══════════════
   A chave da API NÃO fica aqui — igual à WeatherAPI (fetchWeatherApiObservado), a chamada
   passa pela rota /redemet-metar do worker próprio (black-sky-9ba0.terrestre.workers.dev),
   que injeta a chave (env.REDEMET_API_KEY, configurada como secret no Cloudflare) e repassa
   a resposta. Assim a chave nunca aparece no código do cliente. */
// Aeródromos espalhados pelo país (litoral + interior + capitais das 5 regiões), cada um
// com coordenadas fixas — a API de METAR não devolve lat/lng, só a mensagem textual.
const REDEMET_STATIONS = [
  { icao: 'SBGL', nome: 'Rio de Janeiro/Galeão', uf: 'RJ', lat: -22.8100, lng: -43.2506 },
  { icao: 'SBSP', nome: 'São Paulo/Congonhas', uf: 'SP', lat: -23.6261, lng: -46.6564 },
  { icao: 'SBGR', nome: 'Guarulhos', uf: 'SP', lat: -23.4356, lng: -46.4731 },
  { icao: 'SBSV', nome: 'Salvador', uf: 'BA', lat: -12.9086, lng: -38.3225 },
  { icao: 'SBRF', nome: 'Recife', uf: 'PE', lat: -8.1264, lng: -34.9236 },
  { icao: 'SBFZ', nome: 'Fortaleza', uf: 'CE', lat: -3.7763, lng: -38.5326 },
  { icao: 'SBBE', nome: 'Belém', uf: 'PA', lat: -1.3792, lng: -48.4763 },
  { icao: 'SBEG', nome: 'Manaus', uf: 'AM', lat: -3.0386, lng: -60.0497 },
  { icao: 'SBCT', nome: 'Curitiba', uf: 'PR', lat: -25.5285, lng: -49.1758 },
  { icao: 'SBPA', nome: 'Porto Alegre', uf: 'RS', lat: -29.9944, lng: -51.1714 },
  { icao: 'SBFL', nome: 'Florianópolis', uf: 'SC', lat: -27.6703, lng: -48.5525 },
  { icao: 'SBVT', nome: 'Vitória', uf: 'ES', lat: -20.2581, lng: -40.2864 },
  { icao: 'SBCF', nome: 'Belo Horizonte/Confins', uf: 'MG', lat: -19.6336, lng: -43.9686 },
  { icao: 'SBBR', nome: 'Brasília', uf: 'DF', lat: -15.8697, lng: -47.9208 },
  { icao: 'SBGO', nome: 'Goiânia', uf: 'GO', lat: -16.6320, lng: -49.2206 },
  { icao: 'SBCY', nome: 'Cuiabá', uf: 'MT', lat: -15.6529, lng: -56.1167 },
  { icao: 'SBCG', nome: 'Campo Grande', uf: 'MS', lat: -20.4686, lng: -54.6725 },
  { icao: 'SBTE', nome: 'Teresina', uf: 'PI', lat: -5.0597, lng: -42.8236 },
  { icao: 'SBSL', nome: 'São Luís', uf: 'MA', lat: -2.5853, lng: -44.2342 },
  { icao: 'SBNT', nome: 'Natal', uf: 'RN', lat: -5.7681, lng: -35.3764 },
  { icao: 'SBJP', nome: 'João Pessoa', uf: 'PB', lat: -7.1508, lng: -34.9486 },
  { icao: 'SBMO', nome: 'Maceió', uf: 'AL', lat: -9.5108, lng: -35.7917 },
  { icao: 'SBAR', nome: 'Aracaju', uf: 'SE', lat: -10.9840, lng: -37.0703 },
  { icao: 'SBRB', nome: 'Rio Branco', uf: 'AC', lat: -9.8686, lng: -67.8992 },
  { icao: 'SBPV', nome: 'Porto Velho', uf: 'RO', lat: -8.7093, lng: -63.9022 },
  { icao: 'SBBV', nome: 'Boa Vista', uf: 'RR', lat: 2.8414, lng: -60.6922 },
  { icao: 'SBMQ', nome: 'Macapá', uf: 'AP', lat: 0.0511, lng: -51.0722 },
  { icao: 'SBKP', nome: 'Campinas/Viracopos', uf: 'SP', lat: -23.0075, lng: -47.1344 },
  { icao: 'SBJV', nome: 'Joinville', uf: 'SC', lat: -26.2245, lng: -48.7975 },
  { icao: 'SBSN', nome: 'Santarém', uf: 'PA', lat: -2.4231, lng: -54.7856 }
];
const REDEMET = { enabled: true, fetching: false, lastSuccess: 0, stations: [], layer: true };

function metarFmtDataHora(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}

// Extrai temperatura, ponto de orvalho, vento e pressão de uma mensagem METAR crua.
// Não é um parser completo (nuvens, RVR, grupos de tempo presente ficam de fora),
// só o suficiente pra mostrar um resumo útil no painel.
function parseMetarBasico(raw) {
  const s = String(raw || '');
  const out = { tempC: null, orvalhoC: null, ventoDir: null, ventoKt: null, rajadaKt: null, qnh: null };
  const mTemp = s.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  if (mTemp) {
    out.tempC = Number(mTemp[1].replace('M', '-'));
    out.orvalhoC = Number(mTemp[2].replace('M', '-'));
  }
  const mVento = s.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  if (mVento) {
    out.ventoDir = mVento[1] === 'VRB' ? null : Number(mVento[1]);
    out.ventoKt = Number(mVento[2]);
    out.rajadaKt = mVento[3] ? Number(mVento[3]) : null;
  }
  const mQnh = s.match(/\bQ(\d{4})\b/);
  if (mQnh) out.qnh = Number(mQnh[1]);
  return out;
}

async function fetchRedemetMetar() {
  if (!REDEMET.enabled || REDEMET.fetching) return;
  REDEMET.fetching = true;
  const t = performance.now();
  try {
    const agora = new Date();
    const inicio = new Date(agora.getTime() - 4 * 3600000);
    const localidades = REDEMET_STATIONS.map(s => s.icao).join(',');
    const url = `https://black-sky-9ba0.terrestre.workers.dev/redemet-metar?localidades=${encodeURIComponent(localidades)}&data_ini=${metarFmtDataHora(inicio)}&data_fim=${metarFmtDataHora(agora)}`;
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { cache: 'no-store', signal: c.signal });
    clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const lista = (d && d.data && Array.isArray(d.data.data)) ? d.data.data : [];
    if (!lista.length) throw new Error('resposta sem mensagens');

    // Mantém só a mensagem mais recente por localidade
    const maisRecentePorLocal = {};
    lista.forEach(item => {
      const cod = item.id_localidade;
      const t2 = new Date(String(item.validade_inicial).replace(' ', 'T') + 'Z').getTime();
      if (!maisRecentePorLocal[cod] || t2 > maisRecentePorLocal[cod]._t) {
        maisRecentePorLocal[cod] = { ...item, _t: t2 };
      }
    });

    const stations = REDEMET_STATIONS.map(s => {
      const msg = maisRecentePorLocal[s.icao];
      if (!msg) return null;
      const parsed = parseMetarBasico(msg.mens);
      return {
        icao: s.icao, nome: s.nome, uf: s.uf, lat: s.lat, lng: s.lng,
        ...parsed, raw: msg.mens, updatedAt: msg._t
      };
    }).filter(Boolean);

    if (!stations.length) throw new Error('nenhuma estação decodificada');
    REDEMET.stations = stations;
    REDEMET.lastSuccess = Date.now();
    const elapsed = Math.round(performance.now() - t);
    try { if (typeof setSource === 'function') setSource('REDEMET', 'ok', elapsed); } catch (e) {}
    if (map) renderRedemetLayer();
  } catch (e) {
    console.warn('REDEMET METAR:', e && e.message);
    try { if (typeof setSource === 'function') setSource('REDEMET', 'off', null, e && e.message); } catch (err) {}
  } finally {
    REDEMET.fetching = false;
  }
}

function corTemperaturaRedemet(t) {
  if (t == null) return '#94a3b8';
  if (t >= 32) return '#ef4444';
  if (t >= 26) return '#fb923c';
  if (t >= 18) return '#facc15';
  if (t >= 10) return '#4ade80';
  return '#38bdf8';
}

// Mesmo motivo do CEMADEN acima: referências estáveis pra map.off() conseguir
// remover o listener certo antes de re-adicionar a cada ciclo (fetchRedemetMetar
// roda a cada 10min via agendarBusca) — sem isso os handlers de click/hover
// se acumulavam indefinidamente.
function onRedemetClick(e) {
  const p = e.features?.[0]?.properties;
  if (!p) return;
  const vento = p.ventoKt != null ? `${p.ventoKt} kt${p.rajadaKt ? ' (rajada ' + p.rajadaKt + ' kt)' : ''}` : 'N/D';
  new maplibregl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(
    `<b>🛩️ ${String(p.icao || '').replace(/[<>]/g, '')} — ${String(p.nome || '').replace(/[<>]/g, '')}/${String(p.uf || '').replace(/[<>]/g, '')}</b><br>` +
    `<b>Temp:</b> ${p.tempC != null ? p.tempC + '°C' : 'N/D'} · <b>Orvalho:</b> ${p.orvalhoC != null ? p.orvalhoC + '°C' : 'N/D'}<br>` +
    `<b>Vento:</b> ${vento}<br>` +
    `<b>QNH:</b> ${p.qnh != null ? p.qnh + ' hPa' : 'N/D'}<br>` +
    `<small>Estação meteorológica REDEMET/DECEA (aeródromo) · METAR: ${String(p.raw || '').replace(/[<>]/g, '')}</small>`
  ).addTo(map);
}
function onRedemetEnter() { map.getCanvas().style.cursor = 'pointer'; }
function onRedemetLeave() { map.getCanvas().style.cursor = ''; }
function renderRedemetLayer() {
  if (!map) return;
  try {
    map.off('click', 'redemet-stations-layer', onRedemetClick);
    map.off('mouseenter', 'redemet-stations-layer', onRedemetEnter);
    map.off('mouseleave', 'redemet-stations-layer', onRedemetLeave);
    if (map.getLayer('redemet-stations-label')) map.removeLayer('redemet-stations-label');
    if (map.getLayer('redemet-stations-layer')) map.removeLayer('redemet-stations-layer');
    if (map.getSource('redemet-stations-source')) map.removeSource('redemet-stations-source');
  } catch (e) {}
  const features = REDEMET.stations.map(s => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: {
      icao: s.icao, nome: s.nome, uf: s.uf, tempC: s.tempC, orvalhoC: s.orvalhoC,
      ventoKt: s.ventoKt, rajadaKt: s.rajadaKt, qnh: s.qnh, raw: s.raw,
      tempLabel: s.tempC != null ? Math.round(s.tempC) + '°' : '—',
      cor: corTemperaturaRedemet(s.tempC)
    }
  }));
  map.addSource('redemet-stations-source', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: 'redemet-stations-layer', type: 'circle', source: 'redemet-stations-source',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 8, 7, 12, 11, 16],
      'circle-color': ['get', 'cor'], 'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.2, 'circle-opacity': .85
    }
  });
  map.addLayer({
    id: 'redemet-stations-label', type: 'symbol', source: 'redemet-stations-source',
    layout: {
      'text-field': ['get', 'tempLabel'], 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true, 'text-ignore-placement': true
    },
    paint: { 'text-color': '#0b1220' }
  });
  map.on('click', 'redemet-stations-layer', onRedemetClick);
  map.on('mouseenter', 'redemet-stations-layer', onRedemetEnter);
  map.on('mouseleave', 'redemet-stations-layer', onRedemetLeave);
}

const PRO={radar:true,follow:true,replay:false,speed:1,timer:null,events:[],idx:0,radarLayer:false,sourceState:{}};
const SRC={USGS:'https://earthquake.usgs.gov',EMSC:'https://www.emsc-csem.org',JMA:'https://www.data.jma.go.jp',IGP:'https://ide.igp.gob.pe',GDACS:'https://www.gdacs.org',NHC:'https://www.nhc.noaa.gov',INMET:'https://apiprevmet3.inmet.gov.br',NWS:'https://api.weather.gov',OpenMeteo:'https://api.open-meteo.com',EONET:'https://eonet.gsfc.nasa.gov',RainViewer:'https://www.rainviewer.com',CEMADEN:'https://painelalertas.cemaden.gov.br',CPTEC:'https://servicos.cptec.inpe.br',CGE:'https://www.cgesp.org',AFAD:'https://deprem.afad.gov.tr',REDEMET:'https://api-redemet.decea.mil.br',USP:'https://moho.iag.usp.br','USGS-Volcano':'https://volcanoes.usgs.gov','VAAC-Global':'https://www.data.jma.go.jp',GEOFON:'https://geofon.gfz-potsdam.de','OSC-BOL':'https://www.osc.org.bo',BMKG:'https://data.bmkg.go.id',GEONET:'https://api.geonet.org.nz',FUNVISIS:'https://sismosve.rafnixg.dev',INPE:'https://dataserver-coids.inpe.br','CSN-Chile':'https://api.gael.cloud','SSN-Mexico':'https://www.ssn.unam.mx',ANA:'https://www.snirh.gov.br'};
function q(id){return document.getElementById(id)}
function safeText(id,v){const e=q(id);if(e)e.textContent=v==null?'--':v}
// Fontes sísmicas REGIONAIS (rede nacional de um país específico): quando
// uma delas cai, o sismo daquela região continua chegando pelo USGS/EMSC
// (rede global, cobre o planeta inteiro) — só perde o detalhe extra que só
// a rede local capta. O aviso deixa isso explícito, em vez de "OFFLINE" seco
// parecer que a região ficou sem monitoramento nenhum.
const REGIONAL_SEISMIC_FALLBACK = {
  IGP: 'Peru — USGS/EMSC seguem cobrindo a região',
  JMA: 'Japão — USGS/EMSC seguem cobrindo a região',
  'OSC-BOL': 'Bolívia — USGS/EMSC seguem cobrindo a região',
  BMKG: 'Indonésia — USGS/EMSC seguem cobrindo a região',
  GEONET: 'Nova Zelândia — USGS/EMSC seguem cobrindo a região',
  FUNVISIS: 'Venezuela — USGS/EMSC seguem cobrindo a região',
  USP: 'Brasil — USGS/EMSC seguem cobrindo a região',
  AFAD: 'Turquia — USGS/EMSC seguem cobrindo a região',
  'CSN-Chile': 'Chile — USGS/EMSC seguem cobrindo a região',
  'SSN-Mexico': 'México — USGS/EMSC seguem cobrindo a região'
};
function setSource(name,status,ms,error){
  // 2 falhas seguidas → OFF; 1 falha → LENTO. Sucesso zera.
  // SourceHealth: 3ª falha abre cooldown 90s (não martela a fonte).
  const prev = PRO.sourceState[name] || {};
  if (status === 'off') {
    let sh = null;
    try { if (typeof SourceHealth !== 'undefined') sh = SourceHealth.recordFail(name, error, ms); } catch (e) {}
    const fails = sh ? sh.fails : ((prev._fails || 0) + 1);
    if (fails < 2) {
      PRO.sourceState[name] = {status: prev.status === 'ok' ? 'warn' : (prev.status || 'warn'), ms, time: Date.now(), error, _fails: fails};
      renderSources();
      return;
    }
    PRO.sourceState[name] = {status: 'off', ms, time: Date.now(), error, _fails: fails};
  } else {
    try { if (typeof SourceHealth !== 'undefined' && status === 'ok') SourceHealth.recordOk(name, ms); } catch (e) {}
    PRO.sourceState[name] = {status, ms, time: Date.now(), error: error || '', _fails: 0};
  }
  renderSources();
}
function renderSources(){const c=q('source-list');const keys=Object.keys(SRC);let ok=0,warn=0,off=0;const offNames=[];const rows=keys.map(k=>{const s=PRO.sourceState[k]||{};if(s.status==='ok')ok++;else if(s.status==='warn')warn++;else if(s.status==='off'){off++;offNames.push(k);}const cls=s.status==='ok'?'source-ok':s.status==='warn'?'source-warn':s.status==='off'?'source-off':'';const label=s.status==='ok'?'ONLINE':s.status==='warn'?'LENTO':s.status==='off'?'OFF':'--';const ms=s.ms?Math.round(s.ms)+'ms':'--';const age=s.time?Math.max(0,Math.round((Date.now()-s.time)/1000))+'s':'--';const title=s.error?` title="${String(s.error).replace(/"/g,'&quot;')}"`:'';return `<div class="source-row"><span>${k}</span><b class="${cls}"${title}>${label}</b><span>${ms} · ${age}</span></div>`}).join('');if(c)c.innerHTML=rows;const sum=`${ok} online · ${warn} atenção · ${off} offline`;safeText('source-summary',sum);try{const el=document.getElementById('ts-meta-fresh');if(el&&offNames.length)el.title='Offline: '+offNames.join(', ');const strip=document.getElementById('ts-meta-fontes');if(strip&&off){strip.style.color='#f87171';}else if(strip){strip.style.color='';}}catch(e){}// Toast discreto quando uma fonte cai
try{const prev=window.__srcOffCount|0;window.__srcOffCount=off;if(off>prev&&off>0&&typeof showToast==='function'){(()=>{const n=offNames.find(x=>x!=='OpenMeteo'); if(!n) return; const fallback=REGIONAL_SEISMIC_FALLBACK[n]; showToast('⚠️ Fonte offline: '+n+(fallback?' · '+fallback:''),'warn');})();}}catch(e){}}
async function pingSource(name,url){
  try {
    if (typeof SourceHealth !== 'undefined' && SourceHealth.isOpen(name)) {
      // Em cooldown: não martela a URL; mantém OFF até o timer passar
      const left = Math.round(SourceHealth.remainingMs(name) / 1000);
      PRO.sourceState[name] = Object.assign({}, PRO.sourceState[name] || {}, {
        status: 'off', time: Date.now(), error: 'cooldown ' + left + 's', _fails: 3
      });
      renderSources();
      return false;
    }
  } catch (e) {}
  const t=performance.now();
  try{
    const c=new AbortController(),tm=setTimeout(()=>c.abort(),7000);
    const r=await fetch(url,{method:'GET',cache:'no-store',signal:c});
    clearTimeout(tm);
    const ms=performance.now()-t;
    if(!r.ok){setSource(name,'warn',ms,'HTTP '+r.status);return false}
    setSource(name,'ok',ms);return true;
  }catch(e){
    setSource(name,'off',null,e?.name==='AbortError'?'timeout':(e?.message||'falha de rede'));
    return false;
  }
}
async function checkSources(){
  const lat=Number(weatherLoc?.lat)||-23.55,lng=Number(weatherLoc?.lng)||-46.63;
  // Saúde mede endpoints leves e funcionais. Fontes com CORS restritivo passam pelo Worker.
  const viaWorker=(url)=>{try{return typeof WORKER_PROXY==='function'?WORKER_PROXY(url):url}catch(e){return url}};
  const today=new Date().toISOString().slice(0,10);
  await Promise.allSettled([
    pingSource('USGS',SRC.USGS+'/fdsnws/event/1/application.json'),
    pingSource('EMSC',SRC.EMSC),
    pingSource('JMA','https://www.jma.go.jp/bosai/quake/data/list.json'),
    // IGP e USGS-Volcano eram as 2 únicas fontes desta lista testadas direto do
    // navegador (sem viaWorker) — institutos de governo raramente liberam CORS
    // pra origem de terceiros, então isso dava "OFFLINE" falso mesmo com o
    // servidor de pé (o navegador bloqueia a resposta antes do JS enxergar).
    // Servidor-a-servidor (via Worker) não tem essa restrição.
    pingSource('IGP',viaWorker('https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/UltimoSismo/MapServer/0?f=json')),
    pingSource('GDACS',viaWorker(SRC.GDACS+'/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromdate='+today+'&todate='+today)),
    pingSource('NWS',SRC.NWS+'/alerts/active?status=actual'),
    pingSource('OpenMeteo',SRC.OpenMeteo+`/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`),
    pingSource('EONET',SRC.EONET+'/api/v3/events'),
    pingSource('RainViewer','https://api.rainviewer.com/public/weather-maps.json'),
    pingSource('USGS-Volcano',viaWorker('https://volcanoes.usgs.gov/vsc/api/hansApi/vonas/30')),
    pingSource('GEOFON',viaWorker(SRC.GEOFON+'/fdsnws/event/1/version')),
    pingSource('OSC-BOL',viaWorker(SRC['OSC-BOL']+'/index.php/es/')),
    pingSource('BMKG',viaWorker(SRC.BMKG+'/DataMKG/TEWS/gempaterkini.json')),
    pingSource('GEONET',viaWorker(SRC.GEONET+'/quake?MMI=-1')),
    // Caminho corrigido pra bater com o que já funciona de verdade: o próprio
    // handler do Worker (handleFunvisisEarthquakes) só consegue dados por
    // "/api/sismos/recent?limit=N" quando "/api/sismos" sozinho vem vazio —
    // o teste de status usava só o primeiro, que é o caminho menos confiável.
    pingSource('FUNVISIS',viaWorker(SRC.FUNVISIS+'/api/sismos/recent?limit=5')),
    pingSource('CSN-Chile',viaWorker(SRC['CSN-Chile']+'/general/public/sismos')),
    pingSource('SSN-Mexico',viaWorker(SRC['SSN-Mexico']+'/sismicidad/ultimos-utc/')),
    pingSource('CPTEC',viaWorker(SRC.CPTEC+'/XML/capitais/condicoesAtuais.xml')),
    pingSource('INPE',viaWorker(SRC.INPE+'/queimadas/queimadas/focos/csv/10min/')),
    pingSource('CGE',viaWorker(SRC.CGE+'/v3/alagamentos.jsp')),
    pingSource('ANA',viaWorker(SRC.ANA+'/hidroweb/rest/api/estacaotelemetrica?id=87450020'))
  ]);
}

function riskScore(){
  let localScore=0, globalScore=0, reasons=[];
  const ref = (typeof weatherLoc!=='undefined'&&weatherLoc) ? weatherLoc : {lat:-23.55,lng:-46.63,nome:'São Paulo'};
  const pushR = (pts,text,isLocal)=>{ reasons.push({pts,text,isLocal:!!isLocal}); };

  // Alertas ativos
  (Array.isArray(globalAlerts)?globalAlerts:[]).forEach(a=>{
    let pts=0;
    const type=a.type;
    if(type==='tsunami')pts=10;
    else if(type==='tornado')pts=8;
    else if(type==='hurricane')pts=6;
    else if(type==='flood')pts=7;
    else if(type==='civil')pts=Math.max(2,Math.min(8,Number(a.sev)||3));
    else if(type==='storm')pts=4;
    else if(type==='wind')pts=3;
    else if(type==='fire')pts=2;
    let isLocal=false;
    if(a.coords&&typeof haversine==='function'){
      const d=haversine(ref.lat,ref.lng,a.coords[1],a.coords[0]);
      if(d<120){ pts*=1.85; isLocal=true; }
      else if(d<350){ pts*=1.3; isLocal=true; }
      else if(d<800){ pts*=0.55; }
      else { pts*=0.12; }
    }
    if(isLocal) localScore=Math.max(localScore,pts); else globalScore=Math.max(globalScore,pts);
    if(pts>=3.5) pushR(pts,(a.icon||'⚠️')+' '+(a.place||type),isLocal);
  });

  // Sismos recentes próximos (últimas 6h)
  const cutQ = Date.now()-6*3600000;
  (Array.isArray(globalEvents)?globalEvents:[]).forEach(e=>{
    if(!e||e.time<cutQ||!e.coords) return;
    const mag=Number(e.mag)||0;
    if(mag<3.5) return;
    const d=haversine(ref.lat,ref.lng,e.coords[1],e.coords[0]);
    let pts = mag>=6 ? 9 : mag>=5 ? 7 : mag>=4.5 ? 5 : 2.5;
    let isLocal=false;
    if(d<150){ pts*=1.9; isLocal=true; }
    else if(d<400){ pts*=1.2; isLocal=true; }
    else if(d>2000){ pts*=0.1; }
    else { pts*=0.35; }
    if(isLocal) localScore=Math.max(localScore,pts); else globalScore=Math.max(globalScore,pts);
    if(pts>=4) pushR(pts,'🌍 M'+mag.toFixed(1)+' '+(e.place||'').slice(0,40),isLocal);
  });

  const w=window.__proWeather||{};
  if(w.gust>=60){ localScore=Math.max(localScore,6); pushR(6,'💨 Rajadas fortes em '+(ref.nome||'local'),true); }
  else if(w.gust>=45){ localScore=Math.max(localScore,3); pushR(3,'💨 Rajadas elevadas',true); }
  if(w.rain>=15){ localScore=Math.max(localScore,7); pushR(7,'🌧️ Chuva intensa',true); }
  else if(w.rain>=5){ localScore=Math.max(localScore,3); pushR(3,'🌧️ Chuva moderada',true); }
  if(w.code>=95){ localScore=Math.max(localScore,8); pushR(8,'⚡ Tempestade com raios',true); }

  // Score final prioriza ameaça LOCAL; global só empurra se for extremo
  const score = Math.max(localScore, globalScore >= 8 ? globalScore * 0.85 : globalScore * 0.45);
  let level='normal',label='NORMAL',icon='🟢';
  if(score>=8){level='critical';label='CRÍTICO';icon='🔴';}
  else if(score>=5){level='alert';label='ALERTA';icon='🟠';}
  else if(score>=2.5){level='attention';label='ATENÇÃO';icon='🟡';}

  const top=reasons.sort((a,b)=>b.pts-a.pts).slice(0,3);
  let confidence='ALTA';
  const states=Object.values(PRO.sourceState||{});
  const offline=states.filter(x=>x.status==='off').length;
  const active=states.filter(x=>x.status==='ok').length;
  if(active<3 || offline>=3) confidence='BAIXA';
  else if(offline>=1 || active<5) confidence='MODERADA';

  const localTag = localScore>=2.5 ? ' · foco local' : (globalScore>=6 ? ' · ameaça distante' : '');
  return {
    score, localScore, globalScore, level, label, icon, confidence,
    reason: (top.length ? top.map(x=>x.text).join(' • ') : 'Sem ameaça relevante detectada.') + localTag
  };
}
function updateRisk(){const r=riskScore(),card=q('risk-card');if(!card)return;card.className='risk-card risk-'+r.level;safeText('risk-icon',r.icon);safeText('risk-label',r.label);safeText('risk-reason',r.reason);safeText('risk-confidence','Confiança: '+r.confidence);card.title=r.reason+' • Confiança: '+r.confidence;if(q('kpibox-sp'))q('kpibox-sp').style.borderLeftColor=r.level==='critical'?'#ef4444':r.level==='alert'?'#fb923c':r.level==='attention'?'#facc15':'#4ade80';syncMobileRisk()}
async function fetchProSP(){
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&current=temperature_2m,apparent_temperature,weather_code,wind_gusts_10m,precipitation,relative_humidity_2m&timezone=auto`;
  const t=performance.now();
  try{
    // Usar o mesmo fallback CORS/retry do restante do sistema. A chamada direta
    // antiga fazia o cabeçalho ficar em "--" mesmo quando Open-Meteo estava disponível.
    let d=null, lastErr=null;
    for(let tentativa=0; tentativa<2 && !d; tentativa++){
      try{
        if(tentativa>0) await new Promise(r=>setTimeout(r,1200));
        const r=await fetchWithCorsFallback(u,10000);
        d=await r.json();
        if(!d || !d.current) throw new Error('sem current');
      }catch(e){ lastErr=e; d=null; }
    }
    if(!d || !d.current) throw (lastErr || new Error('sem current'));
    const c=d.current;
    let temp=Number(c.temperature_2m), feels=Number(c.apparent_temperature);
    const gust=Number(c.wind_gusts_10m), rain=Number(c.precipitation), hum=Number(c.relative_humidity_2m);
    // O Open-Meteo "current" é um valor de modelo/nowcast — em mudanças rápidas de
    // tempo (frente fria, tempestade) ele pode ficar defasado da rua por vários
    // graus. A estação de Congonhas (SBSP) é medição real de instrumento; quando
    // tem leitura recente (<60 min), ela é mais confiável que o modelo pro "agora".
    let tempFonte = 'Open-Meteo';
    try{
      const metarSP = (REDEMET.stations||[]).find(s=>s.icao==='SBSP');
      if(metarSP && metarSP.tempC!=null && Number.isFinite(metarSP.tempC) && (Date.now()-metarSP.updatedAt)<3600000){
        temp = metarSP.tempC;
        tempFonte = 'METAR SBSP, '+Math.round((Date.now()-metarSP.updatedAt)/60000)+'min atrás';
      }
    }catch(_){}
    window.__proWeather={
      temp, feels,
      gust:Number.isFinite(gust)?gust:0,
      rain:Number.isFinite(rain)?rain:0,
      hum:Number.isFinite(hum)?hum:null,
      code:Number(c.weather_code)||0
    };
    const city=(weatherLoc.nome||'São Paulo').toUpperCase();
    safeText('sp-city-name',siglaCidade(weatherLoc.nome||'São Paulo'));
    safeText('sp-live-city',city);
    safeText('sp-live-temp',Number.isFinite(temp)?Math.round(temp)+'°':'--');
    try{ const elT=q('sp-live-temp'); if(elT) elT.title='Fonte: '+tempFonte; }catch(_){}
    safeText('sp-live-feels',Number.isFinite(feels)?'sens '+Math.round(feels)+'°':'sens --');
    safeText('sp-live-gust',Number.isFinite(gust)?Math.round(gust)+' km/h':'--');
    safeText('sp-live-rain',Number.isFinite(rain)?rain.toFixed(1)+' mm':'--');
    safeText('sp-live-hum',Number.isFinite(hum)?Math.round(hum)+'%':'--');
    // Mantém o KPI legado sincronizado caso ele seja exibido em algum breakpoint.
    safeText('kpi-temp',Number.isFinite(temp)?Math.round(temp)+'°':'--');
    safeText('kpi-feels',Number.isFinite(feels)?'sens '+Math.round(feels)+'°':'sens --');
    try{safeText('kpi-wx-icon',weatherEmoji(Number(c.weather_code)||0));}catch(e){}
    safeText('kpi-wind',Number.isFinite(gust)?'💨 '+Math.round(gust)+' km/h':'💨 --');
    syncMobileWeather();
    setSource('OpenMeteo','ok',performance.now()-t);
    updateRisk();
  }catch(e){
    console.warn('Open-Meteo painel PRO:',e&&e.message||e);
    // Backup wttr.in — evita cabeçalho "--" e toast de offline em blip do Open-Meteo
    try{
      const r2=await fetchWithCorsFallback(`https://wttr.in/${weatherLoc.lat},${weatherLoc.lng}?format=j1`,10000);
      const d2=await r2.json();
      const cc=(d2.current_condition&&d2.current_condition[0])||null;
      if(!cc || cc.temp_C==null) throw new Error('wttr sem current');
      const temp=Number(cc.temp_C);
      const feels=Number(cc.FeelsLikeC!=null?cc.FeelsLikeC:cc.temp_C);
      const gust=Number(cc.WindGustKmph!=null?cc.WindGustKmph:cc.windspeedKmph)||0;
      const rain=Number(cc.precipMM)||0;
      const hum=Number(cc.humidity);
      window.__proWeather={temp,feels,gust,rain,hum:Number.isFinite(hum)?hum:null,code:0};
      const city=(weatherLoc.nome||'São Paulo').toUpperCase();
      safeText('sp-city-name',siglaCidade(weatherLoc.nome||'São Paulo'));
      safeText('sp-live-city',city);
      safeText('sp-live-temp',Number.isFinite(temp)?Math.round(temp)+'°':'--');
      safeText('sp-live-feels',Number.isFinite(feels)?'sens '+Math.round(feels)+'°':'sens --');
      safeText('sp-live-gust',Number.isFinite(gust)?Math.round(gust)+' km/h':'--');
      safeText('sp-live-rain',Number.isFinite(rain)?rain.toFixed(1)+' mm':'--');
      safeText('sp-live-hum',Number.isFinite(hum)?Math.round(hum)+'%':'--');
      safeText('kpi-temp',Number.isFinite(temp)?Math.round(temp)+'°':'--');
      safeText('kpi-feels',Number.isFinite(feels)?'sens '+Math.round(feels)+'°':'sens --');
      safeText('kpi-wind',Number.isFinite(gust)?'💨 '+Math.round(gust)+' km/h':'💨 --');
      syncMobileWeather();
      setSource('OpenMeteo','ok',performance.now()-t);
      try{ if(typeof updateRisk==='function') updateRisk(); }catch(_){}
      return;
    }catch(e2){
      console.warn('Open-Meteo+wttr painel PRO falhou:',e2&&e2.message||e2);
      setSource('OpenMeteo','off',null);
    }
  }
}
async function radarOn(){if(!map||!PRO.radar)return;try{const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'});if(!r.ok)throw Error('radar '+r.status);const d=await r.json();const past=(d.radar&&d.radar.past)||[];if(!past.length)throw Error('sem frames');const frame=past[past.length-1];const host=d.host;const url=host+frame.path+'/256/{z}/{x}/{y}/2/1_1.png';if(map.getLayer('pro-radar-layer'))map.removeLayer('pro-radar-layer');if(map.getSource('pro-radar-source'))map.removeSource('pro-radar-source');map.addSource('pro-radar-source',{type:'raster',tiles:[url],tileSize:256,maxzoom:7,attribution:'Weather data by RainViewer'});map.addLayer({id:'pro-radar-layer',type:'raster',source:'pro-radar-source',paint:{'raster-opacity':.62,'raster-fade-duration':0}});PRO.radarLayer=true;const time=new Date(frame.time*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});safeText('radar-time-pro','Último quadro: '+time);q('radar-legend-pro').style.display='block';q('btn-radar-pro').classList.add('active');q('btn-radar-header')?.classList.add('active');setSource('RainViewer','ok',0)}catch(e){setSource('RainViewer','warn',null);safeText('radar-time-pro','Radar indisponível no momento')}}
function radarOff(){if(!map)return;try{if(map.getLayer('pro-radar-layer'))map.removeLayer('pro-radar-layer');if(map.getSource('pro-radar-source'))map.removeSource('pro-radar-source')}catch(e){}PRO.radarLayer=false;q('radar-legend-pro').style.display='none';q('btn-radar-pro').classList.remove('active')}
function toggleRadar(){PRO.radar=!PRO.radar;if(PRO.radar)radarOn();else radarOff();q('btn-radar-header')?.classList.toggle('active',PRO.radar)}
function toggleCrisis(fromAuto){
  /* Modo crise removido permanentemente — site sempre em modo normal */
  if (typeof PRO !== 'undefined') PRO.crisis = false;
  try { document.body.classList.remove('pro-crisis'); } catch (e) {}
  try { localStorage.removeItem('monitor_crisis_snooze'); } catch (e) {}
}
function buildReplay(){const now=Date.now(),cut=now-86400000;const a=[...(globalEvents||[]),...(globalAlerts||[])].filter(x=>x&&x.coords&&x.time>=cut).sort((x,y)=>x.time-y.time);const seen=new Set();PRO.events=a.filter(x=>{const id=x.id||Math.random();if(seen.has(id))return false;seen.add(id);return true})}
function replayStep(){if(!PRO.replay)return;buildReplay();if(!PRO.events.length){safeText('replay-status-pro','Sem eventos nas últimas 24h');return}const item=PRO.events[PRO.idx%PRO.events.length];const pct=Math.round(((PRO.idx+1)/PRO.events.length)*100);q('replay-range-pro').value=pct;safeText('replay-status-pro',`${PRO.idx+1}/${PRO.events.length} · ${item.place||'evento'}`);if(map&&PRO.follow){const z=item.type==='earthquake'?Math.min(8.5,Math.max(2.7,7.2-(item.depth||0)/180)):5.5;map.flyTo({center:item.coords,zoom:z,duration:Math.max(500,1800/PRO.speed),essential:true})}PRO.idx++;PRO.timer=setTimeout(replayStep,Math.max(300,2600/PRO.speed))}
function startReplay(){if(PRO.replay){return}PRO.replay=true;PRO.idx=0;q('replay-panel-pro').style.display='block';q('btn-replay-pro').classList.add('active');replayStep()}
function stopReplay(){PRO.replay=false;clearTimeout(PRO.timer);PRO.timer=null;q('replay-panel-pro').style.display='none';q('btn-replay-pro').classList.remove('active')}
function setReplaySpeed(n){PRO.speed=n;if(PRO.replay){clearTimeout(PRO.timer);replayStep()}}
function syncMobileRisk(){
  const icon=q('risk-icon')?.textContent||'🟢', label=q('risk-label')?.textContent||'NORMAL', reason=q('risk-reason')?.textContent||'Sem ameaça relevante';
  safeText('mobile-risk-icon',icon);safeText('mobile-risk-label',label);safeText('mobile-risk-reason',reason);
  const rc=q('risk-card'), mr=q('mobile-risk-mini'); if(rc&&mr){mr.style.borderColor=getComputedStyle(rc).borderColor}
}
function syncMobileWeather(){
  const w=window.__proWeather||{};
  const t = Number.isFinite(w.temp) ? (Math.round(w.temp)+'°') : (q('kpi-temp')?.textContent||'--');
  const f = Number.isFinite(w.feels) ? ('sens '+Math.round(w.feels)+'°') : (q('kpi-feels')?.textContent||'sens --');
  safeText('mobile-temp',t);safeText('mobile-feels',f);
  // also refresh desktop feels if only mobile path ran
  if(Number.isFinite(w.feels) && q('sp-live-feels')){
    safeText('sp-live-feels','sens '+Math.round(w.feels)+'°');
  }
  safeText('mobile-gust','💨 '+(Number.isFinite(w.gust)?Math.round(w.gust)+' km/h':'--'));safeText('mobile-rain','🌧️ '+(Number.isFinite(w.rain)?Number(w.rain).toFixed(1)+' mm':'--'));safeText('mobile-hum','💧 '+(Number.isFinite(w.hum)?Math.round(w.hum)+'%':'--'));
}
function syncMobileCemaden(status){
  const b=q('mobile-btn-cemaden'), s=q('mobile-cemaden-status');if(!b||!s)return;
  const st=status||q('cemaden-status')?.className?.split(' ').pop()||'idle';
  b.classList.remove('online','warn','off');if(st==='ok'){b.classList.add('online');s.textContent='CHUVA ✓'}else if(st==='warn'){b.classList.add('warn');s.textContent='CHUVA !'}else if(st==='off'){b.classList.add('off');s.textContent='CHUVA ×'}else{s.textContent='CHUVA'}
}
function bindMobilePro(){
  q('mobile-btn-radar')?.addEventListener('click',()=>{toggleRadar();q('mobile-btn-radar').classList.toggle('active',PRO.radar)});
  /* mobile-btn-crisis removido */
  q('mobile-btn-replay')?.addEventListener('click',()=>{PRO.replay?stopReplay():startReplay();q('mobile-btn-replay').classList.toggle('active',PRO.replay)});
  q('mobile-btn-follow')?.addEventListener('click',()=>{PRO.follow=true;q('mobile-btn-follow').classList.add('active');showToast&&showToast('🎯 Câmera automática retomada','info')});
  q('mobile-btn-cemaden')?.addEventListener('click',toggleCemadenLayer);
  q('mobile-btn-more')?.addEventListener('click',()=>{q('ts-more-toggle')?.click()});
}
function operationalTick(){
  renderSources();
  const loc = weatherLoc?.origem==='GPS' ? `📍 ${weatherLoc.nome}, ${weatherLoc.uf||'--'} · GPS${weatherLoc.accuracy?' · ±'+Math.round(weatherLoc.accuracy)+' m':''}` : '📍 SP padrão · localização aguardando';
  safeText('pro-location-state',loc);
  if(q('sp-live-card'))q('sp-live-card').title=loc;
  updateRisk();
  // Snapshot leve p/ reabrir offline (só metadados, não substitui APIs ao vivo)
  try {
    const snap = {
      t: Date.now(),
      nEvents: Array.isArray(globalEvents) ? globalEvents.length : 0,
      nAlerts: Array.isArray(globalAlerts) ? globalAlerts.length : 0,
      sources: PRO && PRO.sourceState ? PRO.sourceState : {}
    };
    localStorage.setItem('monitor_last_snap', JSON.stringify(snap));
  } catch (e) {}
}
setInterval(operationalTick,15000);
function bind(){q('btn-radar-pro')?.addEventListener('click',toggleRadar);q('btn-radar-header')?.addEventListener('click',toggleRadar);/* btn-crisis-pro removido */q('btn-replay-pro')?.addEventListener('click',()=>PRO.replay?stopReplay():startReplay());q('btn-follow-pro')?.addEventListener('click',()=>{PRO.follow=true;q('btn-follow-pro').classList.add('active');showToast&&showToast('🎯 Câmera automática retomada','info')});q('btn-sources')?.addEventListener('click',()=>q('source-card').classList.toggle('open'));document.querySelectorAll('.replay-actions [data-speed]').forEach(b=>b.addEventListener('click',()=>setReplaySpeed(Number(b.dataset.speed))));q('replay-stop-pro')?.addEventListener('click',stopReplay);q('replay-range-pro')?.addEventListener('input',e=>{buildReplay();if(PRO.events.length){PRO.idx=Math.floor(Number(e.target.value)/100*PRO.events.length);const x=PRO.events[Math.min(PRO.idx,PRO.events.length-1)];if(x&&map)map.flyTo({center:x.coords,zoom:6,duration:700})}});window.addEventListener('resize',()=>{if(map&&map.resize)map.resize()});q('btn-cemaden-layer')?.addEventListener('click',toggleCemadenLayer);bindMobilePro();syncMobileRisk();syncMobileWeather();syncMobileCemaden();window.addEventListener('resize',()=>{if(map&&map.resize)map.resize()});}
function hookMap(){if(!map)return;map.on('dragstart',()=>{PRO.follow=false;q('btn-follow-pro')?.classList.remove('active')});map.on('zoomstart',()=>{if(!PRO.replay){PRO.follow=false;q('btn-follow-pro')?.classList.remove('active')}});map.on('load',()=>{setTimeout(radarOn,900);});}
function boot(){
  bind();
  renderSources();
  checkSources();
  fetchProSP();
  // Antes usavam setInterval cru, que ignora a pausa automática quando a
  // aba fica em segundo plano (agendarBusca respeita __buscasPausadasPorAba)
  // — nesse app, feito pra ficar aberto por horas/dias, isso significava
  // continuar batendo Open-Meteo/wttr.in e 18 endpoints de status a cada 5min
  // com a aba escondida, gastando bateria/dados à toa. O atraso inicial é
  // igual ao intervalo pra não repetir a chamada imediata logo acima.
  agendarBusca(fetchProSP, 300000, 300000);
  agendarBusca(checkSources, 300000, 300000);

  // Consulta a PED a cada 2 min. Isso NÃO cria dados novos: apenas captura
  // rapidamente uma nova transmissão quando o CEMADEN disponibilizá-la.
  // Atraso inicial pra não competir de cara com as outras buscas que usam proxy de CORS.
  agendarBusca(fetchCemaden, 1500, 120000);
  agendarBusca(fetchRedemetMetar, 3000, 600000);   // METAR REDEMET/DECEA (~30 aeródromos)

  setInterval(updateRisk,15000);setTimeout(()=>{if(map){hookMap()}else{const x=setInterval(()=>{if(map){clearInterval(x);hookMap()}},500)}},1500);
  // Expõe para o menu ☰ "Recarregar dados"
  window.checkSources = checkSources;
  window.fetchProSP = fetchProSP;
  window.fetchCemaden = fetchCemaden;
  window.renderSources = renderSources;
  window.operationalTick = operationalTick;
  // setSource/PRO ficavam presos neste IIFE e eram inacessíveis pro resto do
  // código (ex.: fetchUSGSVolcanoProfessional, definida bem mais acima), o que
  // gerava "setSource is not defined" e derrubava silenciosamente a busca de
  // vulcões. Também deixava o painel de debug sem ver window.PRO.sourceState.
  window.setSource = setSource;
  window.PRO = PRO;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

