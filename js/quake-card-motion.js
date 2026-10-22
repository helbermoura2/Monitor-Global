/* Illustrative magnitude response, not an estimate of shaking at the reader. */
(function(root){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function profile(magnitude){
  const mag=clamp(Number(magnitude)||0,0,9.5),strength=clamp((mag-.5)/5.4,0,1);
  // Continuous progression through M5.9; stronger events remain bounded.
  const amplitude=mag<2?.08*mag:mag<4?.16+(mag-2)*.27:mag<6?.70+(mag-4)*.40:Math.min(2.8,1.50+(mag-6)*.45);
  const duration=mag<2?1.2:mag<4?1.8+(mag-2)*.35:mag<6?2.5+(mag-4)*.5:4+(mag-6)*.3;
  return {mag,strength,amplitude,duration,particles:mag<4?0:Math.round((mag-3)*3)};
 }
 function sample(magnitude,t){const p=profile(magnitude),age=Math.max(0,t),fade=age>=p.duration?0:Math.sin(Math.min(1,age/.12)*Math.PI/2)*Math.exp(-age*3/p.duration)*Math.min(1,(p.duration-age)/.35);return {...p,x:Math.sin(age*38)*p.amplitude*fade,y:Math.sin(age*31+.7)*p.amplitude*.45*fade,glow:fade*p.strength};}
 root.QuakeCardMotion={profile,sample};if(typeof module!=='undefined')module.exports=root.QuakeCardMotion;
})(globalThis);
