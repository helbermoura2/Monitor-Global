import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const folder=new URL('../../android-mobile/app/src/main/assets/',import.meta.url);
const read=name=>readFileSync(new URL(name,folder),'utf8');
const states=JSON.parse(read('data/br-states.geojson'));
const sp=JSON.parse(read('data/br-municipalities-sp.geojson'));
const boundaries=read('phone-boundaries.js');
const map=read('phone-map.js'),brazil=read('phone-brazil.js'),rain=read('phone-rain.js');
const html=read('phone-map.html'),brHtml=read('phone-brazil.html'),rainHtml=read('phone-rain.html');
test('all 27 states ship offline from an attributed Brazilian geodata snapshot',()=>{
 assert.equal(states.type,'FeatureCollection');assert.equal(states.features.length,27);
 assert.equal(new Set(states.features.map(f=>f.properties.sigla)).size,27);
 for(const f of states.features){assert.match(f.properties.sigla,/^[A-Z]{2}$/);assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));}
 assert.match(boundaries,/data\/br-states\.geojson/);
 assert.match(boundaries,/Dados simplificados do IBGE|malhas territoriais simplificadas|Malhas territoriais simplificadas/);
});
test('SP municipality boundaries are offline and fetched only at high zoom',()=>{
 assert.equal(sp.features.length,645);
 assert.ok(sp.features.every(f=>f.properties.uf==='SP'&&/^\d{7}$/.test(f.properties.cd_geocmu)));
 assert.ok(sp.features.some(f=>f.properties.nome==='São Paulo'));
 assert.ok(sp.features.some(f=>f.properties.nome==='Campinas'));
 assert.match(boundaries,/const MUNICIPAL_ZOOM=7\.8/);
 assert.match(boundaries,/data\/br-municipalities-sp\.geojson/);
 assert.match(boundaries,/if\(ufLoaded!==uf\)loadMunicipal\(uf\)/);
});
test('non-SP malhas require fixed signed source and valid UF path only',()=>{
 const sha='a4680c128c23c90fde346334fd5888a3b2997d29';
 assert.ok(boundaries.includes(sha));
 assert.ok(boundaries.includes('https://cdn.jsdelivr.net/gh/henriquemalvar/br-geojson@'));
 assert.ok(boundaries.includes("const UFS=new Set("));
 const java=readFileSync(new URL('../../android-mobile/app/src/main/java/top/monitorglobal/tv/PhoneMapView.java',import.meta.url),'utf8');
 assert.ok(java.includes('municipalMeshResource'));
 assert.ok(java.includes(sha));
 assert.ok(java.includes('uri.getQuery()!=null'));
});
test('event filters only show data present in the catalog, no false safety claims',()=>{
 assert.match(map,/filter\.hours>0/);
 assert.match(map,/filter\.minMagnitude>0/);
 assert.match(map,/e\.countryCode/);
 assert.match(map,/nesta consulta\. Isso não significa ausência de eventos/);
 assert.match(map,/clusters|Cluster in projected screen space/i);
 assert.match(map,/maplibregl\.Popup/);
 assert.match(map,/setDOMContent\(content\)/);
});
test('three maps share boundary overlays and explicit source modes',()=>{
 for(const page of [html,brHtml,rainHtml]){
  assert.ok(page.includes('phone-boundaries.js'));
  assert.ok(page.includes('phone-boundaries.css'));
  assert.ok(page.includes('https://cdn.jsdelivr.net'));
 }
 assert.match(map,/ArgosBoundaries\.create/);
 assert.match(brazil,/ArgosBoundaries\.create/);
 assert.match(rain,/ArgosBoundaries\.create/);
 assert.match(brazil,/selectCity\(local,false\)/);
 assert.match(brazil,/function selectCity\(p,recenter=true\)/);
 assert.match(brazil,/if\(map&&recenter\)/);
});
