/** TV Brent front-month futures (BZ=F), read-only and safely suppressible.
 * Uses the NYMEX/CME Globex BZ session; never substitutes ICE product hours.
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
function nyParts(now){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));}
export function brentSession(now=Date.now()){
 if(!Number.isFinite(now)||now<=0)return false;const p=nyParts(now),h=Number(p.hour);
 if(p.weekday==='Sat'||p.weekday==='Sun'&&h<18||p.weekday==='Fri'&&h>=17)return false;
 return p.weekday==='Sun'||h<17||h>=18;
}
// Compatibility for existing importers; this is the BZ=F NYMEX session now.
export const londonSession=brentSession;
function sessionId(now){const p=nyParts(now);return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(Number(p.hour)>=18?1:0));}
function providerState(meta,now){
 const states={REGULAR:'OPEN',OPEN:'OPEN',CLOSED:'CLOSED',PRE:'CLOSED',POST:'CLOSED',PREPRE:'CLOSED',POSTPOST:'CLOSED',HALTED:'PAUSED',PAUSED:'PAUSED'},raw=typeof meta.marketState==='string'?meta.marketState.toUpperCase():'';
 const period=meta.currentTradingPeriod?.regular,start=Number(period?.start)*1000,end=Number(period?.end)*1000,at=Number(meta.regularMarketTime)*1000;
 const valid=Number.isSafeInteger(start)&&start>0&&Number.isSafeInteger(end)&&end>start&&end-start<=48*3600000&&Math.abs(now-start)<=5*86400000;
 if(raw)return {state:states[raw]||'UNKNOWN',end:valid&&end>now?end:0,basis:'Estado informado pelo Yahoo Finance'};
 if(valid){if(start<=now&&now<end)return {state:'OPEN',end,basis:'Sessão informada pelo Yahoo Finance'};if(now>=end&&at>=start&&at<=end||now<start&&at>0&&at<start)return {state:'CLOSED',end:0,basis:'Fora da sessão informada pelo Yahoo Finance'};}
 return {state:'OPEN',end:0,basis:'Sessão regular NYMEX/CME'};
}
const validPrice=value=>typeof value==='number'&&Number.isFinite(value)&&value>=5&&value<=400;
export function parseBrentQuote(input,now=Date.now()){
 const result=input?.chart?.result;
 if(!Array.isArray(result)||result.length!==1||input?.chart?.error)return null;
 const data=result[0],meta=data?.meta||{};
 if(meta.symbol!=='BZ=F'||meta.currency!=='USD'||!brentSession(now))return null;
 const state=providerState(meta,now);if(['CLOSED','PAUSED'].includes(state.state))return null;
 if(meta.marketState&&['CLOSED','POST','PRE','PREPRE','POSTPOST'].includes(meta.marketState))return null;
 // Only published provider event times are trusted. Never substitute request time.
 const fresh=at=>Number.isSafeInteger(at)&&at>0&&at<=now+2*MIN&&now-at<=75*MIN;
 const stamp=Number(meta.regularMarketTime);
 const marketAt=Number.isSafeInteger(stamp)&&stamp>0?stamp*1000:0;
 let price=null,at=0,kind='';
 if(validPrice(meta.regularMarketPrice)&&fresh(marketAt)&&brentSession(marketAt)&&sessionId(marketAt)===sessionId(now)){
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
    if(fresh(candleAt)&&brentSession(candleAt)&&sessionId(candleAt)===sessionId(now)&&validPrice(c)){
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
 return {ok:true,marketOpen:true,marketState:state.state,sessionBasis:state.basis,sessionEnd:state.end,checkedAt:now,exchange:'NYMEX',symbol:'BZ=F',currency:'USD',unit:'barril',price,
  previousClose:previous,change,percent,asOf:at,quoteKind:kind,source:'Yahoo Finance',
  delayed:true,disclaimer:'Cotação indicativa, sujeita a atraso; pode representar fechamento de candle de 1 min. Não é dado oficial em tempo real da NYMEX/CME.'};
}
export async function handleTvBrent(request,env={},{
 now=Date.now(),get=fetch
}={}){
 const url=new URL(request.url);
 if(request.method!=='GET'||url.pathname!=='/tv-brent'||url.search){
  return reply({ok:false,marketOpen:false,reason:'invalid-request'},0,400);
 }
 if(!brentSession(now)){
  const p=nyParts(now),pause=['Mon','Tue','Wed','Thu'].includes(p.weekday)&&Number(p.hour)===17;
  return reply({ok:false,marketOpen:false,symbol:'BZ=F',marketState:pause?'PAUSED':'CLOSED',checkedAt:now,reason:'market-closed',source:'NYMEX/CME regular hours'},120);
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
   const input=JSON.parse(raw),meta=input?.chart?.result?.length===1?input.chart.result[0]?.meta:null;
   if(meta?.symbol==='BZ=F'&&meta.currency==='USD'&&!input.chart.error){const status=providerState(meta,now);if(['CLOSED','PAUSED'].includes(status.state))return reply({ok:false,marketOpen:false,symbol:'BZ=F',marketState:status.state,checkedAt:now,reason:'market-closed-from-source',source:'Yahoo Finance'},120);}
   const parsed=parseBrentQuote(input,now);
   if(parsed)return reply(parsed,120);
   stale=true;
  }catch{ /* Try the other Yahoo hostname once; never fabricate a quote. */ }
 }
 return reply({ok:false,marketOpen:true,symbol:'BZ=F',marketState:'UNKNOWN',checkedAt:now,reason:stale?'source-stale-or-invalid':'source-unavailable'},30);
}

