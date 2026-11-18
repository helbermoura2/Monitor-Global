import test from 'node:test';
import assert from 'node:assert/strict';
import {gaugeEvidence,hourlyEvidence,collectRainEvidence} from '../../worker/rain-evidence.mjs';
import {createTvRain,TV_RAIN_LIBERDADE as loc} from '../../worker/tv-rain.mjs';

const now=Date.parse('2026-11-18T19:23:00Z');
const gauge={codestacao:'355030801A',id_sensor:10,qualificacao:'0000',nome:'Estação de teste',
  latitude:loc.lat,longitude:loc.lng,datahora:'2026-11-18 19:20',valor:0.2};
const hour=(ecmwf,gfs,icon)=>({utc_offset_seconds:0,hourly:{time:[Date.parse('2026-11-18T20:00:00Z')/1000],
  precipitation_ecmwf_ifs025:[ecmwf],precipitation_gfs_seamless:[gfs],precipitation_icon_seamless:[icon]}});

test('uses only recent positive readings from nearby, quality-checked gauges',()=>{
  assert.equal(gaugeEvidence([gauge],loc,now).amount,0.2);
  assert.equal(gaugeEvidence([gauge,{...gauge,valor:0,datahora:'2026-11-18 19:22'}],loc,now),null);
  for(const row of [{...gauge,latitude:loc.lat+.05},{...gauge,datahora:'2026-11-18 19:00'},
    {...gauge,datahora:'2026-11-18 19:25'},{...gauge,qualificacao:'0004'}]){
    assert.equal(gaugeEvidence([row],loc,now),null);
  }
});

test('two hourly models must independently indicate precipitation in the same window',()=>{
  assert.equal(hourlyEvidence(hour(.3,null,.4),now).kind,'hourly');
  assert.equal(hourlyEvidence(hour(.3,null,0),now),null);
});

test('gauge credentials only go to Cemaden and a failed gauge request preserves hourly evidence',async()=>{
  const evidence=await collectRainEvidence(loc,{CEMADEN_API_TOKEN:'fixture'},now,async(url,options)=>{
    if(new URL(url).hostname==='sws.cemaden.gov.br'){
      assert.equal(options.headers.token,'fixture');
      return new Response(null,{status:503});
    }
    assert.equal(options.headers.token,undefined);
    return Response.json(hour(.3,0,.4));
  });
  assert.equal(evidence.kind,'hourly');
});

test('independent evidence remains available without fabricating a minute forecast',async()=>{
  const handler=createTvRain({location:loc,clock:()=>now,cache:()=>null,
    read:async()=>Response.json({ok:false,reason:'daily_limit'}),
    evidence:async()=>gaugeEvidence([gauge],loc,now)});
  const result=await(await handler(new Request('https://internal/tv-rain'),{})).json();
  assert.equal(result.ok,false);
  assert.equal(result.forecast,undefined);
  assert.equal(result.evidence.kind,'gauge');
});
