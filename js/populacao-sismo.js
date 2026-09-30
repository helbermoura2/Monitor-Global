// População cadastrada na área estimada de percepção. Não é contagem de vítimas,
// relatos humanos ou integração de população em grade (GHSL/WorldPop).
const GEONAMES_CITIES_URL='https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json';
const GEONAMES_CITIES_MIRROR='https://rawcdn.githack.com/lmfmaier/cities-json/aed0822519df832873f6cca8e05d5224c418e657/cities500.json';
let _lugaresPopulososCache=null,_lugaresPopulososInflight=null,_popRetryAfter=0;
const _popAreaCache=new Map(),_popAreaInflight=new Map();

function numeroPopulacao(value){
    const text=String(value==null?'':value).trim();
    if(!/^\d+(?:[ ,.]\d{3})*$/.test(text))return null;
    const n=Number(text.replace(/[ ,.]/g,''));
    return Number.isSafeInteger(n)&&n>0?n:null;
}
function normalizarLugarPop(p,source='GeoNames'){
    const latitude=p.lat,longitude=p.lon??p.lng;
    if(latitude==null||longitude==null||String(latitude).trim()===''||String(longitude).trim()==='')return null;
    const lat=Number(latitude),lng=Number(longitude),nome=String(p.name||p.nome||'').trim();
    if(!nome||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
    return {nome,lat,lng,pop:numeroPopulacao(p.pop??p.population),source,id:String(p.id||''),country:String(p.country||'')};
}
async function fetchPopJson(url,timeout=12000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}
    finally{clearTimeout(timer);}
}
// Cache persistente evita baixar o catálogo global em cada visita. Só salva dados válidos.
function cachePopPersistente(mode,value){
    return new Promise(resolve=>{
        if(typeof indexedDB==='undefined'){resolve(null);return;}
        let db,finished=false;
        const done=v=>{if(finished)return;finished=true;clearTimeout(timer);if(db)db.close();resolve(v);};
        const timer=setTimeout(()=>done(null),1500);
        try{
            const request=indexedDB.open('monitor-global-population',1);
            request.onupgradeneeded=()=>request.result.createObjectStore('catalog');
            request.onerror=()=>done(null);
            request.onsuccess=()=>{
                db=request.result;if(finished){db.close();return;}
                const tx=db.transaction('catalog',mode==='write'?'readwrite':'readonly');
                const op=mode==='write'?tx.objectStore('catalog').put({at:Date.now(),places:value},'geonames-v1'):tx.objectStore('catalog').get('geonames-v1');
                op.onsuccess=()=>{if(mode!=='write'){const data=op.result;done(data&&Date.now()-data.at<30*864e5&&Array.isArray(data.places)&&data.places.length?data.places:null);}};
                tx.oncomplete=()=>done(mode==='write'?true:null);tx.onerror=()=>done(null);
            };
        }catch(e){done(null);}
    });
}
function fetchLugaresPopulosos(){
    if(_lugaresPopulososCache)return Promise.resolve(_lugaresPopulososCache);
    if(_lugaresPopulososInflight)return _lugaresPopulososInflight;
    if(Date.now()<_popRetryAfter)return Promise.resolve(null);
    _lugaresPopulososInflight=(async()=>{
        const stored=await cachePopPersistente('read');
        if(stored){_lugaresPopulososCache=stored;return stored;}
        for(const url of [GEONAMES_CITIES_URL,GEONAMES_CITIES_MIRROR]){
            try{
                const data=await fetchPopJson(url);
                if(!Array.isArray(data))throw new Error('Catálogo inválido');
                const places=data.map(p=>normalizarLugarPop(p)).filter(Boolean);
                if(!places.length||!places.some(p=>p.pop))throw new Error('Catálogo sem população');
                _lugaresPopulososCache=places;void cachePopPersistente('write',places);return places;
            }catch(e){}
        }
        _popRetryAfter=Date.now()+60000;
        return null; // Falha de rede nunca se transforma em uma região sem moradores.
    })().finally(()=>{_lugaresPopulososInflight=null;});
    return _lugaresPopulososInflight;
}
function dedupePopulacao(places){
    const list=[],names=new Map(),ids=new Map();
    const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    places.forEach(p=>{
        const name=key(p.nome),id=p.id?p.source+':'+p.id:'';
        const old=(id&&ids.get(id))||(names.get(name)||[]).find(c=>haversine(c.lat,c.lng,p.lat,p.lng)<10);
        if(old){if(!old.pop&&p.pop){old.pop=p.pop;old.source=p.source;}return;}
        const copy={...p};list.push(copy);
        if(!names.has(name))names.set(name,[]);names.get(name).push(copy);
        if(id)ids.set(id,copy);
    });return list;
}
async function buscarPopulacaoOSM(lat,lng,radius){
    if(typeof fetchJsonComFallbackCidade!=='function')return null;
    // Apenas pontos de localidades: não soma polígonos administrativos e bairros
    // com suas cidades. O limite de raio/linhas é declarado como cobertura parcial.
    const meters=Math.ceil(Math.min(120,Math.max(1,radius))*1000);
    const query=`[out:json][timeout:8];node["place"~"^(city|town|village|hamlet)$"](around:${meters},${lat},${lng});out body 2000;`;
    const data=await fetchJsonComFallbackCidade('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query),5000);
    if(!data||!Array.isArray(data.elements))return null;
    return data.elements.filter(x=>/^(city|town|village|hamlet)$/.test(x.tags?.place||'')).map(x=>normalizarLugarPop({name:x.tags['name:pt']||x.tags.name,lat:x.lat,lon:x.lon,pop:x.tags.population,id:x.id},'OpenStreetMap')).filter(Boolean);
}
// Área de percepção potencial, distinta do raio instrumental detectável.
// As faixas são geográficas estimadas; não inventamos MMI por cidade.
function mmiPorDistancia(distance,mag,depth){
    const radius=raioEstimado(mag,depth),critical=Math.min(radius,raioCritico(mag,depth));
    if(distance<=critical)return{nivel:'Próxima · EST',cor:'#fb923c'};
    if(distance<=radius)return{nivel:'Percepção · EST',cor:'#facc15'};
    return null;
}
async function estimarPessoasAfetadas(lat,lng,mag,depth,maxC=8){
    lat=Number(lat);lng=Number(lng);mag=Number(mag);depth=Number(depth);
    if(![lat,lng,mag,depth].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('Coordenadas ou magnitude inválidas');
    const key=[lat.toFixed(4),lng.toFixed(4),mag,depth,maxC].join('|');
    const cached=_popAreaCache.get(key);if(cached&&Date.now()<cached.until)return cached.data;
    if(_popAreaInflight.has(key))return _popAreaInflight.get(key);
    const job=(async()=>{
        const radius=raioEstimado(mag,depth);
        let places=await fetchLugaresPopulosos(),hasCatalog=!!places;
        const inside=p=>haversine(lat,lng,p.lat,p.lng)<=radius;
        let partial=!hasCatalog;
        if(!places||!places.some(p=>p.pop&&inside(p))){
            const [osm,nearby]=await Promise.allSettled([
                buscarPopulacaoOSM(lat,lng,radius),
                typeof resolverCidadesProximas==='function'?resolverCidadesProximas(lat,lng,12):Promise.resolve(null)
            ]);
            const extra=[];
            if(osm.status==='fulfilled'&&osm.value)extra.push(...osm.value);
            if(nearby.status==='fulfilled'&&nearby.value){
                (nearby.value.cidades||[]).forEach(c=>{const p=normalizarLugarPop(c,nearby.value.reserva?'Base local':'OpenStreetMap');if(p)extra.push(p);});
            }
            if(typeof CIDADES_MUNDO!=='undefined')CIDADES_MUNDO.forEach(c=>{const p=normalizarLugarPop(c,'Base local');if(p&&inside(p))extra.push(p);});
            places=dedupePopulacao([...(places||[]).filter(inside),...extra.filter(inside)]);
            if(extra.some(inside))partial=true;
        }else{
            // Pré-filtro de latitude evita calcular distância para todo o catálogo.
            places=places.filter(p=>Math.abs(p.lat-lat)<=radius/110.5);
        }
        const all=dedupePopulacao(places).map(p=>({...p,distancia:haversine(lat,lng,p.lat,p.lng)}))
            .filter(p=>p.distancia<=radius).sort((a,b)=>a.distancia-b.distancia);
        const known=all.filter(p=>p.pop>0),missing=all.length-known.length;
        const status=known.length?'available':all.length?'population-missing':hasCatalog?'no-settlements':'unavailable';
        const data={totalPessoas:known.length?known.reduce((sum,p)=>sum+p.pop,0):null,cidades:all.slice(0,maxC).map(p=>({...p,mmi:mmiPorDistancia(p.distancia,mag,depth)})),status,partial,missingPopulation:missing,localidades:all.length,raioKm:radius,sources:[...new Set([...(hasCatalog?['GeoNames']:[]),...all.map(p=>p.source)])]};
        _popAreaCache.set(key,{until:Date.now()+(status==='available'?3600000:60000),data});
        if(_popAreaCache.size>80)_popAreaCache.delete(_popAreaCache.keys().next().value);
        return data;
    })();
    _popAreaInflight.set(key,job);try{return await job;}finally{_popAreaInflight.delete(key);}
}
function mensagemCoberturaPopulacao(data){
    if(data.status==='unavailable')return'Não foi possível carregar os dados populacionais. Isso não significa que a área esteja desabitada.';
    if(data.status==='population-missing')return'Localidades encontradas, mas suas populações não foram informadas pelas fontes consultadas.';
    if(data.status==='no-settlements')return'Nenhuma localidade cadastrada no raio estimado de percepção. Moradores rurais ou localidades ausentes da base podem não estar representados.';
    return'Soma aproximada das populações cadastradas dentro de ~'+Math.round(data.raioKm)+' km. '+(data.partial?'Cobertura parcial; ':'')+(data.missingPopulation?data.missingPopulation+' localidade(s) sem população. ':'')+'Não é contagem de quem sentiu o tremor nem de pessoas feridas. Não inclui toda a população rural; limites das cidades podem ultrapassar o raio.';
}
function creditoPopulacaoHTML(data){
    const sources=data.sources||[];
    return '<div class="pd-flip-verso-credito">Fontes utilizadas: '+(sources.map(escPopup).join(' · ')||'nenhuma disponível')+
        (sources.includes('GeoNames')?' · <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames (CC BY 4.0)</a>':'')+
        (sources.includes('OpenStreetMap')?' · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap (ODbL)</a>':'')+'</div>';
}
function renderAlcancePopulacaoHTML(data){
    const headline=data.totalPessoas!=null?'~'+formatarPessoasHeadline(data.totalPessoas)+' moradores nas localidades cadastradas':'População sem dados suficientes';
    return '<div class="city-item"><span class="city-name">👥 '+headline+' <span class="estimativa-badge">EST'+(data.partial?' · PARCIAL':'')+'</span></span></div>'+
        '<div class="city-item" style="font-size:10px;line-height:1.5">'+escPopup(mensagemCoberturaPopulacao(data))+'</div>'+
        data.cidades.map(linhaCidadePopup).join('')+creditoPopulacaoHTML(data);
}

// "k"/"M" são abreviações comuns em apps técnicos, mas nem todo mundo
// reconhece na hora — escreve por extenso ("mil"/"milhão(ões)") pra não
// exigir essa tradução mental de quem está vendo.
function formatarPessoasHeadline(n) {
    if (n >= 1e6) {
        const milhoes = n / 1e6;
        return milhoes.toFixed(1).replace('.', ',') + (milhoes < 1.05 ? ' milhão' : ' milhões');
    }
    if (n >= 1e3) return Math.round(n / 1e3) + ' mil';
    return String(Math.round(n));
}

function escPopup(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function linhaCidadePopup(c) {
    const mmiHtml = c.mmi
        ? `<span class="pd-flip-verso-mmi" style="color:${c.mmi.cor};background:${c.mmi.cor}22;border-color:${c.mmi.cor}55;">${c.mmi.nivel}</span>`
        : '';
    return `<div class="pd-flip-verso-cidade">
        <span class="pd-flip-verso-cidade-nome">🏙️ ${escPopup(c.nome)}</span>
        <span class="pd-flip-verso-cidade-dist">${Math.round(c.distancia)} km</span>
        <span class="pd-flip-verso-cidade-pop">${c.pop ? formatarPopulacao(c.pop) : 'Pop. não informada'}</span>
        ${mmiHtml}
    </div>`;
}

// Timers/estado da "virada" do card principal — só uma por vez, guardado em
// window pra sobreviver a qualquer re-execução acidental do script e pra
// outras funções (troca de evento) conseguirem cancelar de fora.
function fecharViradaCardAlcance() {
    window.__mgFlipPopulationGeneration=(window.__mgFlipPopulationGeneration||0)+1;
    try { clearTimeout(window.__mgFlipAbrirT); } catch (e) {}
    try { clearTimeout(window.__mgFlipFecharT); } catch (e) {}
    try { clearTimeout(window.__mgFlipRemoveT); } catch (e) {}
    try { window.removeEventListener('resize', window.__mgFlipReposiciona); } catch (e) {}
    window.__mgFlipAbrirT = null;
    window.__mgFlipFecharT = null;
    window.__mgFlipRemoveT = null;
    const painel = document.getElementById('painel-direito');
    if (painel) painel.classList.remove('pd-flip-girado', 'pd-flip-preparado');
    const verso = document.getElementById('pd-flip-verso');
    if (verso) { try { verso.remove(); } catch (e) {} }
}

// Cobre o verso exatamente sobre #painel-direito — recalcula a cada abertura
// (não fixo em CSS) porque #painel-direito muda de posição/tamanho entre os
// estados mobile (colapsado/mid/aberto) e entre breakpoints.
function posicionarVersoCard(verso) {
    const painel = document.getElementById('painel-direito');
    const r = painel ? painel.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) return;
    verso.style.top = r.top + 'px';
    verso.style.left = r.left + 'px';
    verso.style.width = r.width + 'px';
    verso.style.height = r.height + 'px';
}

// Agenda a "virada" do card principal (como uma carta de baralho) pra
// mostrar o alcance do sismo (cidades + MMI + total de pessoas): o tremor de
// entrada (pdQuakeShake, 7s, ver painel-fx.js) acontece normal, 7s depois
// disso (14s desde a seleção) o card vira mostrando o verso, e 12s depois
// (26s desde a seleção) vira de volta pra frente e fica assim — bem menos
// que o tempo total em tela do evento (pedido do usuário: substituir o
// antigo pop-up/slidebar por essa animação no próprio card). A MESMA
// informação já fica disponível de forma permanente em #pd-cities/
// #pd-alcance ("Mais detalhes"), então a virada é só um destaque temporário.
// Busca os dados desde já (t=0) pra já estarem prontos quando a virada
// acontecer aos 14s. Só ao vivo e clique manual chamam isto — nunca o ciclo
// automático (mesmo padrão já usado pra frente de onda P/S: o auto-ciclo
// troca de evento rápido demais pra essa animação fazer sentido).
function agendarViradaCardAlcance(lat, lng, item) {
    fecharViradaCardAlcance();
    const generation=window.__mgFlipPopulationGeneration;
    const dadosPromise = estimarPessoasAfetadas(lat, lng, item.mag, item.depth).catch(() => null);

    window.__mgFlipAbrirT = setTimeout(async () => {
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
        const painel = document.getElementById('painel-direito');
        if (!painel) return;
        const dados = await dadosPromise;
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return; // trocou de evento enquanto buscava
        if (!dados || generation!==window.__mgFlipPopulationGeneration) return;

        // Sempre vira o card pra TODO evento novo (ao vivo/manual) — mesmo
        // sem nenhuma cidade cadastrada no alcance (área muito remota —
        // oceano aberto, deserto etc.), com uma mensagem explicando em vez
        // de simplesmente não virar nada.
        const exposure=typeof exposicaoPopulacionalDoEvento==='function'?exposicaoPopulacionalDoEvento(item):null;
        const headlinePopulation=exposure?Number(exposure.ranges[0].population):dados.totalPessoas;
        const semDados = headlinePopulation == null;
        const corpo = `<div id="pd-flip-grid-exposure">${exposure?renderExposicaoPopulacionalHTML(exposure):''}</div><div class="pd-flip-verso-vazio">${escPopup(mensagemCoberturaPopulacao(dados))}</div>` +
            (dados.cidades.length ? `<div class="pd-flip-verso-list"><div class="pd-flip-verso-listhead"><span>Localidade / distância / população</span><span>Área estimada</span></div>${dados.cidades.map(linhaCidadePopup).join('')}</div>` : '') + creditoPopulacaoHTML(dados);

        const verso = document.createElement('div');
        verso.id = 'pd-flip-verso';
        verso.className = 'pd-flip-verso';
        verso.innerHTML = `
            <div class="pd-flip-verso-head">
                <span class="pd-flip-verso-tag">🌍 ALCANCE DO SISMO</span>
            </div>
            <div class="pd-flip-verso-headline">
                <span class="pd-flip-verso-num">${semDados ? '—' : '~'+formatarPessoasHeadline(headlinePopulation)}</span>
                <span class="pd-flip-verso-sub">${semDados ? 'população sem dados suficientes' : exposure ? 'população em área de tremor fraco ou maior · EST' : 'moradores nas localidades da área estimada'}</span>
            </div>
            ${corpo}`;
        posicionarVersoCard(verso);
        document.body.appendChild(verso);
        // Reposiciona se a janela mudar de tamanho/orientação enquanto o
        // verso está visível (ex.: girar o celular).
        window.__mgFlipReposiciona = () => posicionarVersoCard(verso);
        window.addEventListener('resize', window.__mgFlipReposiciona);

        painel.classList.add('pd-flip-preparado');
        void painel.offsetWidth; // força reflow pra garantir a transição
        requestAnimationFrame(() => requestAnimationFrame(() => {
            painel.classList.add('pd-flip-girado');
            verso.classList.add('pd-flip-visivel');
        }));

        window.__mgFlipFecharT = setTimeout(() => {
            if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
            painel.classList.remove('pd-flip-girado');
            verso.classList.remove('pd-flip-visivel');
            try { window.removeEventListener('resize', window.__mgFlipReposiciona); } catch (e) {}
            window.__mgFlipRemoveT = setTimeout(() => {
                try { verso.remove(); } catch (e) {}
                painel.classList.remove('pd-flip-preparado');
            }, 750);
        }, 12000);
    }, 14000);
}

