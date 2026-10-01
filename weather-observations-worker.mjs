// Backup público de observações METAR, sem chave de API. Não gera previsão.
export async function handleWeatherObservations(url, fetcher=fetch) {
  const ids=(url.searchParams.get('ids')||'SBSP,SBGR,SBMT').split(',').map(x=>x.trim().toUpperCase());
  if(!ids.length || ids.length>12 || ids.some(x=>!/^S[BDSINW][A-Z]{2}$/.test(x)))return Response.json({error:'Estações brasileiras inválidas'},{status:400,headers:{'Access-Control-Allow-Origin':'*'}});
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  try{
    const r=await fetcher('https://aviationweather.gov/api/data/metar?ids='+ids.join(',')+'&format=json',{signal:c.signal});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();if(!Array.isArray(data))throw Error('Dados inválidos');
    const stations=data.filter(x=>ids.includes(x.icaoId) && typeof x.rawOb==='string' && Number.isFinite(x.obsTime) && Number.isFinite(x.lat) && Number.isFinite(x.lon)).map(x=>({icao:x.icaoId,lat:x.lat,lng:x.lon,raw:x.rawOb,updatedAt:x.obsTime*1000,source:'NOAA Aviation Weather Center'}));
    return Response.json({stations,source:'NOAA Aviation Weather Center'},{headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=120'}});
  }catch(e){return Response.json({error:'Observações METAR indisponíveis'},{status:502,headers:{'Access-Control-Allow-Origin':'*'}});}finally{clearTimeout(timer);}
}
