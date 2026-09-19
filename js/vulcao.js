// === vulcao.js — Sistema completo de vulcões: USGS VONA, status, merge de relatórios (linhas originais 8292-8839 do core-app.js) ===

function vulcaoPick(o,keys,def=null){
    if(!o||typeof o!=='object') return def;
    for(const k of keys){
        if(o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='') return o[k];
    }
    // fallback snake_case / camelCase misturado
    for(const k of keys){
        const snake=k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase());
        if(snake!==k && o[snake]!==undefined&&o[snake]!==null&&String(o[snake]).trim()!=='') return o[snake];
    }
    return def;
}
function vulcaoCorValida(v){
    const s=String(v||'').trim().toLowerCase();
    if(/^(green|yellow|orange|red)$/.test(s)) return s;
    if(/^unassigned$/.test(s)) return '';
    return '';
}
function vulcaoNivelAlerta(v){
    const s=String(v||'').trim().toUpperCase();
    if(/^(NORMAL|ADVISORY|WATCH|WARNING|UNASSIGNED)$/.test(s)) return s==='UNASSIGNED'?'':s;
    return '';
}
function vulcaoElevado(color,alert){
    const c=String(color||'').toLowerCase();
    const a=String(alert||'').toUpperCase();
    // Critério mais rígido, a pedido: YELLOW/ADVISORY (acima do normal, sem
    // erupção) não conta mais sozinho — só ORANGE/RED ou WATCH/WARNING.
    return /^(orange|red)$/.test(c) || /^(WATCH|WARNING)$/.test(a);
}
function vulcaoNomeIgual(a,b){
    const x=normalizarNomeVulcao(a),y=normalizarNomeVulcao(b);
    return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x));
}
function vulcaoData(v){
    if(v===undefined||v===null||v==='') return null;
    const n=Number(v);
    if(Number.isFinite(n)) return n<1e12?n*1000:n;
    const t=Date.parse(String(v));
    return Number.isFinite(t)?t:null;
}
function vulcaoTextoHtml(s){
    return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function vulcaoParseVonaHtml(html){
    const raw=vulcaoTextoHtml(html);
    const pick=(re)=>{const m=raw.match(re);return m?String(m[1]).trim():'';};
    return {
        activity:pick(/ACT STS:\s*([^\n]+)/i) || pick(/ACT STS:\s*([^]*?)(?=\s+ONSET:)/i),
        onset:pick(/ONSET:\s*([^\n]+)/i) || pick(/ONSET:\s*([^]*?)(?=\s+DUR:)/i),
        duration:pick(/DUR:\s*([^\n]+)/i) || pick(/DUR:\s*([^]*?)(?=\s+VA CLD HGT:)/i),
        ashHeight:pick(/VA CLD HGT:\s*([^\n]+)/i) || pick(/VA CLD HGT:\s*([^]*?)(?=\s+HGT SOURCE:)/i),
        ashSource:pick(/HGT SOURCE:\s*([^\n]+)/i) || pick(/HGT SOURCE:\s*([^]*?)(?=\s+MOV:)/i),
        movement:pick(/MOV:\s*([^\n]+)/i) || pick(/MOV:\s*([^]*?)(?=\s+CTC:)/i),
        observatory:pick(/SVO:\s*([^\n]+)/i) || pick(/SVO:\s*([^]*?)(?=\s+ACT STS:)/i),
        remarks:pick(/RMK:\s*([^]*?)(?=\s+NXT NOTICE:|\s+NNNN|$)/i),
        colour:pick(/CURRENT COLOUR CODE:\s*([A-Z]+)/i),
        volcanoLine:pick(/VOLCANO:\s*([^\n]+)/i)
    };
}
function vulcaoObservatorio(obs){
    const map={avo:'Alaska Volcano Observatory',calvo:'Cascades Volcano Observatory',
        cvo:'Cascades Volcano Observatory',hvo:'Hawaiian Volcano Observatory',
        nmi:'Northern Mariana Islands Volcano Observatory',yvo:'Yellowstone Volcano Observatory',
        'alaska volcano observatory':'Alaska Volcano Observatory',
        'cascades volcano observatory':'Cascades Volcano Observatory',
        'hawaiian volcano observatory':'Hawaiian Volcano Observatory',
        'northern mariana islands volcano observatory':'Northern Mariana Islands Volcano Observatory',
        'yellowstone volcano observatory':'Yellowstone Volcano Observatory'};
    const s=String(obs||'').trim();
    if(!s) return 'USGS Volcano Hazards Program';
    return map[s.toLowerCase()]||s;
}
function vulcaoMergeReport(base,extra){
    if(!base) base={};
    if(!extra) return base;
    const out=Object.assign({},base);
    ['name','vnum','coords','aviationColor','alertLevel','observatory','detail','time',
     'usgsVona','usgsStatus','usgsUrl','volcanoUrl','veI','eruptionStatus','eruptionStart',
     'lastActivity','ashStatus','activityStatus','ashHeight','ashSource','vonaRemarks',
     'vonaMovement','vonaDuration','noticeId','noticeSent','elevated'].forEach(k=>{
        if((out[k]===undefined||out[k]===null||out[k]==='') && extra[k]!==undefined && extra[k]!==null && extra[k]!=='') out[k]=extra[k];
    });
    // preferir cor/alerta mais recentes / elevados da VONA
    if(extra.aviationColor && (!out.aviationColor || vulcaoElevado(extra.aviationColor,extra.alertLevel))){
        out.aviationColor=extra.aviationColor;
    }
    if(extra.alertLevel && (!out.alertLevel || vulcaoElevado(extra.aviationColor,extra.alertLevel))){
        out.alertLevel=extra.alertLevel;
    }
    if(extra.elevated) out.elevated=true;
    if(extra.usgsVona) out.usgsVona=extra.usgsVona;
    if(extra.time && (!out.time || Number(extra.time)>Number(out.time))) out.time=extra.time;
    return out;
}
function vulcaoStatusFromElevatedItem(p){
    // getElevatedVolcanoes / CAP às vezes usa nomes diferentes
    const lat=Number(vulcaoPick(p,['lat','latitude','Lat']));
    const lng=Number(vulcaoPick(p,['long','lng','longitude','Lon','lon']));
    const name=vulcaoPick(p,['vName','volcanoName','volcano_name','name'],'');
    const vnum=String(vulcaoPick(p,['vnum','volcanoNumber','volcano_number'],'')||'').trim();
    return {lat,lng,name,vnum,raw:p};
}
async function fetchUsgsVolcanoUrl(url, timeoutMs=18000){
    // Preferir Worker (domínio já liberado) → direto → proxies de emergência.
    const cAbort = (ms)=>{ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return {c,t}; };
    async function tryOne(alvo){
        const {c,t}=cAbort(timeoutMs);
        try{
            const r=await fetch(alvo,{signal:c.signal,cache:'no-store'});
            clearTimeout(t);
            if(!r.ok) return null;
            const txt=await r.text();
            if(!txt||!txt.trim()) return null;
            const head=txt.trim()[0];
            if(head!=='{'&&head!=='[') return null;
            return JSON.parse(txt);
        }catch(e){ clearTimeout(t); return null; }
    }
    // Worker proxy genérico (agora com volcanoes.usgs.gov na allowlist)
    if(typeof WORKER_PROXY==='function'){
        const data=await tryOne(WORKER_PROXY(url));
        if(data) return data;
    }
    let data=await tryOne(url);
    if(data) return data;
    const emergency=[
        u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    ];
    for(const b of emergency){
        data=await tryOne(b(url));
        if(data) return data;
    }
    return null;
}
function workerBaseUrl(){
    try{
        if(typeof WORKER_PROXY==='function'){
            return WORKER_PROXY('').split('?')[0].replace(/\/$/,'');
        }
    }catch(e){}
    return 'https://black-sky-9ba0.terrestre.workers.dev';
}
async function fetchUSGSVolcanoProfessional(){
    const t=performance.now();
    try{
        // 1) Endpoint agregado do Worker
        try{
            const base=workerBaseUrl();
            const urls=[
              base+'/usgs-volcano?t='+Date.now(),
              base+'/usgs-volcano'
            ];
            let pack=null;
            for(const u of urls){
              try{
                const r=await fetch(u,{cache:'no-store',mode:'cors'});
                if(!r.ok) continue;
                const j=await r.json();
                if(j && j.ok!==false && (Array.isArray(j.elevated)||Array.isArray(j.all))){ pack=j; break; }
              }catch(e){ console.warn('usgs-volcano try:', e?.message||e); }
            }
            if(pack){
                const isElev=(x)=>{
                  const c=String(x.aviationColor||'').toLowerCase();
                  const a=String(x.alertLevel||'').toUpperCase();
                  // Critério mais rígido, a pedido: YELLOW/ADVISORY é só "acima do
                  // normal", sem erupção — não conta mais sozinho. Só ORANGE/RED,
                  // WATCH/WARNING, ou um VONA (aviso de cinzas) ativo aparecem.
                  return /^(orange|red)$/.test(c) || /^(WATCH|WARNING)$/.test(a) || !!x.hasVona;
                };
                const all=(pack.all||[]).map(x=>({
                    name:x.name,vnum:x.vnum||'',coords:x.coords,
                    aviationColor:x.aviationColor||'',alertLevel:x.alertLevel||'',
                    elevated:isElev(x),observatory:x.observatory||'',
                    volcanoUrl:x.volcanoUrl||'',detail:x.detail||'',
                    lastActivity:x.lastActivity||'',noticeId:x.noticeId||'',
                    usgsUrl:x.usgsUrl||'',time:x.time||Date.now(),
                    usgsVona:x.hasVona?{noticeId:x.noticeId}:null
                })).filter(x=>x.name && Array.isArray(x.coords) && x.coords.length>=2);
                const elevated=(pack.elevated||[]).map(x=>({
                    name:x.name,vnum:x.vnum||'',coords:x.coords,
                    aviationColor:x.aviationColor||'',alertLevel:x.alertLevel||'',
                    elevated:true,observatory:x.observatory||'',
                    volcanoUrl:x.volcanoUrl||'',detail:x.detail||'',
                    lastActivity:x.lastActivity||'',noticeId:x.noticeId||'',
                    usgsUrl:x.usgsUrl||'',time:x.time||Date.now(),
                    usgsVona:x.hasVona?{noticeId:x.noticeId}:null
                })).filter(x=>x.name && Array.isArray(x.coords) && isElev(x));
                // se elevated veio vazio, deriva de all
                const elevFinal = elevated.length ? elevated : all.filter(isElev);
                window.__usgsVolcanoReports=all;
                window.__usgsVolcanoElevated=elevFinal;
                window.__lastVolcanoUsgsError=null;
                setSource('USGS-Volcano','ok',performance.now()-t);
                try{
                    if(elevFinal.length && !window.__usgsVolcanoToastOnce){
                        window.__usgsVolcanoToastOnce=true;
                        if(typeof showToast==='function') showToast(`🌋 USGS: ${elevFinal.length} vulcão(ões) elevado(s)/VONA`,'info');
                    }
                }catch(_){}
                return {all, elevated: elevFinal};
            }
        }catch(e){ console.warn('usgs-volcano worker route:', e?.message||e); }

        // 2) Fallback: endpoints USGS individuais via proxy/direto
        const [statusRaw, vonaRaw, elev1, elev2]=await Promise.all([
            fetchUsgsVolcanoUrl('https://volcanoes.usgs.gov/vsc/api/volcanoApi/vhpstatus',18000),
            fetchUsgsVolcanoUrl('https://volcanoes.usgs.gov/vsc/api/hansApi/vonas/30',18000),
            fetchUsgsVolcanoUrl('https://volcanoes.usgs.gov/vsc/api/volcanoApi/elevated',15000),
            fetchUsgsVolcanoUrl('https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes',15000)
        ]);
        if(!statusRaw && !vonaRaw && !elev1 && !elev2) throw new Error('USGS VHP/VONA indisponível');
        const pickArr=(j,...keys)=>{
            if(Array.isArray(j)) return j;
            if(!j||typeof j!=='object') return [];
            for(const k of keys){ if(Array.isArray(j[k])) return j[k]; }
            return [];
        };
        let elevatedRaw=pickArr(elev1,'volcanoes','data','elevated');
        if(!elevatedRaw.length) elevatedRaw=pickArr(elev2,'volcanoes','data','elevated');

        const status=pickArr(statusRaw,'volcanoes','data');
        const vonas=pickArr(vonaRaw,'vonas','data');
        const byVnum=new Map(), byName=new Map();

        status.forEach(p=>{
            const lat=Number(vulcaoPick(p,['lat','latitude']));
            const lng=Number(vulcaoPick(p,['long','lng','longitude']));
            const name=vulcaoPick(p,['vName','volcanoName','name'],'');
            if(!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
            const vnum=String(vulcaoPick(p,['vnum','volcanoNumber'],'')||'').trim();
            const color=vulcaoCorValida(vulcaoPick(p,['colorCode','aviationColorCode','color_code'],''));
            const alert=vulcaoNivelAlerta(vulcaoPick(p,['alertLevel','alertlevel','alert_level'],''));
            const report={
                name,vnum,coords:[lng,lat],usgsStatus:p,
                aviationColor:color,alertLevel:alert,
                elevated:vulcaoElevado(color,alert),
                observatory:vulcaoObservatorio(vulcaoPick(p,['obs','observatory','observatoryName','obs_fullname'],'')),
                volcanoUrl:vulcaoPick(p,['vUrl','volcanoUrl','volcanoURL'],''),
                detail:vulcaoPick(p,['noticeSynopsis','status','description'],'') || 'Status do USGS Volcano Hazards Program',
                eruptionStatus:vulcaoElevado(color,alert)?'Atividade elevada / monitorada':'Estado de fundo / não elevado',
                eruptionStart:'',
                lastActivity:vulcaoPick(p,['alertDate','colorDate','alert_date','color_date'],''),
                ashStatus:'',
                time:vulcaoData(vulcaoPick(p,['alertDate','colorDate','alert_date','color_date'],'')) || Date.now()
            };
            if(vnum) byVnum.set(vnum,report);
            byName.set(normalizarNomeVulcao(name),report);
        });

        // Marca elevated vindos de endpoint dedicado
        (elevatedRaw||[]).forEach(p=>{
            const {lat,lng,name,vnum}=vulcaoStatusFromElevatedItem(p);
            const color=vulcaoCorValida(vulcaoPick(p,['colorCode','aviationColorCode','color_code','colorCodeCd'],''));
            const alert=vulcaoNivelAlerta(vulcaoPick(p,['alertLevel','alertlevel','alert_level'],''));
            const base=(vnum&&byVnum.get(vnum)) || (name&&byName.get(normalizarNomeVulcao(name))) || null;
            const report=vulcaoMergeReport(base?Object.assign({},base):{
                name:name||'Vulcão USGS',
                vnum:vnum||'',
                coords:(Number.isFinite(lng)&&Number.isFinite(lat))?[lng,lat]:null,
                observatory:vulcaoObservatorio(vulcaoPick(p,['obs','observatory','obs_fullname'],'')),
                volcanoUrl:vulcaoPick(p,['vUrl','volcanoUrl'],''),
                detail:vulcaoPick(p,['noticeSynopsis','status','description'],'')||'Vulcão elevado (USGS)',
                time:Date.now()
            },{
                aviationColor:color|| (base&&base.aviationColor)||'',
                alertLevel:alert|| (base&&base.alertLevel)||'',
                elevated:true,
                eruptionStatus:'Atividade elevada / monitorada',
                lastActivity:vulcaoPick(p,['alertDate','colorDate','sent_utc'],'')
            });
            if(report.vnum) byVnum.set(report.vnum,report);
            if(report.name) byName.set(normalizarNomeVulcao(report.name),report);
        });

        // VONAs recentes (30 dias) — última por vulcão
        const latestVona=new Map();
        vonas.forEach(n=>{
            const vnum=String(vulcaoPick(n,['vnum','volcanoNumber','volcano_number'],'')||'').trim();
            const name=vulcaoPick(n,['vName','volcanoName','volcano_name','name'],'');
            const sent=vulcaoData(vulcaoPick(n,['sentUtc','sent','issued','date','sent_utc','sent_unixtime'],''));
            const key=vnum || normalizarNomeVulcao(name);
            if(!key) return;
            const prev=latestVona.get(key);
            if(prev && (prev._sentTs||0) >= (sent||0)) return;
            const parsed=vulcaoParseVonaHtml(vulcaoPick(n,['noticeHtml','html','notice_html'],''));
            const color=vulcaoCorValida(vulcaoPick(n,['colorCode','aviationColorCode','color_code'],'') || parsed.colour);
            const alert=vulcaoNivelAlerta(vulcaoPick(n,['alertLevel','alertlevel','alert_level'],''));
            latestVona.set(key,{
                name:name|| (parsed.volcanoLine||'').split(/\s+\d/)[0] || '',
                vnum,
                usgsVona:n,
                aviationColor:color,
                alertLevel:alert,
                elevated:vulcaoElevado(color,alert) || true, // VONA recente conta como atividade relevante
                observatory:vulcaoObservatorio(vulcaoPick(n,['obs','observatory','observatoryName','obs_fullname','obs_abbr'],'') || parsed.observatory),
                detail:vulcaoPick(n,['noticeSynopsis','summary','description'],'') || parsed.remarks || 'VONA USGS',
                eruptionStatus:parsed.activity || 'VONA emitido',
                eruptionStart:parsed.onset||'',
                lastActivity:vulcaoPick(n,['sentUtc','sent','issued','date','sent_utc'],''),
                ashStatus:parsed.ashHeight||'',
                ashHeight:parsed.ashHeight||'',
                ashSource:parsed.ashSource||'',
                vonaRemarks:parsed.remarks||'',
                vonaMovement:parsed.movement||'',
                vonaDuration:parsed.duration||'',
                noticeId:vulcaoPick(n,['noticeId','notice_identifier'],''),
                usgsUrl:vulcaoPick(n,['noticeUrl','noticeData','notice_url','notice_data'],''),
                noticeSent:vulcaoPick(n,['sentUtc','sent_utc'],''),
                _sentTs:sent||0,
                time:sent||Date.now()
            });
        });

        const merged=new Map();
        byVnum.forEach((r,k)=>merged.set('v:'+k,r));
        byName.forEach((r,k)=>{ if(!merged.has('n:'+k)) merged.set('n:'+k,r); });

        latestVona.forEach(v=>{
            const st=(v.vnum&&byVnum.get(v.vnum)) || byName.get(normalizarNomeVulcao(v.name));
            const m=vulcaoMergeReport(st?Object.assign({},st):{},v);
            m.elevated = !!(m.elevated || v.elevated || vulcaoElevado(m.aviationColor,m.alertLevel));
            if(st){
                if(st.vnum) byVnum.set(st.vnum,m);
                byName.set(normalizarNomeVulcao(st.name||v.name),m);
                merged.set(st.vnum?'v:'+st.vnum:'n:'+normalizarNomeVulcao(st.name||v.name),m);
            }else{
                const id=v.vnum?'v:'+v.vnum:'n:'+normalizarNomeVulcao(v.name);
                merged.set(id,m);
            }
        });

        // reports = todos (para enriquecimento GDACS) + elevatedOnly para lista
        const reports=[];
        const elevatedReports=[];
        const seen=new Set();
        [...merged.values()].forEach(r=>{
            const key=r.vnum?'v:'+r.vnum:'n:'+normalizarNomeVulcao(r.name);
            if(seen.has(key)) return;
            seen.add(key);
            if(!r.coords||!r.name) return;
            reports.push(r);
            if(r.elevated || vulcaoElevado(r.aviationColor,r.alertLevel) || r.usgsVona){
                elevatedReports.push(r);
            }
        });

        window.__usgsVolcanoReports=reports;
        window.__usgsVolcanoElevated=elevatedReports;
        window.__lastVolcanoUsgsError=null;
        setSource('USGS-Volcano','ok',performance.now()-t);
        try{
            if(elevatedReports.length && !window.__usgsVolcanoToastOnce){
                window.__usgsVolcanoToastOnce=true;
                if(typeof showToast==='function'){
                    showToast(`🌋 USGS: ${elevatedReports.length} vulcão(ões) elevado(s)/VONA`, 'info');
                }
            }
        }catch(_){}
        return {all:reports, elevated:elevatedReports};
    }catch(e){
        console.warn('USGS vulcanismo:',e?.message||e);
        try{ setSource('USGS-Volcano','off',null,e?.message||'falha'); }catch(_){}
        try{
            if(typeof showToast==='function' && !window.__usgsVolcanoFailToastOnce){
                window.__usgsVolcanoFailToastOnce = true;
                const origin = (typeof location !== 'undefined' && location.protocol) ? location.protocol : '';
                const isLocal = origin === 'file:' || origin === 'content:' || /content:/i.test(String(location && location.href || ''));
                if (isLocal) {
                    showToast('USGS vulcões: abra pelo link online (não pelo arquivo local).', 'warn');
                } else {
                    showToast('USGS vulcões temporariamente indisponível (Worker/API). GDACS segue ativo.', 'warn');
                }
            }
        }catch(_){}
        window.__lastVolcanoUsgsError = e?.message||String(e);
        window.__usgsVolcanoReports=[];
        window.__usgsVolcanoElevated=[];
        return {all:[], elevated:[]};
    }
}
function enriquecerVulcaoComUSGS(obj,reports){
    if(!obj||!Array.isArray(reports)) return obj;
    let hit=null,hitDist=Infinity;
    for(const r of reports){
        let score=Infinity;
        if(obj.usgsVnum&&r.vnum&&String(obj.usgsVnum)===String(r.vnum)) score=0;
        else if(obj.vnum&&r.vnum&&String(obj.vnum)===String(r.vnum)) score=0;
        else if(vulcaoNomeIgual(obj.place,r.name)) score=10;
        else if(obj.coords&&r.coords) {
            const d=haversine(obj.coords[1],obj.coords[0],r.coords[1],r.coords[0]);
            if(d<80) score=20+d;
        }
        if(score<hitDist){hit=r;hitDist=score;}
    }
    if(!hit) return obj;
    obj.usgsVona=hit.usgsVona||obj.usgsVona||null;
    obj.usgsStatus=hit.usgsStatus||obj.usgsStatus||null;
    obj.aviationColor=hit.aviationColor||obj.aviationColor||'';
    obj.usgsAlertLevel=hit.alertLevel||obj.usgsAlertLevel||'';
    obj.observatory=hit.observatory||obj.observatory||'';
    obj.usgsVnum=hit.vnum||obj.usgsVnum||'';
    obj.vulcanicActivity=hit.detail||obj.vulcanicActivity||'';
    obj.activityStatus=hit.ashStatus||obj.activityStatus||'';
    obj.ashHeight=hit.ashHeight||obj.ashHeight||'';
    obj.ashSource=hit.ashSource||obj.ashSource||'';
    obj.vonaRemarks=hit.vonaRemarks||obj.vonaRemarks||'';
    obj.vonaMovement=hit.vonaMovement||obj.vonaMovement||'';
    obj.vonaDuration=hit.vonaDuration||obj.vonaDuration||'';
    obj.noticeId=hit.noticeId||obj.noticeId||'';
    obj.usgsVonaUrl=hit.usgsUrl||obj.usgsVonaUrl||'';
    obj.usgsVolcanoUrl=hit.volcanoUrl||obj.usgsVolcanoUrl||'';
    if(!obj.eruptionStatus && hit.eruptionStatus) obj.eruptionStatus=hit.eruptionStatus;
    if(!obj.eruptionStart && hit.eruptionStart) obj.eruptionStart=hit.eruptionStart;
    if(!obj.lastActivity && hit.lastActivity) obj.lastActivity=hit.lastActivity;
    if(hit.time && (!obj.time || Number(hit.time)>Number(obj.time))) obj.time=hit.time;
    obj.sources=[...(obj.sources||[]),'USGS VHP'];
    if(hit.usgsVona) obj.sources.push('USGS VONA');
    obj.sources=[...new Set(obj.sources.map(String))];
    obj.sourceSummary=obj.sources.join(' · ');
    return obj;
}
async function fetchGlobalVolcanoAdvisories(){
    // Rota do Worker /global-volcano: VAAC Darwin + VAAC Tokyo (cinzas vulcânicas).
    // Cobre vulcões fora do escopo do USGS (só EUA) e que o GDACS às vezes não lista
    // (ex.: Sakurajima, muito ativo mas "rotina" pro critério de risco do GDACS).
    const t=performance.now();
    try{
        const base=workerBaseUrl();
        const urls=[base+'/global-volcano?t='+Date.now(), base+'/global-volcano'];
        for(const u of urls){
            try{
                const r=await fetch(u,{cache:'no-store',mode:'cors'});
                if(!r.ok) continue;
                const j=await r.json();
                if(j && Array.isArray(j.items)){
                    setSource('VAAC-Global','ok',performance.now()-t);
                    return j.items;
                }
            }catch(e){ console.warn('global-volcano try:', e?.message||e); }
        }
        throw new Error('VAAC global indisponível');
    }catch(e){
        console.warn('VAAC global:', e?.message||e);
        try{ setSource('VAAC-Global','off',null,e?.message||'falha'); }catch(_){}
        return [];
    }
}
async function fetchVolcanoes(){
    window.__lastVolcanoAttempt = Date.now();
    try{
        const [feats,usgsPack,vaacItems]=await Promise.all([
            fetchGdacsEvents('VO').catch(e=>{ console.warn('GDACS VO:',e); window.__lastVolcanoGdacsError=e?.message||String(e); return []; }),
            fetchUSGSVolcanoProfessional(),
            fetchGlobalVolcanoAdvisories()
        ]);
        window.__gdacsVoCount = (feats||[]).length;
        const usgsAll = Array.isArray(usgsPack) ? usgsPack : (usgsPack?.all || []);
        let usgsElev = Array.isArray(usgsPack) ? [] : (usgsPack?.elevated || []);
        if (!usgsElev.length && usgsAll.length) {
          usgsElev = usgsAll.filter(r => {
            const c=String(r.aviationColor||'').toLowerCase();
            const a=String(r.alertLevel||'').toUpperCase();
            return r.elevated || /^(orange|red)$/.test(c) || /^(WATCH|WARNING)$/.test(a) || r.usgsVona;
          });
        }
        usgsElev = (usgsElev||[]).filter(r => r && r.name && Array.isArray(r.coords) && r.coords.length>=2
          && Number.isFinite(Number(r.coords[0])) && Number.isFinite(Number(r.coords[1])));
        const vaacUsaveis = (vaacItems||[]).filter(v => v && v.name && Array.isArray(v.coords)
          && Number.isFinite(Number(v.coords[0])) && Number.isFinite(Number(v.coords[1])));
        try { console.info('[vulcanismo] GDACS VO:', (feats||[]).length, '| USGS all:', usgsAll.length, '| USGS elevados/VONA:', usgsElev.length, '| VAAC:', vaacUsaveis.length); } catch(_){}
        try {
          if (usgsElev.length && typeof showToast==='function' && !window.__usgsElevListToast) {
            window.__usgsElevListToast = true;
            showToast('🌋 '+usgsElev.length+' vulcão(ões) USGS na lista','info');
          }
        } catch(_){}
        const ids=new Set(); let primeiroNovo=null;

        // 1) Eventos GDACS VO (cobertura global) + enriquecimento USGS
        (feats||[]).forEach(f=>{
            const p=f.properties||{},g=f.geometry||{};
            if(g.type!=='Point'||!Array.isArray(g.coordinates)) return;
            const [lng,lat]=g.coordinates;
            if(isNaN(lat)||isNaN(lng)) return;
            const cur=p.iscurrent===undefined||p.iscurrent==='true'||p.iscurrent===true;
            const toTs=Date.parse(p.todate||p.fromdate||'');
            const recente=Number.isFinite(toTs) && (Date.now()-toTs)<21*864e5;
            if(!cur && !recente) return;
            const id=`gdacs-vo-${p.eventid||lat+'-'+lng}`;
            ids.add(id);
            const nome=p.name||p.country||'Vulcão não identificado';
            const infoT=(typeof traduzirEIdentificar==='function')?traduzirEIdentificar(nome):{bandeira:'',pais:''};
            const prev=globalAlerts.find(a=>a.id===id);
            const obj={
                id,type:'volcano',place:nome,bandeira:infoT.bandeira||getFlagByCoords(lat,lng),pais:infoT.pais,
                time:prev?prev.time:Date.now(),coords:[lng,lat],source:'GDACS',sources:['GDACS'],
                sourceSummary:'GDACS',gdacsAlertLevel:String(p.alertlevel||'').toLowerCase(),gdacsAlert:p.alertlevel||'',
                detail:`Alerta ${p.alertlevel||'N/D'}`,
                eruptionStatus:vulcaoPick(p,['status','eventstatus','eruptionstatus'],''),
                eruptionStart:vulcaoPick(p,['fromdate','startdate','eruptionstart'],''),
                lastActivity:vulcaoPick(p,['todate','lastactivity'],''),
                ashStatus:vulcaoPick(p,['ash','ashcloud','ashplume','description'],''),
                vei:vulcaoPick(p,['vei','VEI'],null),
                link:(p.url&&p.url.report)?p.url.report:(p.url||'#')
            };
            enriquecerVulcaoComUSGS(obj,usgsAll);
            const isNew=upsertAlert(obj,{fonte:'volcanoGdacs'});
            if(isNew){
                primeiroNovo=primeiroNovo||obj;
                try{ playAlertTone('volcano'); }catch(_){}
                try{ showToast(`🌋 Vulcanismo: ${nome}`,'warning'); }catch(_){}
                try{ notificarNavegador(`🌋 Vulcanismo — ${nome}`,`GDACS${obj.aviationColor?' · VONA '+obj.aviationColor.toUpperCase():''}`); }catch(_){}
            } else if (activeUpdatedIds.has(id)) {
                try{ showToast(`🔄 Vulcão atualizado: ${nome}${obj._deltaTxt?' · '+obj._deltaTxt:''}`,'info'); }catch(_){}
            }
        });

        // 2) Vulcões USGS elevados / com VONA (mesmo sem GDACS)
        (usgsElev||[]).forEach(r=>{
            if(!r.coords||!Number.isFinite(r.coords[0])||!Number.isFinite(r.coords[1])) return;
            const existing=globalAlerts.find(a=>a.type==='volcano'&&(
                (r.vnum&&a.usgsVnum&&String(r.vnum)===String(a.usgsVnum))||
                vulcaoNomeIgual(a.place,r.name)||
                (a.coords&&haversine(a.coords[1],a.coords[0],r.coords[1],r.coords[0])<80)
            ));
            if(existing){ enriquecerVulcaoComUSGS(existing,[r]); return; }
            const id=`usgs-volcano-${r.vnum||String(r.name||'').replace(/[^a-z0-9]+/gi,'-')}`;
            ids.add(id);
            const ct=(typeof getCountryByCoords==='function')?getCountryByCoords(r.coords[1],r.coords[0]):{flag:'🇺🇸',nome:'EUA'};
            const obj={
                id,type:'volcano',place:r.name,bandeira:ct.flag||'🇺🇸',pais:ct.nome||'',
                time:r.time||Date.now(),coords:r.coords,source:'USGS VHP',sources:(r.usgsVona?['USGS VHP','USGS VONA']:['USGS VHP']),
                sourceSummary:r.usgsVona?'USGS VHP · USGS VONA':'USGS VHP',
                usgsVona:r.usgsVona||null,usgsStatus:r.usgsStatus||null,
                usgsVnum:r.vnum,aviationColor:r.aviationColor,usgsAlertLevel:r.alertLevel,
                observatory:r.observatory,vulcanicActivity:r.detail,activityStatus:r.ashStatus,
                ashHeight:r.ashHeight,ashSource:r.ashSource,vonaRemarks:r.vonaRemarks,
                vonaMovement:r.vonaMovement,vonaDuration:r.vonaDuration,noticeId:r.noticeId,
                usgsVonaUrl:r.usgsUrl,usgsVolcanoUrl:r.volcanoUrl,
                eruptionStatus:r.eruptionStatus||'Atividade monitorada',
                eruptionStart:r.eruptionStart||'',lastActivity:r.lastActivity||'',
                vei:r.veI||null,detail:r.detail||'Status do USGS Volcano Hazards Program',
                link:r.usgsUrl||r.volcanoUrl||'https://volcanoes.usgs.gov/'
            };
            const isNew=upsertAlert(obj,{fonte:'volcanoUsgs',skipRemove:true});
            if(isNew){
                primeiroNovo=primeiroNovo||obj;
                try{ playAlertTone('volcano'); }catch(_){}
                try{ showToast(`🌋 USGS: ${r.name}${r.aviationColor?' · '+r.aviationColor.toUpperCase():''}`,'warning'); }catch(_){}
            } else if (activeUpdatedIds.has(id)) {
                try{ showToast(`🔄 USGS atualizado: ${r.name}${obj._deltaTxt?' · '+obj._deltaTxt:''}`,'info'); }catch(_){}
            }
        });

        // 3) VAAC Darwin/Tokyo — cinzas vulcânicas fora do escopo GDACS/USGS
        // (ex.: Sakurajima, Japão: fora do USGS e o GDACS costuma não listar
        // a atividade "de rotina" dele; o VAAC Tokyo sempre reporta explosões).
        vaacUsaveis.forEach(v=>{
            const [lng,lat]=v.coords;
            const existing=globalAlerts.find(a=>a.type==='volcano'&&(
                vulcaoNomeIgual(a.place,v.name)||
                (a.coords&&haversine(a.coords[1],a.coords[0],lat,lng)<80)
            ));
            if(existing){
                existing.sources=[...new Set([...(existing.sources||[]),v.source])];
                existing.sourceSummary=existing.sources.join(' · ');
                if(!existing.ashStatus && v.ashStatus) existing.ashStatus=v.ashStatus;
                if(v.time && (!existing.time||Number(v.time)>Number(existing.time))) existing.time=v.time;
                ids.add(existing.id);
                return;
            }
            const id=`vaac-${String(v.name||'volcano').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
            ids.add(id);
            const ct=(typeof getCountryByCoords==='function')?getCountryByCoords(lat,lng):{flag:'',nome:''};
            const infoT=(typeof traduzirEIdentificar==='function')?traduzirEIdentificar(v.name):{bandeira:'',pais:''};
            const obj={
                id,type:'volcano',place:v.name,bandeira:infoT.bandeira||ct.flag||getFlagByCoords(lat,lng),pais:infoT.pais||ct.nome||'',
                time:v.time||Date.now(),coords:[lng,lat],source:v.source,sources:[v.source],
                sourceSummary:v.source,
                aviationColor:v.aviationColor||'',usgsAlertLevel:v.alertLevel||'',
                vulcanicActivity:v.detail,activityStatus:v.ashStatus,ashStatus:v.ashStatus,
                eruptionStatus:v.detail||'Aviso de cinzas vulcânicas',
                detail:v.detail||'Aviso de cinzas vulcânicas',
                vei:null,link:/tokyo/i.test(v.source||'')?'https://www.data.jma.go.jp/vaac/data/vaac_list.html':'https://www.bom.gov.au/products/Volc_ash_latest.shtml'
            };
            const isNew=upsertAlert(obj,{fonte:'volcanoVaac',skipRemove:true});
            if(isNew){
                primeiroNovo=primeiroNovo||obj;
                try{ playAlertTone('volcano'); }catch(_){}
                try{ showToast(`🌋 ${v.source}: ${v.name}`,'warning'); }catch(_){}
                try{ notificarNavegador(`🌋 Vulcanismo — ${v.name}`,v.source); }catch(_){}
            } else if (activeUpdatedIds.has(id)) {
                try{ showToast(`🔄 ${v.source} atualizado: ${v.name}`,'info'); }catch(_){}
            }
        });

        // Mantém GDACS atuais + qualquer vulcão USGS (elevado/VONA) + VAAC/EONET globais
        globalAlerts=globalAlerts.filter(a=>{
            if(a.type!=='volcano') return true;
            if(/VAAC|EONET|NASA/i.test(String(a.source||'')) || (a.sources||[]).some(s=>/VAAC|EONET|NASA/i.test(String(s)))) return true;
            if(a.source==='GDACS') return ids.has(a.id) || (a.sources||[]).includes('USGS VHP');
            if(a.source==='USGS VHP' || (a.sources||[]).includes('USGS VHP')) return true;
            return ids.has(a.id);
        });
        globalAlerts.filter(a=>a.type==='volcano').forEach(a=>{ try{ a.confidence=consolidarConfianca(a);}catch(_){} });
        marcarBooted('volcanoGdacs');
        marcarBooted('volcanoUsgs');
        marcarBooted('volcanoVaac');
        window.__lastVolcanoSuccess = Date.now();
        window.__lastVolcanoError = null;
        applyFilters();
        if(primeiroNovo) showAlertDetails(primeiroNovo,true);
    }catch(e){ window.__lastVolcanoError = e?.message||String(e); console.error('Vulcanismo profissional:',e); }
}

