const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map();
class Classes {constructor(){this.s=new Set()}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v,on){const b=on===undefined?!this.s.has(v):on;b?this.add(v):this.remove(v);return b}}
class Element {constructor(tag){this.tag=tag;this.children=[];this.classList=new Classes();this.style={};this.dataset={};this.attrs={};this.textContent=''}set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}setAttribute(k,v){this.attrs[k]=v}append(...children){this.children.push(...children)}appendChild(c){this.append(c);return c}prepend(c){this.children.unshift(c)}replaceChildren(){this.children=[]}}
const body=new Element('body');for(const id of ['ux-controlbar','fab-menu','ux-panel','btn-teste']){const e=new Element('div');e.id=id;body.append(e)}
const document={body,readyState:'complete',getElementById:id=>nodes.get(id),createElement:t=>new Element(t),addEventListener(){},querySelectorAll(selector){if(selector.includes('data-view'))return nodes.get('mobile-primary-nav').children;return []}};
let orientationChange;const media={matches:true,addEventListener(_,fn){orientationChange=fn}};
const calls=[];const context={document,window:{matchMedia:()=>media, toggleSomAtivo(){context.somAtivo=!context.somAtivo},__uxShow:k=>calls.push(k)},MutationObserver:class{observe(){}},localStorage:{getItem:()=>null},somAtivo:false,somVolume:.7,globalAlerts:[{id:'a',place:'Vento forte',source:'INMET',time:100}],globalEvents:[],toggleMobileEventsModal:on=>body.classList.toggle('mobile-events-open',on),fecharPainelDetalhesMobile:()=>body.classList.remove('mobile-details-mid','mobile-details-open'),showAlertDetails:item=>calls.push(item.id),setSomVolume:v=>calls.push('volume:'+v),formatTime:()=> 'agora'};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../js/mobile-portrait.js'),'utf8'),context);
const buttons=nodes.get('mobile-primary-nav').children;assert.deepEqual(buttons.map(b=>b.textContent),['Mapa','Eventos','Alertas']);assert(body.classList.contains('mg-mobile-primary'));
buttons[1].onclick();assert(body.classList.contains('mobile-events-open'));
buttons[0].onclick();assert(!body.classList.contains('mobile-events-open'));
buttons[2].onclick();assert.equal(buttons[2].attrs['aria-pressed'],'true');
const panel=nodes.get('menu-float-panel');
const all=el=>[el,...el.children.flatMap(all)];const find=text=>all(panel).find(e=>e.textContent===text);
find('Som desligado · ligar').onclick();assert.equal(context.somAtivo,true);
const slider=all(panel).find(e=>e.tag==='input');slider.value='35';slider.oninput();assert(calls.includes('volume:35'));
all(panel).find(e=>e.className==='mg-alert-row').onclick();assert(calls.includes('a'));assert(!panel.classList.contains('open'));
context.window.MobilePortraitUI.menu();find('Filtros de eventos').onclick();assert(body.classList.contains('mg-mobile-filters'));
media.matches=false;orientationChange();assert(!body.classList.contains('mg-mobile-primary'));assert(!body.classList.contains('mg-mobile-filters'));
console.log('PASS: Mapa/Eventos/Alertas navigation, real alert selection, audio toggle/volume, secondary filters, portrait exit');
