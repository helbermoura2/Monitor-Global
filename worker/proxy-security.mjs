// Public proxy: validate every hop and bound decoded body bytes, not Content-Length alone.
export function proxyTarget(value,allowed){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed.includes(u.hostname)||u.href.length>5000)throw Error('Destino não permitido');
 u.hash='';return u;
}
export async function proxyText(value,allowed,headers,{timeoutMs=15000,maxBytes=3*1024*1024,maxRedirects=3}={}){
 let u=proxyTarget(value,allowed);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let reader,onAbort;
 try{
  for(let hop=0;;hop++){
   const r=await fetch(u.href,{method:'GET',headers,redirect:'manual',signal:controller.signal});
   if([301,302,303,307,308].includes(r.status)){
    await r.body?.cancel();if(hop>=maxRedirects)throw Error('Excesso de redirecionamentos');const location=r.headers.get('Location');if(!location)throw Error('Redirecionamento inválido');u=proxyTarget(new URL(location,u),allowed);continue;
   }
   const declared=Number(r.headers.get('Content-Length'));if(declared>maxBytes){await r.body?.cancel();throw Error('Resposta acima do limite');}
   if(!r.body)return {ok:r.ok,status:r.status,text:'',contentType:r.headers.get('Content-Type')||'',retryAfter:r.headers.get('Retry-After')||''};
   reader=r.body.getReader();const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Error('Tempo de consulta excedido'));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
   const decoder=new TextDecoder();let bytes=0,text='';
   for(;;){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw Error('Resposta acima do limite');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
   return {ok:r.ok,status:r.status,text,contentType:r.headers.get('Content-Type')||'',retryAfter:r.headers.get('Retry-After')||''};
  }
 }finally{clearTimeout(timer);if(onAbort)controller.signal.removeEventListener('abort',onAbort);if(reader){try{await reader.cancel();}catch{}reader.releaseLock();}controller.abort();}
}
export const proxyHeaders={'Content-Security-Policy':"default-src 'none'; sandbox; base-uri 'none'; frame-ancestors 'none'",'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const proxyContentType=value=>/^(?:application\/(?:[a-z0-9.+-]*json|xml)|text\/xml)(?:;|$)/i.test(value)?value:'text/plain; charset=utf-8';

// Apply after shared-cache restoration too: older/stored headers must not bypass response policy.
export function hardenResponse(request,response){
 const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
 const u=new URL(request.url);if(u.pathname==='/'&&u.searchParams.has('url')){for(const [name,value]of Object.entries(proxyHeaders))headers.set(name,value);headers.set('Content-Type',proxyContentType(headers.get('Content-Type')||''));}
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
