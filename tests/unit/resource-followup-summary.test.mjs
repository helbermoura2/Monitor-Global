import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize,markdown} from '../../tools/resource-followup-summary.mjs';
test('no observed excess does not close the incident, including an empty window',()=>{
 for(const counts of [{},{'/tv-alerts ok':30}]){const r=summarize({counts,sessionRemoved:true});assert.equal(r.status,'no_resource_event_observed');assert.equal(r.incidentResolved,false);assert.match(markdown(r),/não encerra/);}
});
test('resource outcomes identify an aggregate route without claiming a cause',()=>{
 const r=summarize({sessionRemoved:true,counts:{'/tv-weather exceededCpu':2,'/population-exposure exceededMemory':1,'other exceededResources':1,'/tv-alerts ok':10}});
 assert.equal(r.status,'resource_route_observed');assert.equal(r.resourceEvents,4);assert.equal(r.incidentResolved,false);assert.equal(r.routes.length,3);assert.match(markdown(r),/Não atribui causa específica/);
});
test('unknown routes and failed cleanup cannot become confirmed attribution or successful observation',()=>{
 assert.equal(summarize({sessionRemoved:true,counts:{'other exceededCpu':1}}).status,'resource_event_without_route');
 for(const report of [{blocked:true,sessionRemoved:true},{sessionRemoved:false},{}])assert.equal(summarize(report).status,'observation_unavailable');
});
test('summary discards injected paths, non-resource messages and invalid counts',()=>{
 const r=summarize({sessionRemoved:true,counts:{'/secret?token=private exceededCpu':1,'/tv-weather exceededCpu extra':1,'/tv-weather exception':1,'/tv-weather exceededCpu':-1,'/tv-alerts exceededResources':1.5,'/telegram-image/* exceededCpu':1}});
 assert.equal(r.resourceEvents,1);assert.equal(r.routes[0].route,'/telegram-image/*');assert(!JSON.stringify(r).includes('private'));
});
