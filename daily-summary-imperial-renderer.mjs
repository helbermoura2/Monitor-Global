// Daily PNG in the exact approved Greek/Roman composition.
// The ornamental backdrop is an offline miniature of the owner's approved art,
// with all variable regions cleaned. Numbers, flags, map and dates are live.
const NAVY=[3,20,34],GOLD=[218,166,95],CYAN=[53,228,245],WHITE=[245,236,220],MUTED=[178,201,208];
const BASE_W=900,BASE_H=1200,INSERT_Y=844;
function fitLabel(gfx,font,value,maxWidth){
 let s=String(value??'');
 while(s.length>2&&gfx.textWidth(font,s,0)>maxWidth)s=s.slice(0,-2)+'…';
 return s;
}
function fillTemplate(dst,W,H,asset,scale,extra){
 const sw=asset.width,sh=asset.height,src=asset.rgba,dw=W*scale;
 dst.summaryScale=scale;
 for(let y=0;y<H;y++){
  const inserted=extra>0&&y>=INSERT_Y&&y<INSERT_Y+extra;
  const iy=inserted?-1:(y>=INSERT_Y+extra?y-extra:y);
  const sy=inserted?0:Math.min(sh-1,Math.floor(iy*sh/BASE_H));
  for(let x=0;x<W;x++){
   const s=inserted?-1:((sy*sw+Math.min(sw-1,Math.floor(x*sw/W)))*4);
   const r=s<0?NAVY[0]:src[s],g=s<0?NAVY[1]:src[s+1],b=s<0?NAVY[2]:src[s+2];
   for(let yy=0;yy<scale;yy++){
    const pos=((y*scale+yy)*dw+x*scale)*4;
    for(let xx=0;xx<scale;xx++){const d=pos+4*xx;dst[d]=r;dst[d+1]=g;dst[d+2]=b;dst[d+3]=255;}
   }
  }
 }
}
export async function renderImperialDaily(quakes,fonts,gfx,helpers,{scale=1}={}){
 const {day,events}=quakes,W=BASE_W;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(events)||!fonts.approvedBackground)throw Error('Base oficial do boletim indisponível');
 if(![1,2].includes(scale))throw Error('Escala inválida');
 const top=events.filter(e=>Number.isFinite(e.mag)).slice().sort((a,b)=>b.mag-a.mag||a.time-b.time).slice(0,5);
 const brazil=events.filter(e=>e.brazil===true||Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&gfx.isBrazil?.(e.lat,e.lon)).sort((a,b)=>b.mag-a.mag||a.time-b.time);
 const extra=brazil.length?Math.min(6,brazil.length)*37+88:0,H=BASE_H+extra;
 const rgba=new Uint8Array(W*H*scale*scale*4);
 fillTemplate(rgba,W,H,fonts.approvedBackground,scale,extra);
 const {drawMap,summaryMapFrame,scaledIcon,line}=helpers;
 const text=(kind,s,x,y,color=WHITE)=>gfx.drawText(rgba,W,H,fonts[kind],gfx.clean(String(s),fonts[kind]),x,y,...color);
 const width=(kind,s)=>gfx.textWidth(fonts[kind],gfx.clean(String(s),fonts[kind]),0);
 const centered=(kind,s,x,y,color=WHITE)=>text(kind,s,x-width(kind,s)/2,y,color);
 const face=fonts.rajdhani;
 const brandWidth=(s,size)=>[...String(s)].reduce((n,ch)=>{const g=face.glyphs[ch]||face.glyphs['?'];return n+(g?.[2]||g?.[1]||16)*size/face.size;},0);
 const brand=(s,cx,y,size,color=GOLD,maxWidth=400)=>{
  let v=String(s),sized=size;
  while(sized>15&&brandWidth(v,sized)>maxWidth)sized-=1;
  if(brandWidth(v,sized)>maxWidth)v=fitLabel(gfx,fonts.title,v,maxWidth);
  let x=cx-brandWidth(v,sized)/2;
  for(const ch of v){
   const g=face.glyphs[ch]||face.glyphs['?'];if(!g)continue;
   const ratio=sized/face.size;
   scaledIcon(rgba,W,H,face.img,g[0],g[1],face.cellH,Math.round(x-(g[3]||0)*ratio),y,Math.max(1,Math.round(g[1]*ratio)),Math.max(1,Math.round(face.cellH*ratio)),color);
   x+=(g[2]||g[1])*ratio;
  }
 };
 const date=day.split('-').reverse().join('/');
 centered('title',date+' (BRT)',743,164,CYAN);
 const verbose=new Date(day+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).toLocaleUpperCase('pt-BR');
 text('small','· '+fitLabel(gfx,fonts.small,verbose,270),325,202,WHITE);
 const flag=(country,x,y,w=31,h=20)=>{
  if(country.code==='AQ')scaledIcon(rgba,W,H,fonts.aq,0,72,72,x,y,w,h);
  else if(country.code&&fonts.flags.map[country.code]){
   const [sx,sw,sh]=fonts.flags.map[country.code];
   scaledIcon(rgba,W,H,fonts.flags.img,sx,sw,sh,x,y,w,h);
  }
 };
 const rows=top.map(e=>{
  const country=gfx.country(e.place||''),place=gfx.place(e.place||'Local não informado');
  let label=place.title;
  if(place.title.includes(',')&&country.code){
   const end=place.title.split(',').pop().trim();
   if(gfx.country(end).code===country.code)label=place.title.slice(0,place.title.lastIndexOf(','));
  }
  return {event:e,country,place:{title:label}};
 });
 const mX=39,mY=244,mW=510,mH=280;
 const mapFrame=summaryMapFrame(top,mW,mH,{world:true});
 drawMap({rgba,W,H,gfx,fonts,text,center:centered,reference:true,items:rows},mX,mY,mapFrame);
 const num=m=>Number.isFinite(m)?m.toFixed(1).replace('.',','):'—';
 const time=e=>Number.isFinite(e.time)?new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):'—';
 const depth=e=>Number.isFinite(e.depth)?Math.round(e.depth)+' km':'—';
 const distance=e=>{
  if(!Number.isFinite(e.lat)||!Number.isFinite(e.lon))return '—';
  const deg=Math.PI/180,p1=-23.55*deg,p2=e.lat*deg,dp=(e.lat+23.55)*deg,dl=(e.lon+46.63)*deg;
  const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return Math.round(12742*Math.asin(Math.sqrt(Math.min(1,a)))).toLocaleString('pt-BR')+' km';
 };
 const main=rows[0];
 if(main){
  brand('M'+num(main.event.mag),743,291,76,GOLD,235);
  flag(main.country,614,399,44,29);
  text('title',fitLabel(gfx,fonts.title,main.place.title,163),667,396,WHITE);
  text('small',fitLabel(gfx,fonts.small,main.country.label,220),616,428,CYAN);
  text('columnLabel','PROFUNDIDADE',607,471,WHITE);
  text('columnLabel','HORA (BRT)',747,471,WHITE);
  text('title',depth(main.event),624,491,WHITE);
  text('detail',time(main.event),752,493,WHITE);
 }else{
  brand('SEM EVENTOS',743,315,34,GOLD,230);
 }
 // The four ranks (2–5), with bronze laurels, are part of the approved artwork.
 const rowCenters=[639,697,752,807];
 text('columnLabel','DISTÂNCIA',476,608,WHITE);
 text('columnLabel','HORA (BRT)',620,608,WHITE);
 text('columnLabel','PROF.',788,608,WHITE);
 for(let i=1;i<5;i++){
  const r=rows[i],cy=rowCenters[i-1];if(!r)continue;
  brand('M'+num(r.event.mag),172,cy-20,34,GOLD,104);
  text('title',fitLabel(gfx,fonts.title,r.place.title,210),242,cy-22,WHITE);
  flag(r.country,242,cy+3,27,17);
  text('detail',fitLabel(gfx,fonts.detail,r.country.label,175),278,cy+1,WHITE);
  text('detail',distance(r.event),475,cy-9,WHITE);
  text('detail',time(r.event),619,cy-9,WHITE);
  text('detail',depth(r.event),790,cy-9,WHITE);
 }
 const stats=[
  [events.length,CYAN],
  [events.filter(e=>e.mag>=6).length,[255,95,94]],
  [events.filter(e=>e.mag>=5&&e.mag<6).length,[255,170,70]],
  [events.filter(e=>e.mag>=4&&e.mag<5).length,[252,218,67]],
  [events.filter(e=>e.mag<4).length,[70,236,156]]
 ];
 const xs=[180,329,468,601,730],statsY=904+extra;
 for(let i=0;i<5;i++)brand(Number(stats[i][0]).toLocaleString('pt-BR'),xs[i],statsY,43,stats[i][1],132);
 // If a Brazilian event occurred, show it in a matching bronze inset rather
 // than suppressing it to imitate a day with no local earthquakes.
 if(extra){
  const y=INSERT_Y,panelH=extra-14;
  gfx.fillRoundRect(rgba,W,H,27,y+7,846,panelH,11,...GOLD);
  gfx.fillRoundRect(rgba,W,H,29,y+9,842,panelH-4,10,...NAVY);
  text('title','🇧🇷 SISMOS NO BRASIL · '+brazil.length,49,y+19,GOLD);
  for(let i=0;i<Math.min(6,brazil.length);i++){
   const e=brazil[i],by=y+57+i*37;
   brand('M'+num(e.mag),118,by-3,30,GOLD,105);
   text('detail',fitLabel(gfx,fonts.detail,gfx.place(e.place||'Brasil').title,368),182,by,WHITE);
   text('small',time(e)+' BRT',570,by+1,CYAN);
  }
  if(brazil.length>6)text('small','+'+(brazil.length-6)+' registros adicionais no Brasil',47,y+extra-20,MUTED);
 }
 return{
  day,top,total:events.length,brazilEvents:brazil,
  png:await gfx.png(rgba,W,H),
  design:'argos-orbis-approved-classical-art-v1',
  layout:{width:W*scale,height:H*scale,scale,splitH:530,rowsY:612,rowsEnd:836,totalsY:883+extra,totalsHeight:96,rowHeights:[56,56,56,56],brazilY:extra?INSERT_Y:null,brazilHeight:extra,mapX:mX,mapY:mY,mapW:mW,mapH:mH},
  epicenters:mapFrame.markers.map(({rank,id,lat,lon,x,y})=>({rank,id,lat,lon,x,y}))
 };
}
