/* Scene-local budgets: visual motion and event clocks never depend on quality. */
(function(){
 'use strict';
 const levels=[{name:'full',resolution:1,particles:1},{name:'balanced',resolution:.8,particles:.7},{name:'light',resolution:.6,particles:.45}];
 function create(mobile,hints=navigator){
  const limited=(hints.deviceMemory>0&&hints.deviceMemory<=2)||(hints.hardwareConcurrency>0&&hints.hardwareConcurrency<=2);
  let level=mobile||limited?1:0,since=null,total=0,slow=0,warmup=null;
  const arrays=[];
  const policy={
   get name(){return levels[level].name;},get resolution(){return levels[level].resolution;},
   fps(base){return mobile||level===2?Math.min(base,20):base;},
   reset(){since=warmup=null;total=slow=0;},
   count(n){return n?Math.max(1,Math.round(n*levels[level].particles)):0;},
   track(array){arrays.push({array,size:array.length});array.length=policy.count(array.length);return array;},
   sample(now,cost,gap,baseFps){
    // Ignore startup, tab suspension and hidden-card gaps. Require sustained load.
    if(warmup===null)warmup=now;
    if(gap>250){since=null;total=slow=0;warmup=now;return false;}
    if(now-warmup<1000||level===2)return false;
    if(since===null)since=now;
    const budget=1000/policy.fps(baseFps);
    total++;if(cost>budget*.65||gap>budget*1.8)slow++;
    if(now-since<1500||total<12)return false;
    const overloaded=slow/total>.55;since=now;total=slow=0;
    if(!overloaded)return false;
    level++;for(const {array,size} of arrays)array.length=Math.min(array.length,policy.count(size));
    warmup=now;return true;
   }
  };
  return policy;
 }
 window.CardEffectQuality={create};
})();
