/* Pixel-level antique bronze relief on live ArcGIS satellite tiles (M6+ only).
 * Coordinates remain source-derived. No pre-rendered Indonesian geography. */
export function tintBronzeMap(rgba,width,height){
 const pixels=width*height,land=new Uint8Array(pixels);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const n=y*width+x,i=n*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2];
  const ocean=b>g+10&&b>r+8;
  land[n]=ocean?0:1;
  const lum=(r*3+g*5+b*2)/10;
  const grain=((x*13+y*7)%19-9)*.48;
  const gain=(lum-70)*.25+grain;
  const base=ocean?[41,33,28]:[94,68,49];
  rgba[i]=Math.max(13,Math.min(205,base[0]+gain));
  rgba[i+1]=Math.max(11,Math.min(160,base[1]+gain*.85));
  rgba[i+2]=Math.max(10,Math.min(123,base[2]+gain*.7));
  rgba[i+3]=255;
 }
 // Subtle illuminated coast bevel from the same georeferenced pixel grid.
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
  const n=y*width+x;
  if(!land[n])continue;
  const left=n-2,up=n-2*width;
  if(!land[left]||!land[up]){
   const i=n*4;rgba[i]=Math.min(235,rgba[i]+54);rgba[i+1]=Math.min(185,rgba[i+1]+38);rgba[i+2]=Math.min(145,rgba[i+2]+24);
  }
 }
}
