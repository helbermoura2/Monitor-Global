const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../../js/aftershock-model.js');
const now=Date.now(),main={id:'main',type:'earthquake',time:now-3600000,coords:[-80.8,7.5],mag:6.6,depth:10};
const child=(id,patch={})=>({...main,id,time:now-600000,mag:4.2,coords:[-80.7,7.5],...patch});
test('later smaller events share a root; earlier, distant, deep, simultaneous and greater events do not',()=>{
 const good=child('good'),bad=[child('before',{time:main.time-1000}),child('far',{coords:[-79,7.5]}),child('deep',{depth:200}),child('same-origin',{time:main.time+30000}),child('bigger',{mag:7})];
 const seq=M.build([main,good,...bad],now);assert.deepEqual(seq.forEvent(main.id).children.map(x=>x.id),['good']);assert.equal(seq.forEvent('good').main.id,'main');for(const q of bad)assert.equal(seq.parents.has(q.id),false);
});
test('unknown depth, invalid coordinates, old and future reports are excluded',()=>{
 assert.equal(M.build([main,child('missing',{depth:null}),child('invalid',{coords:[null,7]}),child('future',{time:now+120000}),child('old',{time:now-73*3600000})],now).groups.size,0);
 assert.equal(M.build([{...main,time:now-73*3600000},child('child')],now).groups.size,0);
});
test('a smaller M5 successor does not steal the main sequence; duplicate IDs count once',()=>{
 const sub=child('sub',{mag:5.7,time:main.time+300000}),later=child('later');const seq=M.build([later,sub,main,later],now);
 assert.equal(seq.forEvent('later').main.id,'main');assert.equal(seq.forEvent('sub').children.length,2);
});
test('near equal independent candidate mains stay ambiguous and results do not depend on catalog order',()=>{
 const a={...main,id:'a',coords:[-80.9,7.5]},b={...main,id:'b',time:main.time+1000,coords:[-80.7,7.5]},c=child('c',{coords:[-80.8,7.5]});
 assert.equal(M.build([a,b,c],now).forEvent(c.id),null);assert.equal(M.build([c,b,a],now).forEvent(c.id),null);
});
test('longitude seam is geographic distance, not a 360 degree separation; radius is bounded',()=>{
 const a={...main,coords:[179.9,10]},b=child('seam',{coords:[-179.9,10]});assert.equal(M.build([a,b],now).forEvent(b.id).main.id,a.id);assert.equal(M.radius(9),200);assert.equal(M.radius(5),25);
});
test('magnitude and location revisions recompute the sequence without sticky assignments',()=>{
 const c=child('rev');assert.equal(M.build([main,c],now).parents.get('rev'),'main');assert.equal(M.build([main,{...c,mag:7}],now).parents.has('rev'),false);assert.equal(M.build([main,{...c,coords:[0,0]}],now).parents.has('rev'),false);
});
