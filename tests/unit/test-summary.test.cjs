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

test('Actions summary preserves results from separate browser stages and reports malformed or setup failures',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-summary-stages-'));
 try{
  fs.mkdirSync(path.join(dir,'test-diagnostics'));
  const report=title=>({stats:{expected:2,unexpected:1},suites:[{title:'Card',specs:[{title,tests:[{status:'unexpected',results:[{error:{message:'Failure in '+title}}]}]}]}]});
  fs.writeFileSync(path.join(dir,'test-diagnostics/visibility.json'),JSON.stringify(report('visibility failure')));
  fs.writeFileSync(path.join(dir,'test-diagnostics/storms.json'),JSON.stringify(report('storm failure')));
  fs.writeFileSync(path.join(dir,'test-diagnostics/setup.json'),JSON.stringify({errors:[{message:'Browser did not launch'}]}));
  fs.writeFileSync(path.join(dir,'test-diagnostics/interrupted.json'),'{');
  const output=path.join(dir,'summary.md'),run=spawnSync(process.execPath,[path.resolve('tools/test-summary.cjs')],{cwd:dir,env:{...process.env,NODE_OPTIONS:'',GITHUB_STEP_SUMMARY:output},encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const s=fs.readFileSync(output,'utf8');
  assert.match(s,/Card → visibility failure/);assert.match(s,/Card → storm failure/);
  assert.match(s,/test-diagnostics\/visibility.json/);assert.match(s,/test-diagnostics\/storms.json/);
  assert.match(s,/Browser did not launch/);assert.match(s,/incompleto \(test-diagnostics\/interrupted.json\)/);
  assert.doesNotMatch(s,/Nenhuma falha registrada/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
