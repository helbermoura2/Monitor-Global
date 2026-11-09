/** TV Brent front-month futures (BZ=F), read-only and safely suppressible.
 * Uses ICE Futures Europe regular London session to gate all access.
 * The Yahoo chart provides indicative USD/barrel quotes, not an ICE live feed.
 * No stale closing price is ever relabeled as an intraday quote.
 */
const TYPE='tv-brent-v1',MIN=60000;
const hdr=(maxAge=60)=>({
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':'*',
 'Cache-Control':'public, max-age='+maxAge+', s-maxage='+maxAge
});
const reply=(data,maxAge=60,status=200)=>Response.json({version:TYPE,...data},{status,headers:hdr(maxAge)});
export function londonSession(now=Date.now()){
 if(!Number.isFinite(now)||now<=0)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const day=parts.find(p=>p.type==='weekday')?.value;
 const hour=Number(parts.find(p=>p.type==='hour')?.value);
 if(!Number.isInteger(hour))return false;
 // Official product 219: Sunday reopens 23:00 London local.
 if(day==='Sun')return hour>=23;
 if(day==='Sat')return false;
 if(!['Mon','Tue','Wed','Thu','Fri'].includes(day))return false;
 // Regular electronic session 01:00–23:00 London time. Daily break is hidden.
 return hour>=1&&hour<23;
}
const validPrice=value=>typeof value==='number'&&Number.isFinite(value)&&value>=5&&value<=400;
export function parseBrentQuote(input,now=Date.now()){
 const result=input?.chart?.result;
 if(!Array.isArray(result)||result.length!==1||input?.chart?.error)return null;
 const data=result[0],meta=data?.meta||{};
 if(meta.symbol!=='BZ=F'||meta.currency!=='USD')return null;
 if(meta.marketState&&['CLOSED','POST','PRE','PREPRE','POSTPOST'].includes(meta.marketState))return null;
 // Only published provider event times are trusted. Never substitute request time.
 const fresh=at=>Number.isSafeInteger(at)&&at>0&&at<=now+2*MIN&&now-at<=75*MIN;
 const stamp=Number(meta.regularMarketTime);
 const marketAt=Number.isSafeInteger(stamp)&&stamp>0?stamp*1000:0;
 let price=null,at=0,kind='';
 if(validPrice(meta.regularMarketPrice)&&fresh(marketAt)&&londonSession(marketAt)){
  price=meta.regularMarketPrice;at=marketAt;kind='regular-market';
 }else{
  // If Yahoo's headline quote is stale, the last REAL 1-minute candle may be
  // newer. Require a matching actual timestamp + numeric close at that index:
  // a bare recent timestamp cannot freshen an old headline price.
  const times=data?.timestamp,close=data?.indicators?.quote?.[0]?.close;
  if(Array.isArray(times)&&Array.isArray(close)&&times.length===close.length&&times.length>0&&times.length<=2000){
   for(let i=times.length-1;i>=0;i--){
    const t=Number(times[i]),c=close[i];
    const candleAt=Number.isSafeInteger(t)&&t>0?t*1000:0;
    if(fresh(candleAt)&&londonSession(candleAt)&&validPrice(c)){
     price=c;at=candleAt;kind='observed-minute-candle';break;
    }
   }
  }
 }
 if(price===null)return null;
 const previous=validPrice(meta.chartPreviousClose)?meta.chartPreviousClose:
  validPrice(meta.previousClose)?meta.previousClose:null;
 const change=previous===null?null:Math.round((price-previous)*100)/100;
 const percent=previous===null?null:Math.round((price-previous)/previous*10000)/100;
 if(percent!==null&&Math.abs(percent)>50)return null;
 return {ok:true,marketOpen:true,symbol:'BZ=F',currency:'USD',unit:'barril',price,
  previousClose:previous,change,percent,asOf:at,quoteKind:kind,source:'Yahoo Finance',
  delayed:true,disclaimer:'Cotação indicativa, sujeita a atraso; pode representar fechamento de candle de 1 min. Não é dado oficial em tempo real da ICE.'};
}
export async function handleTvBrent(request,env={},{
 now=Date.now(),get=fetch
}={}){
 const url=new URL(request.url);
 if(request.method!=='GET'||url.pathname!=='/tv-brent'||url.search){
  return reply({ok:false,marketOpen:false,reason:'invalid-request'},0,400);
 }
 if(!londonSession(now)){
  return reply({ok:false,marketOpen:false,reason:'market-closed',source:'ICE regular hours'},120);
 }
 const endpoints=[
  'https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d',
  'https://query2.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d'
 ];
 // Both endpoints expose the same Yahoo BZ=F instrument, not independent providers.
 // Keep both calls <10s in total, within the TV client's read timeout.
 let stale=false;
 for(const endpoint of endpoints){
  try{
   const r=await get(endpoint,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(4300),
    headers:{Accept:'application/json','User-Agent':'MonitorGlobalBrent/1.1'}
   });
   if(!r.ok||Number(r.headers.get('content-length'))>250000)continue;
   const raw=await r.text();
   if(raw.length>250000)continue;
   const parsed=parseBrentQuote(JSON.parse(raw),now);
   if(parsed)return reply(parsed,120);
   stale=true;
  }catch{ /* Try the other Yahoo hostname once; never fabricate a quote. */ }
 }
 return reply({ok:false,marketOpen:true,reason:stale?'source-stale-or-invalid':'source-unavailable'},30);
}
