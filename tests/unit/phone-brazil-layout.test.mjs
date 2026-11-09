import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=filename=>readFileSync(new URL('../../android-mobile/app/src/main/assets/'+filename,import.meta.url),'utf8');
const html=read('phone-brazil.html'),css=read('phone-brazil.css'),js=read('phone-brazil.js');
test('Brazil map remains visible between compact toolbar and forecast controls',()=>{
 assert.match(html,/<main class="brazil-main">/);
 assert.ok(html.indexOf('class="brazil-toolbar"')<html.indexOf('class="map-panel brazil-map-panel"'));
 assert.ok(html.indexOf('class="map-panel brazil-map-panel"')<html.indexOf('class="brazil-controls"'));
 assert.match(css,/\.brazil-map-panel\{flex:1 0 250px;min-height:250px/);
 assert.match(css,/main\.brazil-main\{[^}]*overflow-y:auto/);
});
test('satellite and radar settings are outside the map and hidden until selected',()=>{
 assert.match(html,/<section id="overlay-panel"[^>]*hidden>/);
 assert.match(js,/BrazilSatellite\.create\(\{map,host:\$\('overlay-panel'\),enabled:false\}\)/);
 assert.match(js,/PhoneBrazilRadar\.create\(map,\$\('overlay-panel'\)\)/);
 assert.match(css,/\.overlay-panel\[hidden\]\{display:none!important\}/);
 assert.match(js,/syncOverlays\(\)/);
});
test('all navigation, forecast controls and accessibility identifiers are retained',()=>{
 for(const id of ['city-search','city-results','brazil-status','brazil-map','radar-toggle','satellite-toggle','overlay-panel','play','frame','refresh','time-label','place','facts','headline','validity','forecast-source','recenter']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const layer of ['temperature','wind','rain','pressure'])assert.ok(html.includes('data-layer="'+layer+'"'));
 assert.ok(html.includes('aria-live="polite"'));
 assert.ok(html.includes('<details id="forecast-details">'));
});
