'use strict';
const REPORT=/^(?:playwright-report(?:-\d+)?|test-diagnostics-.+|storm-previews|wind-previews|cyclone-previews|advanced-weather-previews|monitor-global-tv-(?:banner|cards)-review|monitor-global-mobile-(?:map-check|screens))$/;
function reportCandidates(artifacts){const groups=new Map();for(const a of artifacts)if(!a.expired&&REPORT.test(a.name)){const g=groups.get(a.name)||[];g.push(a);groups.set(a.name,g);}return [...groups.values()].flatMap(g=>g.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(2));}
async function prune({github,context,core}){
 const repo=context.repo,all=await github.paginate(github.rest.actions.listArtifactsForRepo,{...repo,per_page:100}),runs=new Map();
 async function run(a){const id=a.workflow_run?.id;if(!id)return null;if(!runs.has(id))runs.set(id,(await github.rest.actions.getWorkflowRun({...repo,run_id:id})).data);return runs.get(id);}
 const candidates=reportCandidates(all),pages=all.filter(a=>!a.expired&&a.name==='github-pages').sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));let retainedPage=null;
 for(const a of pages){const r=await run(a);if(r?.status==='completed'&&r.conclusion==='success'){retainedPage=a;break;}}
 if(retainedPage)for(const a of pages)if(Date.parse(a.created_at)<Date.parse(retainedPage.created_at))candidates.push(a);
 let bytes=0,deleted=0;for(const a of candidates){const r=await run(a);if(r?.status!=='completed')continue;
  // Only known diagnostic exports and superseded Pages upload bundles are eligible.
  if(!REPORT.test(a.name)&&a.name!=='github-pages')throw Error('Artifact not explicitly allowed');
  try{await github.rest.actions.deleteArtifact({...repo,artifact_id:a.id});bytes+=a.size_in_bytes;deleted++;core.info(JSON.stringify({deleted:a.id,name:a.name,bytes:a.size_in_bytes}));}catch(e){if(e.status!==404)throw e;}
 }
 const result={deleted,bytes,reclaimedMiB:Math.round(bytes/1048576*100)/100,retainedPagesArtifact:retainedPage?.id||null,protected:'APKs, signing artifacts, caches, releases and repository downloads are not deleted'};core.info('ARTIFACT_CLEANUP_RESULT '+JSON.stringify(result));await core.summary.addHeading('Armazenamento de testes').addRaw(JSON.stringify(result,null,2)).write();return result;
}
module.exports=prune;module.exports.reportCandidates=reportCandidates;
