// Keep the editorial layout in logical pixels; draw primitives and glyphs at 2x.
export function summaryGraphicsAtScale(gfx,scale){
 if(scale===1)return gfx;
 const dimensions=(fn,args,coords)=>{const a=[...args];for(const i of coords)a[i]*=scale;return fn(...a);};
 return {...gfx,
  fillRect:(...a)=>dimensions(gfx.fillRect,a,[1,2,3,4,5]),
  fillRoundRect:(...a)=>dimensions(gfx.fillRoundRect,a,[1,2,3,4,5,6,7]),
  fillCircle:(...a)=>dimensions(gfx.fillCircle,a,[1,2,3,4,5]),
  fillRadialGlow:(...a)=>dimensions(gfx.fillRadialGlow,a,[1,2,3,4,5]),
  drawArc:(...a)=>dimensions(gfx.drawArc,a,[1,2,3,4,5,6]),
  drawRadar:(...a)=>dimensions(gfx.drawRadar,a,[1,2,3,4,5]),
  drawText:(rgba,w,h,font,text,x,y,r,g,b,tracking=1)=>gfx.drawText(rgba,w*scale,h*scale,font.hd,text,x*scale,y*scale,r,g,b,tracking*scale),
  png:(rgba,w,h)=>gfx.png(rgba,w*scale,h*scale)
 };
}
