const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map();let now=1000;const timers=new Map(),frames=[];let timerId=0,change;const observers=[];
class Classes{constructor(){this.set=new Set()}contains(c){return this.set.has(c)}add(c){this.set.add(c)}toggle(c,on){on?this.set.add(c):this.set.delete(c)}}
class E{constructor(tag){this.tag=tag;this.children=[];this.classList=new Classes();this.props=new Map();this.style={setProperty:(k,v)=>this.props.set(k,v),removeProperty:k=>this.props.delete(k)};this.rect={top:0,bottom:0,height:0};this.open=false}set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}append(...kids){kids.forEach(k=>this.appendChild(k))}appendChild(k){if(k.parentNode)k.parentNode.children=k.parentNode.children.filter(x=>x!==k);k.parentNode=this;this.children.push(k);return k}replaceChildren(){this.children=[]}setAttribute(){}addEventListener(){}getBoundingClientRect(){return this.rect}querySelector(){return header}after(k){this.parentNode.appendChild(k)}showModal(){this.open=true}close(){this.open=false}}
const body=new E('body'),panel=new E('aside');panel.id='painel-direito';panel.rect={top:580,bottom:800,height:220};const header=new E('header');panel.append(header);body.append(panel);
for(const id of ['top-strip','latest-event-ticker']){const e=new E('div');e.id=id;e.rect.bottom=200;body.append(e)}
const media={matches:true,addEventListener:(_,fn)=>change=fn};
const ctx={document:{body,readyState:'complete',getElementById:id=>nodes.get(id),createElement:t=>new E(t)},window:{matchMedia:()=>media,innerWidth:1400,innerHeight:800,addEventListener(){}},Date:class extends Date{static now(){return now}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.push(fn);return frames.length},MutationObserver:class{constructor(fn){this.fn=fn}observe(){observers.push(this.fn)}},ResizeObserver:class{observe(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../js/mobile-notices.js'),'utf8'),ctx);const api=ctx.window.MobileNotices;

const stack=()=>nodes.get('mobile-notice-stack');
const title=()=>stack().children[0].children[1].children[0].textContent;
const close=()=>stack().children[0].children[2].children[1].onclick();
const count=()=>stack().children[0].children[2].children[0].textContent;
api.push({title:'Fonte JMA offline',type:'warning'});
api.push({title:'Outro aviso',type:'info'});
api.push({title:'Sismo revisado',type:'revision',duration:10000});
assert.equal(stack().children.length,1);assert.equal(title(),'Sismo revisado');assert.equal(count(),'+2 avisos');
now=21000;[...timers.values()].forEach(fn=>fn());
assert.equal(title(),'Fonte JMA offline'); // Queue duration starts when displayed.
api.push({title:'Sismo novo',type:'newquake'});assert.equal(title(),'Sismo novo');assert.equal(stack().children.length,1);
close();assert.equal(title(),'Fonte JMA offline');close();assert.equal(title(),'Outro aviso');close();assert.equal(stack().hidden,true);
api.push({title:'Fonte JMA offline',type:'warning'});assert.equal(stack().hidden,true); // Persistent failures deduplicated.
api.push({title:'<script>unsafe</script>',type:'info'});assert.equal(title(),'<script>unsafe</script>');
api.openHistory();assert.equal(nodes.get('mobile-notice-history').open,true);
while(frames.length)frames.shift()();assert.equal(stack().props.get('--notice-bottom'),'230px');
body.classList.add('mobile-details-open');panel.rect.top=100;change();while(frames.length)frames.shift()();assert.equal(stack().parentNode,panel);
media.matches=false;change();while(frames.length)frames.shift()();assert.equal(api.enabled(),true);assert.equal(stack().parentNode,body);assert.equal(stack().children.length,1);
console.log('PASS: one notice on both screen sizes, priority, unseen queue lifetime, dismiss advances, deduplication, safe text, history and responsive positioning');
