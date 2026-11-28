// Build local reader assets using the exact versions approved in the live browser diagnostic.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createRequire} from 'node:module';
const dest=resolve(process.argv[2]||'android-mobile/app/build/generated/cappiVendor');
const deps=resolve(dest,'../cappiDependencies');
await mkdir(deps,{recursive:true});await mkdir(dest,{recursive:true});
const required={netcdfjs:'4.0.0',h5wasm:'0.10.3',esbuild:'0.25.12'};
await writeFile(join(deps,'package.json'),JSON.stringify({private:true,dependencies:required},null,2));
let present=true;
for(const [name,version] of Object.entries(required)){
 try{const p=JSON.parse(await readFile(join(deps,'node_modules',name,'package.json'),'utf8'));if(p.version!==version)present=false;}catch{present=false;}
}
if(!present)execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','--prefix',deps,'--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit'});
const require=createRequire(join(deps,'package.json'));
const {build}=require('esbuild');
const outfile=join(dest,'inpe-cappi-worker.mjs');
const result=await build({entryPoints:['tools/inpe-cappi-browser-worker.mjs'],outfile,bundle:true,platform:'browser',format:'esm',target:'chrome100',minify:true,legalComments:'inline',metafile:true,nodePaths:[join(deps,'node_modules')],logLevel:'warning'});
const size=(await stat(outfile)).size;
if(size<1000000||size>12*1024*1024)throw Error('Unexpected CAPPI bundle size '+size);
const shipped=new Set();
for(const key of Object.keys(result.metafile.inputs)){
 const p=resolve(key),mark=p.lastIndexOf('/node_modules/');
 if(mark<0)continue;
 const rest=p.slice(mark+14).split('/');
 const pkg=rest[0].startsWith('@')?rest.slice(0,2).join('/'):rest[0];
 shipped.add(pkg);
}
const notices=[];
for(const name of [...shipped].sort()){
 const folder=join(deps,'node_modules',name);
 const p=JSON.parse(await readFile(join(folder,'package.json'),'utf8'));
 const texts=(await readdir(folder)).filter(n=>/^(LICENSE|LICENCE|COPYING|NOTICE|THIRD[-_ ]?PARTY)/i.test(n));
 const lines=[];
 for(const file of texts){const location=join(folder,file);if((await stat(location)).isFile())lines.push('--- '+file+' ---\n'+await readFile(location,'utf8'));}
 if(!lines.length)throw Error('Missing license notice for '+name);
 notices.push(name+' '+p.version+' | '+JSON.stringify(p.license)+'\n'+lines.join('\n\n'));
}
if(!shipped.has('h5wasm')||!shipped.has('netcdfjs'))throw Error('CAPPI dependencies missing in bundle');
await writeFile(join(dest,'THIRD-PARTY-NOTICES.txt'),notices.join('\n\n=================\n\n'));
await writeFile(join(dest,'BUILD-INFO.json'),JSON.stringify({reader:required,bytes:size,packages:[...shipped].sort()},null,2));
console.log('Packaged CAPPI worker: '+size+' bytes; '+[...shipped].join(', '));
