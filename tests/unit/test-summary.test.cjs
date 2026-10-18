const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('Actions summary names failed internal and browser checks even without HTML artifacts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-summary-'));
 try{
  fs.mkdirSync(path.join(dir,'test-logs'));fs.mkdirSync(path.join(dir,'test-results'));
  fs.writeFileSync(path.join(dir,'test-logs/unit-checks.log'),'\x1b[31m✖ retired schedule expectation\x1b[0m\n');
  fs.writeFileSync(path.join(dir,'test-results/results.json'),JSON.stringify({suites:[{title:'Card',specs:[{title:'volcano revision',tests:[{status:'unexpected',results:[{error:{message:'Expected screen lava'}}]}]}]}]}));
  const output=path.join(dir,'summary.md'),run=spawnSync(process.execPath,[path.resolve('tools/test-summary.cjs')],{cwd:dir,env:{...process.env,NODE_OPTIONS:'',GITHUB_STEP_SUMMARY:output},encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const s=fs.readFileSync(output,'utf8');assert.match(s,/retired schedule expectation/);assert.match(s,/Card → volcano revision/);assert.match(s,/Expected screen lava/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
