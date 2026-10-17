/* Build the reviewed single-file upload. No credentials or deployment. */
import {build} from 'esbuild';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:['monitor-global-worker-7_7_0.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,outfile:resolve(tmpdir(),'monitor-global-worker-bundle.mjs')});
const zip=resolve(root,'downloads/monitor-global-worker-otimizado.zip');
const docs=['kv-shared-cache.md','telegram-storage-and-daily-health.md','shared-source-collection.md','worker-modules.md'];
const packaging=`import sys,zipfile,pathlib
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for name,data in [('monitor-global-worker-7_7_0.js',sys.stdin.buffer.read())]+[(pathlib.Path(p).name,pathlib.Path(p).read_bytes()) for p in sys.argv[2:]]:
  info=zipfile.ZipInfo(name,(2026,1,1,0,0,0));info.external_attr=0o644<<16
  z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
`;
const packaged=spawnSync(process.env.PYTHON||'python3',['-c',packaging,zip,...docs.map(name=>resolve(root,'docs',name))],{input:result.outputFiles[0].contents,encoding:null});
if(packaged.status!==0)throw Error(packaged.stderr?.toString()||'Failed to package Worker');
const sha=createHash('sha256').update(await readFile(zip)).digest('hex');
const script=resolve(root,'tools/cloudflare-worker-maintenance.py'),source=await readFile(script,'utf8');
if(!/^BUNDLE_SHA256 = '[a-f0-9]{64}'$/m.test(source))throw Error('Reviewed bundle checksum declaration missing');
await writeFile(script,source.replace(/^BUNDLE_SHA256 = '[a-f0-9]{64}'$/m,`BUNDLE_SHA256 = '${sha}'`));
console.log(JSON.stringify({moduleBytes:result.outputFiles[0].contents.length,zipBytes:(await stat(zip)).size,sha256:sha},null,2));
