// Public CGE bulletins, not the private SMS delivery channel. Never infer active flooding.
export const CGE_BULLETINS_URL='https://www.cgesp.org/v3/noticias.jsp';
export const CGE_BULLETIN_MAX_AGE_MS=6*3600000;
function text(value){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',atilde:'ã',otilde:'õ',ccedil:'ç',acirc:'â',ecirc:'ê',ocirc:'ô',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',Atilde:'Ã',Otilde:'Õ',Ccedil:'Ç'};
 return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(match,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return entities[e]??match;}).replace(/\s+/g,' ').trim();
}
function timeBrt(raw){
 const m=text(raw).match(/\b(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\b/);if(!m)return NaN;
 const [_,day,month,year,hour,minute]=m;const iso=`${year}-${month}-${day}T${hour}:${minute}:00-03:00`,ts=Date.parse(iso);
 const local=new Date(ts-3*3600000);if(!Number.isFinite(ts)||local.getUTCDate()!==+day||local.getUTCMonth()+1!==+month||local.getUTCHours()!==+hour)return NaN;
 return ts;
}
export function parseCgeBulletins(html,now=Date.now()){
 const blocks=String(html).split(/<div\b[^>]*class=["']noticia["'][^>]*>/i).slice(1);
 if(!blocks.length)throw Error('Formato dos boletins CGE não reconhecido');
 const items=[],seen=new Set();
 for(const block of blocks){
  const id=block.match(/href=["'](?:https:\/\/www\.cgesp\.org\/v3\/)?noticias\.jsp\?id=(\d+)["']/i)?.[1];
  const title=text(block.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const time=timeBrt(block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
  const article=block.split(/<div\b[^>]*class=["']barra-compartilhamento["']/i)[0];
  const paragraphs=[...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>text(m[1])).filter(Boolean);
  if(!id||seen.has(id)||!title||!paragraphs.length||!Number.isFinite(time))continue;seen.add(id);
  const fullText=paragraphs.join('\n\n');
  if(!/chuva|tempestade|raios|trovoada|rajadas|alagamento|frente fria/i.test(title+' '+fullText))continue;
  if(time>now+5*60000||now-time>CGE_BULLETIN_MAX_AGE_MS)continue;
  // Preserve the source's wording; forecasts and observations may coexist in one bulletin.
  const summary=paragraphs.find(p=>/radar.*(?:mostra|indica)|(?:zona|regi[aã]o).*(?:aten[cç][aã]o|alerta)/i.test(p))||paragraphs[0];
  items.push({sourceId:id,title,time,description:fullText.slice(0,16000),summary:summary.slice(0,400),link:'https://www.cgesp.org/v3/noticias.jsp?id='+id,displayUntil:time+CGE_BULLETIN_MAX_AGE_MS});
 }
 return items.sort((a,b)=>b.time-a.time).slice(0,1);
}
export async function handleCgeBulletins(fetcher=fetch,now=Date.now(),cache=globalThis.caches?.default){
 const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=120'};
 const cacheKey=new Request('https://black-sky-9ba0.terrestre.workers.dev/cge-bulletins');
 if(cache){try{const hit=await cache.match(cacheKey);if(hit)return hit;}catch(e){}}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetcher(CGE_BULLETINS_URL,{signal:controller.signal,headers:{'User-Agent':'MonitorGlobal/1.0 (+https://monitorglobal.top)','Accept':'text/html'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const html=await r.text();if(html.length>1500000)throw Error('Página excede o limite');
  const items=parseCgeBulletins(html,now);
  const response=Response.json({ok:true,source:'CGE — Prefeitura de São Paulo',consultedAt:now,items},{headers});
  if(cache){try{await cache.put(cacheKey,response.clone());}catch(e){}}
  return response;
 }catch(e){return Response.json({ok:false,source:'CGE — Prefeitura de São Paulo',error:'Boletins indisponíveis',consultedAt:now,items:[]},{status:502,headers:{...headers,'Cache-Control':'no-store'}});}
 finally{clearTimeout(timer);}
}
