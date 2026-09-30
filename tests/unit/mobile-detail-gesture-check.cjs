const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class Classes{constructor(){this.s=new Set()}contains(c){return this.s.has(c)}add(c){this.s.add(c)}remove(c){this.s.delete(c)}toggle(c,on){on?this.add(c):this.remove(c)}}
const body={classList:new Classes()},styles=new Map();let handle,change;
const panel={style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},getBoundingClientRect:()=>({height:220}),prepend:h=>handle=h,scrollTop:20};
const media={matches:true,addEventListener:(k,fn)=>change=fn};
const doc={body,readyState:'complete',getElementById:()=>panel,createElement:()=>({events:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.events[k]=fn},setPointerCapture(){},hasPointerCapture(){return false}})};
const ctx={document:doc,window:{matchMedia:()=>media,innerHeight:800},MutationObserver:class{observe(){}},Date};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../js/mobile-detail-gesture.js'),'utf8'),ctx);
const event=(y,id=1)=>({clientY:y,pointerId:id,button:0,preventDefault(){},stopPropagation(){}});
function swipe(from,to){handle.events.pointerdown(event(from));handle.events.pointermove(event(to));handle.events.pointerup(event(to));}
swipe(300,230);assert(body.classList.contains('mobile-details-mid'));assert(!body.classList.contains('mg-sheet-dragging'));assert.equal(styles.size,0);
swipe(300,230);assert(body.classList.contains('mobile-details-open'));assert(!body.classList.contains('mobile-details-mid'));
swipe(230,300);assert(body.classList.contains('mobile-details-mid'));
swipe(230,400);assert(!body.classList.contains('mobile-details-mid'));assert(!body.classList.contains('mobile-details-open'));
swipe(300,295);assert(!body.classList.contains('mobile-details-mid'));
handle.events.pointerdown(event(300));handle.events.pointermove(event(230));handle.events.pointercancel();assert.equal(styles.size,0);assert(!body.classList.contains('mobile-details-mid'));
handle.events.keydown({key:'ArrowUp',preventDefault(){},stopPropagation(){}});assert(body.classList.contains('mobile-details-mid'));
media.matches=false;change();assert.equal(styles.size,0);
assert(!panel.events);console.log('PASS: three stages, short/long swipes, cancellation, keyboard, resize cleanup; no touch interception on scroll content');
