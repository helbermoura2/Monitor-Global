/* ARGOS ORBIS — raster-safe eye mark for PNG renderers without SVG support.
   Based on the approved gold-eye/cyan-radar logo; only its compact silhouette
   is used where full Greek/Latin inscriptions cannot be legible. */
(function(root){
  function paint(p,x,y,r){
    if(!p||typeof p.arc!=='function'||typeof p.dot!=='function') return;
    const gold='#C4A16A',cyan='#1FCBC6',teal='#29E6D5';
    // Almond eye: two fixed gold curves, rendered into the raster image.
    const span=r*1.6,depth=r*.85;
    for(let i=0;i<=64;i++){
      const t=i/64,xx=(2*t-1)*span,yy=depth*(1-(2*t-1)**2);
      p.dot(x+xx,y-yy,Math.max(.55,r*.038),gold);
      p.dot(x+xx,y+yy,Math.max(.55,r*.038),gold);
    }
    // Fixed segmented radar rings and a single sweep; still images use a sample angle.
    for(const f of [.83,.57,.31]){
      p.arc(x,y,r*f,Math.max(.6,r*.036),0,360,cyan);
    }
    for(let a=0;a<360;a+=42)p.arc(x,y,r*.75,Math.max(.65,r*.09),a,21,teal);
    for(let a=0;a<360;a+=30)p.arc(x,y,r*.43,Math.max(.65,r*.055),a,14,cyan);
    const angle=Math.PI/4,px=x+Math.cos(angle)*r*.83,py=y+Math.sin(angle)*r*.83;
    const n=18;
    for(let i=1;i<=n;i++){
      const u=i/n;p.dot(x+(px-x)*u,y+(py-y)*u,Math.max(.8,r*.034),teal);
    }
    p.dot(x,y,Math.max(1.5,r*.16),'#98FFF1');
    p.dot(x,y,Math.max(1,r*.115),'#19D6C5');
  }
  function canvas(ctx,x,y,r){
    if(!ctx) return;
    ctx.save();
    const gold='#C4A16A',cyan='#1FCBC6';
    const eye=(upper)=>{ctx.beginPath();ctx.moveTo(x-r*1.6,y);ctx.quadraticCurveTo(x,y+(upper?-r*1.7:r*1.7),x+r*1.6,y);};
    ctx.strokeStyle=gold;ctx.lineWidth=Math.max(1,r*.075);eye(true);ctx.stroke();eye(false);ctx.stroke();
    ctx.strokeStyle=cyan;ctx.lineWidth=Math.max(1,r*.06);
    for(const f of [.83,.57,.31]){ctx.beginPath();ctx.arc(x,y,r*f,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);
    const grad=ctx.createLinearGradient(0,0,r*.83,r*.83);
    grad.addColorStop(0,'rgba(36,248,230,.08)');grad.addColorStop(1,'rgba(36,248,230,.55)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r*.83,-.30,.30);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#50FFF0';ctx.lineWidth=Math.max(1,r*.05);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(r*.83,0);ctx.stroke();ctx.restore();
    ctx.fillStyle='#2CDACA';ctx.beginPath();ctx.arc(x,y,r*.14,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  root.ArgosBrand={paint,canvas,markVersion:'argos-orbis-v1'};
})(globalThis);
