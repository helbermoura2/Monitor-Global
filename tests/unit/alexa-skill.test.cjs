const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {commandForIntent,normalizePairCode}=require('../../alexa-skill/lambda/commands');
test('Alexa skill maps only known Portuguese intents to TV cards',()=>{
 assert.equal(commandForIntent('BrentIntent'),'brent');
 assert.equal(commandForIntent('TempoIntent'),'weather');
 assert.equal(commandForIntent('BrasilIntent'),'brazil');
 assert.equal(commandForIntent('UnlockDoorIntent'),null);
 assert.equal(commandForIntent('__proto__'),null);
});
test('one-time pairing code is normalized conservatively',()=>{
 assert.equal(normalizePairCode('001234'),'001234');
 assert.equal(normalizePairCode('1234'),'001234');
 assert.equal(normalizePairCode('999999'),'999999');
 assert.equal(normalizePairCode(''),null);
 assert.equal(normalizePairCode('1234567'),null);
});
test('all skill intents have nonempty samples and Brazilian locale invocation name',()=>{
 const model=JSON.parse(fs.readFileSync('alexa-skill/skill-package/interactionModels/custom/pt-BR.json','utf8'));
 assert.equal(model.interactionModel.languageModel.invocationName,'monitor global');
 const intents=model.interactionModel.languageModel.intents;
 for(const name of ['LinkIntent','BrentIntent','TempoIntent','BrasilIntent']){
  const intent=intents.find(i=>i.name===name);
  assert(intent&&intent.samples.length>=3);
 }
});

test('Alexa-hosted code supports Amazon-managed Node 16 without global fetch',()=>{
 const code=fs.readFileSync('alexa-skill/lambda/index.js','utf8');
 const pkg=JSON.parse(fs.readFileSync('alexa-skill/lambda/package.json','utf8'));
 assert.match(code,/require\('https'\)/);
 assert.match(code,/https\.request\(/);
 assert.doesNotMatch(code,/(?<![.\w])await\s+fetch\s*\(/);
 assert.equal(pkg.engines.node,'>=16');
});
