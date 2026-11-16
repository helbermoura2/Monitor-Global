#!/usr/bin/env node
// Validate that the Telegram M6 exact reference PNG has been transferred
// as the actual approved bytes, rather than a visually similar re-rendering.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'assets/telegram/m6/imperial-bronze-master.json'),'utf8'));
const png=await readFile(path.join(root,manifest.file)).catch(()=>null);
if(!png){console.error('ARTE OFICIAL M6 AUSENTE: NÃO PUBLICAR IMAGEM PROCEDURAL COMO SE FOSSE A APROVADA');process.exitCode=2;}
else{
  const dv=new DataView(png.buffer,png.byteOffset,png.byteLength);
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const sha=createHash('sha256').update(png).digest('hex');
  const width=dv.getUint32(16),height=dv.getUint32(20);
  const ok=png.subarray(0,8).equals(sig)&&png.length===manifest.bytes&&sha===manifest.sha256&&width===manifest.width&&height===manifest.height;
  if(!ok){console.error('ARTE M6 DIFERENTE DA APROVADA:',JSON.stringify({width,height,bytes:png.length,sha256:sha}));process.exitCode=1;}
  else console.log('ARTE ORIGINAL EXATA VALIDADA:',manifest.identity,width,height);
}
