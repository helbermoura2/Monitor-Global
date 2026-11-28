// No proxy or credentials. Record the actual host/path and CORS response for the Android allowlist.
import {readFileSync} from 'node:fs';
import {searchUrl} from '../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
const origin='https://appassets.androidplatform.net';
async function probe(url,kind,headers={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname==='inpe.br'||u.hostname.endsWith('.inpe.br')))throw Error('Unexpected origin');
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Origin:origin,...headers}});
  const allow=res.headers.get('access-control-allow-origin');
  console.log(JSON.stringify({kind,host:u.hostname,path:u.pathname,status:res.status,cors:allow===origin||allow==='*',allow,contentType:res.headers.get('content-type'),query:!!u.search,range:res.headers.get('content-range')}));
  await res.body?.cancel();
 }catch(e){console.log(JSON.stringify({kind,host:u.hostname,path:u.pathname,error:e.message}));}
}
await probe(searchUrl([-48,-25,-45,-22]),'STAC');
for(const product of ['cappi3km','cappi15l']){
 const f=JSON.parse(readFileSync('/tmp/argos-inpe-'+product+'.json','utf8'));
 await probe(f.products[product].href,product,{Range:'bytes=0-7'});
 if(f.products.thumbnail)await probe(f.products.thumbnail.href,'thumbnail',{Range:'bytes=0-7'});
}
