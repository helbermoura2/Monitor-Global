// Bounded local blur over the actual map pixels, with a translucent tint and curved top.
export function paintGlass(rgba,W,H,x,y,w,h,sx,sy,curve=false){
 x=Math.round(x*sx);y=Math.round(y*sy);w=Math.round(w*sx);h=Math.round(h*sy);const source=new Uint8Array(w*h*4);
 for(let j=0;j<h;j++)source.set(rgba.subarray(((y+j)*W+x)*4,((y+j)*W+x+w)*4),j*w*4);
 const radius=22*sy;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const top=curve?12*sy*(1+Math.sin(i/w*Math.PI*2)):0,yy=j-top,hh=h-top;if(yy<0)continue;
  const dx=Math.max(radius-i,0,i-(w-1-radius)),dy=Math.max(radius-yy,0,yy-(hh-1-radius));if(dx*dx+dy*dy>radius*radius)continue;
  const edge=(dx||dy)?Math.sqrt(dx*dx+dy*dy)>radius-1.4:yy<1.4||j>=h-2||i<2||i>=w-2;
  const dest=((y+j)*W+x+i)*4;if(dest<0||dest+3>=rgba.length)continue;
  for(let k=0;k<3;k++){let sum=0;for(const a of [-5,0,5])for(const b of [-5,0,5])sum+=source[(Math.max(0,Math.min(h-1,j+a))*w+Math.max(0,Math.min(w-1,i+b)))*4+k];const tint=[7,39,51][k],alpha=.77;rgba[dest+k]=edge?[103,197,209][k]:Math.round(sum/9*(1-alpha)+tint*alpha+Math.max(0,1-j/(h*.35))*13);}rgba[dest+3]=255;
 }
}
