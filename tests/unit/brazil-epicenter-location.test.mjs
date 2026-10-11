import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBrazilLocator, geometryContains} from '../../brazil-epicenter-location.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/brazil-epicenter-sp.json',import.meta.url),'utf8'));
test('published USP coordinates and rounded EMSC coordinates are Nuporanga/SP, not MG',async()=>{
    let calls=0;
    const locate=createBrazilLocator(async url=>{calls++;assert.match(url,/estados\/35\?/);return Response.json(fixture);});
    const [precise,rounded]=await Promise.all([locate(-20.710712432861328,-47.66289138793945),locate(-20.71,-47.66)]);
    assert.equal(precise.name,'Nuporanga');assert.equal(precise.uf,'SP');assert.equal(precise.code,'3533601');assert.equal(rounded.name,'Nuporanga');assert.equal(calls,1);
    await locate(-20.71,-47.66);assert.equal(calls,1);
});
test('do not assign nearest city on missing/ambiguous polygons or failed provider',async()=>{
    for(const body of [fixture.features.slice(0,0),[...fixture.features,...fixture.features]]){
        const locate=createBrazilLocator(async()=>Response.json({type:'FeatureCollection',features:body}));
        assert.equal(await locate(-20.71,-47.66),null);
    }
    let calls=0;
    const locate=createBrazilLocator(async()=>{calls++;throw new Error('offline');});
    assert.equal(await locate(-20.71,-47.66),null);assert.equal(await locate(-20.71,-47.66),null);assert.equal(calls,1);
    assert.equal(await locate(null,-47.66),null);assert.equal(await locate(0,0),null);
});
test('polygon holes, multi polygons and boundary uncertainty',()=>{
    const square=[[0,0],[4,0],[4,4],[0,4],[0,0]],hole=[[1,1],[2,1],[2,2],[1,2],[1,1]];
    assert.equal(geometryContains({type:'Polygon',coordinates:[square,hole]},3,3),true);
    assert.equal(geometryContains({type:'Polygon',coordinates:[square,hole]},1.5,1.5),false);
    assert.equal(geometryContains({type:'Polygon',coordinates:[square]},0,2),false);
    assert.equal(geometryContains({type:'MultiPolygon',coordinates:[[square]]},3,3),true);
});
test('Telegram caption uses the same resolved municipality and retains source place',async()=>{
    const {enrichBrazilEpicenter}=await import('../../brazil-epicenter-location.mjs');
    const saved=globalThis.fetch;
    try{
        globalThis.fetch=async()=>Response.json(fixture);
        const event={lat:-20.71,lon:-47.66,mag:3.4,depth:4,place:'MINAS GERAIS-SAO PAULO, Brasil',source:'EMSC',brazil:true,timeIso:'2026-10-10T20:41:54Z'};
        await enrichBrazilEpicenter(event);
        assert.equal(event.place,'Nuporanga/SP, Brasil');assert.equal(event.originalPlace,'MINAS GERAIS-SAO PAULO, Brasil');
        let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
        source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
        const worker=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {telegramCaption};').toString('base64'));
        const caption=worker.telegramCaption(event);assert.match(caption,/Nuporanga\/SP/);assert.doesNotMatch(caption,/MINAS|Minas/);
        event.place='MINAS GERAIS-SAO PAULO, Brasil';await enrichBrazilEpicenter(event);assert.equal(event.place,'Nuporanga/SP, Brasil');
    }finally{globalThis.fetch=saved;}
});
