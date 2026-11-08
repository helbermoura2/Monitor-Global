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
 if(meta.symbol!=='BZ=F'||meta.currency!=='USD'||!validPrice(meta.regularMarketPrice))return null;
 if(meta.marketState&&['CLOSED','POST','PRE','PREPRE','POSTPOST'].includes(meta.marketState))return null;
 // A real provider timestamp is mandatory; do not fill it with 'now'.
 const stamp=Number(meta.regularMarketTime);
 // The displayed regularMarketPrice is associated with meta.regularMarketTime,
 // NOT the latest chart candle: a fresh candle must never refresh an old quote.
 const at=Number.isSafeInteger(stamp)&&stamp>0?stamp*1000:0;
 if(at<=0||at>now+2*MIN||now-at>75*MIN)return null;
 const price=meta.regularMarketPrice,previous=validPrice(meta.chartPreviousClose)?meta.chartPreviousClose:
  validPrice(meta.previousClose)?meta.previousClose:null;
 const change=previous===null?null:Math.round((price-previous)*100)/100;
 const percent=previous===null?null:Math.round((price-previous)/previous*10000)/100;
 if(percent!==null&&Math.abs(percent)>50)return null;
 return {ok:true,marketOpen:true,symbol:'BZ=F',currency:'USD',unit:'barril',price,
  previousClose:previous,change,percent,asOf:at,source:'Yahoo Finance',
  delayed:true,disclaimer:'Cotação indicativa, sujeita a atraso. Não é dado oficial em tempo real da ICE.'};
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
 const endpoint='https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d';
 try{
  const r=await get(endpoint,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(9000),
   headers:{Accept:'application/json','User-Agent':'MonitorGlobalBrent/1.0'}
  });
  if(!r.ok||Number(r.headers.get('content-length'))>250000)return reply({ok:false,marketOpen:true,reason:'source-unavailable'},30);
  const raw=await r.text();
  if(raw.length>250000)return reply({ok:false,marketOpen:true,reason:'oversized-response'},30);
  const parsed=parseBrentQuote(JSON.parse(raw),now);
  if(!parsed)return reply({ok:false,marketOpen:true,reason:'source-stale-or-invalid'},30);
  return reply(parsed,120);
 }catch{return reply({ok:false,marketOpen:true,reason:'source-unavailable'},30);}
}
