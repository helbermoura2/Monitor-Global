// Public ECCC OGC collection and BOM RSS subscriptions. No private BOM API.
export const BOM_FEEDS = [
  ['NSW-ACT','New South Wales / ACT','IDZ00054.warnings_nsw.xml'],
  ['VIC','Victoria','IDZ00059.warnings_vic.xml'],
  ['QLD','Queensland','IDZ00056.warnings_qld.xml'],
  ['WA','Western Australia','IDZ00060.warnings_wa.xml'],
  ['SA','South Australia','IDZ00057.warnings_sa.xml'],
  ['TAS','Tasmania','IDZ00058.warnings_tas.xml'],
  ['NT','Northern Territory','IDZ00055.warnings_nt.xml']
];
const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json; charset=utf-8'};
async function request(url,fetcher){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{const r=await fetcher(url,{signal:c.signal,headers:{Accept:'application/geo+json, application/xml, text/xml'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.text();}finally{clearTimeout(timer);}
}
export async function handleOfficialWeatherAlerts(url,fetcher=fetch,cache=globalThis.caches?.default){
  const provider=url.searchParams.get('provider');
  if(!['eccc','bom'].includes(provider))return Response.json({error:'Fonte inválida'},{status:400,headers});
  const key=new Request(url.origin+'/official-weather-alerts?provider='+provider);
  if(cache){const hit=await cache.match(key);if(hit)return hit;}
  try{
    let data;
    if(provider==='eccc'){
      let next='https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=500';const features=[],seen=new Set();
      for(let page=0;next&&page<4;page++){
        const u=new URL(next);if(u.protocol!=='https:'||u.hostname!=='api.weather.gc.ca'||u.pathname!=='/collections/weather-alerts/items'||seen.has(u.href))throw Error('Paginação ECCC inválida');seen.add(u.href);
        const d=JSON.parse(await request(u.href,fetcher));if(d.type!=='FeatureCollection'||!Array.isArray(d.features))throw Error('Catálogo ECCC inválido');
        features.push(...d.features);const link=d.links?.find(x=>x.rel==='next');next=link?new URL(link.href,u).href:null;
        if(!next&&Number.isFinite(d.numberMatched)&&d.numberMatched>features.length)throw Error('Catálogo ECCC incompleto');
      }
      if(next)throw Error('Catálogo ECCC excedeu o limite de páginas');
      data={provider,features,checkedAt:Date.now(),source:'Environment and Climate Change Canada',complete:true};
    }else{
      const feeds=await Promise.all(BOM_FEEDS.map(async([code,region,file])=>{
        try{const xml=await request('https://www.bom.gov.au/fwo/'+file,fetcher);if(!/<rss[\s>]/i.test(xml)||!/<channel[\s>]/i.test(xml)||!/Bureau of Meteorology/i.test(xml))throw Error('RSS BOM inválido');
          const builtAt=Date.parse(xml.match(/<lastBuildDate>\s*([^<]+)\s*<\/lastBuildDate>/i)?.[1]);
          if(!Number.isFinite(builtAt)||Date.now()-builtAt>30*60000||builtAt>Date.now()+300000)throw Error('RSS BOM sem atualização recente');
          return {code,region,xml,builtAt};}
        catch(e){return {code,region,error:e.message};}
      }));
      if(feeds.every(x=>x.error))throw Error('Nenhum feed BOM respondeu');
      data={provider,feeds,checkedAt:Date.now(),source:'Bureau of Meteorology, © Commonwealth of Australia',partial:feeds.some(x=>x.error)};
    }
    const response=new Response(JSON.stringify(data),{headers:{...headers,'Cache-Control':'public, max-age='+ (data.partial?60:provider==='bom'?600:300)}});
    if(cache)await cache.put(key,response.clone());return response;
  }catch(e){return Response.json({provider,error:e.message},{status:502,headers:{...headers,'Cache-Control':'no-store'}});}
}
