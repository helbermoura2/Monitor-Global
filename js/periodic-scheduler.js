/* One wake-up for periodic work. Animation and event deadlines stay independent. */
(function(root){
  const jobs=new Map(),paused=new Set();let timer=null;
  const visible=()=>!document.hidden;
  const enabled=j=>visible()&&!paused.has(j.group);
  function arm(){
    if(timer!==null)clearTimeout(timer);timer=null;
    let due=Infinity;for(const j of jobs.values())if(enabled(j)&&!j.running)due=Math.min(due,j.due);
    if(Number.isFinite(due))timer=setTimeout(tick,Math.max(0,due-Date.now()));
  }
  function run(j){
    if(j.running||!enabled(j)||jobs.get(j.key)!==j)return;
    j.running=true;j.last=Date.now();j.due=j.last+j.interval;
    let result;try{result=j.fn();}catch(e){console.warn('[periodic]',j.key,e);}
    Promise.resolve(result).catch(e=>console.warn('[periodic]',j.key,e)).finally(()=>{
      j.running=false;
      // Slow requests never replay missed periods or spin immediately on completion.
      j.due=Math.max(j.due,Date.now()+Math.min(1000,j.interval));arm();
    });
  }
  function tick(){timer=null;const now=Date.now();for(const j of jobs.values())if(j.due<=now)run(j);arm();}
  function every(key,fn,delay,interval,group='feeds'){
    if(!(interval>0))throw Error('Periodic interval must be positive');
    const old=jobs.get(key);if(old&&old.fn===fn)return key;
    jobs.set(key,{key,fn,group,interval,due:Date.now()+Math.max(0,delay),running:false,last:null});arm();return key;
  }
  function stagger(group){
    const now=Date.now();let slot=0;
    for(const j of jobs.values())if((!group||j.group===group)&&j.due<=now&&!j.running){j.due=now+(j.group==='feeds'?slot++*750:0);}
  }
  function pause(group){paused.add(group);arm();}
  function resume(group){if(paused.delete(group))stagger(group);arm();}
  function trigger(key){const j=jobs.get(key);if(!j||j.running||(j.last!==null&&Date.now()-j.last<4000))return; j.due=Date.now();arm();}
  function cancel(key){jobs.delete(key);arm();}
  document.addEventListener('visibilitychange',()=>{if(visible())stagger();arm();});
  root.PeriodicScheduler={every,pause,resume,trigger,cancel};
})(window);
