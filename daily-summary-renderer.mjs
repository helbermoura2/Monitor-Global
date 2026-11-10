import {summaryGraphicsAtScale} from './daily-summary-hd.mjs';
import { SUMMARY_MAP_LAND } from './summary-editorial-assets.mjs';

const COLORS={
 bg:[2,14,27],panel:[4,25,44],white:[240,248,255],cyan:[36,214,239],
 muted:[169,198,216],line:[28,77,100],map:[3,20,37],land:[14,59,82],
 coast:[35,131,170],green:[58,233,130],orange:[251,146,60]
};
export const DAILY_SUMMARY_DESIGN='monitor-global-rajdhani-neon-v7';
const mercator=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/360));
const normalizeLon=lon=>((lon%360)+360)%360;

// Cut the longitude circle at its largest empty arc, so +/-180 stays nearby.
export function summaryMapFrame(events,width=465,height=432,{world=false}={}){
    const points=events.flatMap((e,i)=>Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180?[{rank:i+1,id:e.id??null,lat:e.lat,lon:e.lon}]:[]);
    const sorted=points.map(e=>normalizeLon(e.lon)).sort((a,b)=>a-b);
    let start=0,gap=-1;
    sorted.forEach((x,i)=>{const next=sorted[(i+1)%sorted.length]+(i===sorted.length-1?360:0);if(next-x>gap){gap=next-x;start=next%360;}});
    if(world)start=180;
    const unwrap=lon=>{let x=normalizeLon(lon);if(x<start-1e-8)x+=360;return x;};
    const xs=points.map(e=>unwrap(e.lon)*Math.PI/180),ys=points.map(e=>mercator(e.lat));
    const minX=xs.length?Math.min(...xs):-Math.PI,maxX=xs.length?Math.max(...xs):Math.PI;
    const minY=ys.length?Math.min(...ys):-2,maxY=ys.length?Math.max(...ys):2;
    const low=world?Math.min(mercator(-60),minY):minY,high=world?Math.max(mercator(75),maxY):maxY;
    const cx=world?Math.PI*2:(minX+maxX)/2,cy=world?(low+high)/2:(minY+maxY)/2;
    let scale=Math.max((maxX-minX)/Math.max(1,width-116),(maxY-minY)/Math.max(1,height-112),.18/Math.min(width,height));
    if(world)scale=Math.max(Math.PI*2/(width-40),(high-low)/(height-50));
    const project=(lon,lat)=>{let x=unwrap(lon)*Math.PI/180;while(x-cx>Math.PI)x-=2*Math.PI;while(x-cx< -Math.PI)x+=2*Math.PI;return{x:width/2+(x-cx)/scale,y:height/2-(mercator(lat)-cy)/scale};};
    const markers=points.map(e=>({...e,...project(e.lon,e.lat)}));
    const labels=[];
    for(const marker of markers){
        const options=[[-34,24],[29,-25],[-34,-30],[32,30],[0,-36],[0,36],[42,0],[-42,0],[-52,-40],[52,40],[-52,40],[52,-40]];
        const chosen=options.map(([dx,dy],i)=>({x:Math.max(18,Math.min(width-18,marker.x+dx)),y:Math.max(18,Math.min(height-18,marker.y+dy)),preference:i})).sort((a,b)=>{
            const score=p=>labels.reduce((n,q)=>n+Math.max(0,34-Math.hypot(p.x-q.x,p.y-q.y))*100,0)+markers.reduce((n,q)=>n+Math.max(0,16-Math.hypot(p.x-q.x,p.y-q.y))*20,0)+p.preference;
            return score(a)-score(b);
        })[0];
        labels.push({rank:marker.rank,x:chosen.x,y:chosen.y});
    }
    return {width,height,cx,cy,scale,start,markers,labels,project,world,south:Math.min(-60,...points.map(p=>p.lat)),north:Math.max(75,...points.map(p=>p.lat)),worldWidth:Math.min(width,Math.PI*2/scale)};
}

function pixel(rgba,w,h,x,y,color,alpha=1){
    x=Math.round(x);y=Math.round(y);if(x<0||x>=w||y<0||y>=h)return;
    const scale=rgba.summaryScale||1;
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=((y*scale+dy)*w*scale+x*scale+dx)*4;for(let c=0;c<3;c++)rgba[i+c]=rgba[i+c]*(1-alpha)+color[c]*alpha;rgba[i+3]=255;}
}
function line(rgba,w,h,x1,y1,x2,y2,color,alpha=1,clip=null){
    let dx=x2-x1,dy=y2-y1;
    if(clip){
        let first=0,last=1;const ps=[-dx,dx,-dy,dy],qs=[x1-clip.x,clip.x+clip.w-1-x1,y1-clip.y,clip.y+clip.h-1-y1];
        for(let j=0;j<4;j++){if(ps[j]===0){if(qs[j]<0)return;continue;}const t=qs[j]/ps[j];if(ps[j]<0)first=Math.max(first,t);else last=Math.min(last,t);if(first>last)return;}
        x2=x1+dx*last;y2=y1+dy*last;x1+=dx*first;y1+=dy*first;dx=x2-x1;dy=y2-y1;
    }
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));
    for(let i=0;i<=steps;i++){const x=x1+dx*i/steps,y=y1+dy*i/steps;if(clip&&(x<clip.x||x>=clip.x+clip.w||y<clip.y||y>=clip.y+clip.h))continue;pixel(rgba,w,h,x,y,color,alpha);}
}
function fillPolygon(rgba,w,h,rings,color,clip){
    const edges=rings.flatMap(r=>r.slice(1).map((p,i)=>[r[i],p]));if(!edges.length)return;
    const y0=Math.max(clip.y,Math.floor(Math.min(...rings.flat().map(p=>p[1])))),y1=Math.min(clip.y+clip.h,Math.ceil(Math.max(...rings.flat().map(p=>p[1]))));
    for(let y=y0;y<y1;y++){
        const xs=[];for(const [[ax,ay],[bx,by]] of edges)if((ay<=y+.5&&by>y+.5)||(by<=y+.5&&ay>y+.5))xs.push(ax+(y+.5-ay)*(bx-ax)/(by-ay));xs.sort((a,b)=>a-b);
        for(let i=0;i+1<xs.length;i+=2){const x0=Math.max(clip.x,Math.ceil(xs[i])),x1=Math.min(clip.x+clip.w,Math.ceil(xs[i+1]));for(let x=x0;x<x1;x++)pixel(rgba,w,h,x,y,color);}
    }
}
function scaledIcon(rgba,w,h,image,sx,sw,sh,x,y,width,height,tint=null){
    for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
        const px=Math.max(0,Math.min(sw-1,(dx+.5)*sw/width-.5)),py=Math.max(0,Math.min(sh-1,(dy+.5)*sh/height-.5)),lx=Math.floor(px),ly=Math.floor(py),fx=px-lx,fy=py-ly;
        let alpha=0;const color=[0,0,0];
        for(const [xx,wx] of [[lx,1-fx],[Math.min(sw-1,lx+1),fx]])for(const [yy,wy] of [[ly,1-fy],[Math.min(sh-1,ly+1),fy]]){const source=(yy*image.width+sx+xx)*4,a=image.rgba[source+3]/255*wx*wy;alpha+=a;for(let k=0;k<3;k++)color[k]+=image.rgba[source+k]*a;}
        if(alpha)pixel(rgba,w,h,x+dx,y+dy,tint||color.map(c=>c/alpha),alpha);
    }
}

function drawMap(ctx,x,y,frame){
    const {rgba,W,H,gfx,text,center,fonts,reference=false,items=[]}=ctx,clip={x:x+(frame.width-frame.worldWidth)/2,y,w:frame.worldWidth,h:frame.height};
    if(reference&&frame.world){const top=frame.project(0,frame.north).y,bottom=frame.project(0,frame.south).y;clip.y=y+Math.max(0,top);clip.h=Math.min(frame.height,bottom)-Math.max(0,top);}
    gfx.fillRect(rgba,W,x,y,frame.width,frame.height,...COLORS.map);
    for(let lon=-180;lon<180;lon+=(reference?20:10)){const p=frame.project(lon,0);if(p.x>0&&p.x<clip.w)line(rgba,W,H,x+p.x,clip.y,x+p.x,clip.y+clip.h-1,COLORS.coast,.2,clip);}
    for(let lat=-80;lat<=80;lat+=(reference?20:10)){const p=frame.project(0,lat);if(p.y>0&&p.y<clip.h)line(rgba,W,H,x,y+p.y,x+clip.w-1,y+p.y,COLORS.coast,.2,clip);}
    for(const polygon of SUMMARY_MAP_LAND){
        const unwrapped=polygon.map(r=>{let previous=r[0][0];return r.map(([lon,lat])=>{while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;previous=lon;return[lon,lat];});});
        const mean=unwrapped[0].reduce((s,p)=>s+p[0],0)/unwrapped[0].length,shift=Math.round((frame.cx*180/Math.PI-mean)/360)*360;
        for(const copy of [-360,0,360]){
            const rings=unwrapped.map(r=>r.map(([lon,lat])=>[x+frame.width/2+((lon+shift+copy)*Math.PI/180-frame.cx)/frame.scale,y+frame.height/2-(mercator(lat)-frame.cy)/frame.scale]));
            const outer=rings[0],xs=outer.map(p=>p[0]),ys=outer.map(p=>p[1]);
            if(Math.max(...xs)<clip.x||Math.min(...xs)>=clip.x+clip.w||Math.max(...ys)<clip.y||Math.min(...ys)>=clip.y+clip.h)continue;
            fillPolygon(rgba,W,H,rings,COLORS.land,clip);
            for(const ring of rings)for(let i=1;i<ring.length;i++)line(rgba,W,H,...ring[i-1],...ring[i],COLORS.coast,.7,clip);
        }
    }
    // Country labels belong to their actual geographic locations, never event guesses.
    const countries=[['JAPÃO',136,31],['FILIPINAS',118,17],['ILHAS SALOMÃO',158,-17],['BRASIL',-53,-10],['CHILE',-75,-26],['PERU',-78,-8],['MÉXICO',-103,24],['INDONÉSIA',117,-7],['NOVA ZELÂNDIA',172,-43],['EUA',-104,39],['TURQUIA',35,40],['GRÉCIA',22,39]];
    for(const [name,lon,lat] of (reference?[]:countries)){const p=frame.project(lon,lat),tw=gfx.textWidth(fonts.small,name,1);if(p.x>=5&&p.x+tw<clip.w-5&&p.y>=8&&p.y<clip.h-18&&!frame.labels.some(q=>Math.hypot(q.x-(p.x+tw/2),q.y-p.y)<45))text('small',name,x+p.x,y+p.y,[104,152,174],1);}
    const placed=[];
    for(const m of frame.markers){
        const item=items[m.rank-1],color=item?gfx.magColor(item.event.mag):COLORS.cyan,names=reference&&item?[...gfx.wrap(fonts.small,item.place.title,124),...gfx.wrap(fonts.small,item.country.label,124)]:[];
        let label=frame.labels.find(q=>q.rank===m.rank);
        if(reference){
            const height=32+names.length*(fonts.small.cellH+2),options=[];
            for(const dy of [-45,35,-90,80,-145,130])for(const dx of [-40,35,-145,135,0,-220,-300]){
                const bx=Math.max(16,Math.min(frame.width-145,m.x+dx)),by=Math.max(16,Math.min(frame.height-height-4,m.y+dy));
                const box={x:bx-14,y:by-14,w:142,h:height+15};
                const overlap=placed.reduce((n,q)=>n+Math.max(0,Math.min(box.x+box.w,q.x+q.w)-Math.max(box.x,q.x))*Math.max(0,Math.min(box.y+box.h,q.y+q.h)-Math.max(box.y,q.y)),0);
                options.push({x:bx,y:by,box,score:overlap*100+Math.hypot(bx-m.x,by-m.y)});
            }
            label=options.sort((a,b)=>a.score-b.score)[0];placed.push(label.box);
        }
        gfx.fillCircle(rgba,W,H,x+m.x,y+m.y,25,...color,12);gfx.drawArc(rgba,W,H,x+m.x,y+m.y,18,1,0,360,...color,110);
        gfx.drawArc(rgba,W,H,x+m.x,y+m.y,12,1,0,360,...color,180);gfx.fillCircle(rgba,W,H,x+m.x,y+m.y,6,...color);
        line(rgba,W,H,x+m.x,y+m.y,x+label.x,y+label.y,color,.45,clip);
        gfx.fillCircle(rgba,W,H,x+label.x,y+label.y,14,...color,200);gfx.fillCircle(rgba,W,H,x+label.x,y+label.y,12.5,...COLORS.bg);
        center('small',String(m.rank),x+label.x,y+label.y-fonts.small.cellH/2,color);
        if(reference)names.forEach((name,i)=>text('small',name,x+label.x-12,y+label.y+18+i*(fonts.small.cellH+2),[183,211,219]));
    }
}

export async function renderEditorialDailySummary(quakes,fonts,gfx,{scale=1}={}){
 if(![1,2].includes(scale))throw Error('Escala inválida');
 gfx=summaryGraphicsAtScale(gfx,scale);
 const {day,events}=quakes,W=900,X=28,CW=844;
 const top=events.slice().sort((a,b)=>b.mag-a.mag||a.time-b.time).slice(0,5);
 const measure=(key,s,tracking=0)=>gfx.textWidth(fonts[key],gfx.clean(s,fonts[key]),tracking);
 const wrap=(key,s,width)=>gfx.wrap(fonts[key],s,width);
 const number=m=>Number.isFinite(m)?m.toFixed(1).replace('.',','):'—';
 const km=value=>Number.isFinite(value)?Math.round(Math.max(0,value)).toLocaleString('pt-BR')+' km':'—';
 const timeBrt=t=>Number.isFinite(t)?new Date(t).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):'—';
 // Distances displayed are the geodesic distance from the centre of São Paulo, never an estimated felt radius.
 const distance=e=>{if(!Number.isFinite(e.lat)||!Number.isFinite(e.lon))return null;const rad=Math.PI/180,a=(e.lat+23.55)*rad,b=(e.lon+46.63)*rad,v=Math.sin(a/2)**2+Math.cos(-23.55*rad)*Math.cos(e.lat*rad)*Math.sin(b/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,v)));};
 const layouts=top.map(e=>{
  const country=gfx.country(e.place||''),place=gfx.place(e.place||'Local não informado');
  if(country.label!=='EUA')country.label=country.label.toLocaleLowerCase('pt-BR').split(' ').map((w,i)=>i&&['de','do','da','dos','das','e'].includes(w)?w:w.charAt(0).toLocaleUpperCase('pt-BR')+w.slice(1)).join(' ');
  if(country.code&&place.title.includes(',')){
   const suffix=place.title.slice(place.title.lastIndexOf(',')+1).trim();
   if(suffix.toLocaleUpperCase('pt-BR')===country.label.toLocaleUpperCase('pt-BR')||gfx.country(suffix).code===country.code||/^(AK|CA|HI|NV|WA|OR|ID|UT|AZ|MT|WY|CO|NM|TX|OK|KS)$/.test(suffix))place.title=place.title.slice(0,place.title.lastIndexOf(','));
  }
  const names=[...wrap('title',place.title,215),...wrap('title',country.label,215)];
  return {event:e,color:gfx.magColor(e.mag),country,place,when:timeBrt(e.time),depth:km(e.depth),distance:km(distance(e)),names,height:Math.max(88,22+names.length*(fonts.title.cellH+1))};
 });
 const first=layouts[0],rowsY=724,rowHeights=layouts.slice(1).map(l=>l.height);
 const rowsEnd=rowsY+Math.max(72,rowHeights.reduce((a,b)=>a+b,0));
 const brazil=events.filter(e=>e.brazil===true||Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&gfx.isBrazil?.(e.lat,e.lon)).sort((a,b)=>b.mag-a.mag||a.time-b.time);
 const brazilRows=brazil.map(e=>({event:e,names:wrap('detail',gfx.place(e.place||'Local não informado').title,310)}));
 const brazilY=Math.max(1115,rowsEnd+25);
 const brazilHeight=brazilRows.length?64+brazilRows.reduce((sum,r)=>sum+Math.max(64,24+r.names.length*(fonts.detail.cellH+3)),0)+13:0;
 const totalsY=brazilY+(brazilHeight?brazilHeight+22:0);
 const H=Math.max(1440,totalsY+275);
 const rgba=new Uint8Array(W*H*4*scale*scale);rgba.summaryScale=scale;
 gfx.fillRect(rgba,W,0,0,W,H,...COLORS.bg);
 const text=(key,str,x,y,color=COLORS.white,tracking=0)=>gfx.drawText(rgba,W,H,fonts[key],gfx.clean(str,fonts[key]),x,y,...color,tracking);
 const center=(key,str,x,y,color=COLORS.white,tracking=0)=>text(key,str,x-measure(key,str,tracking)/2,y,color,tracking);
 const face=fonts.rajdhani;
 if(!face||!face.glyphs||!face.img)throw Error('Rajdhani Bold do Monitor Global indisponível');
 const brandWidth=(str,size)=>[...String(str)].reduce((sum,ch)=>{const g=face.glyphs[ch]||face.glyphs['?'];return sum+(g?.[2]||g?.[1]||16)*size/face.size;},0);
 const fitBrand=(str,size,maxWidth)=>{
  let value=String(str??''),adjusted=size;
  while(brandWidth(value,adjusted)>maxWidth&&adjusted>13)adjusted-=1;
  if(brandWidth(value,adjusted)>maxWidth){
   while(value.length>3&&brandWidth(value+'...',adjusted)>maxWidth)value=value.slice(0,-1);
   value+='...';
  }
  return {value,size:adjusted};
 };
 const brand=(str,x,y,size,color=COLORS.white,maxWidth=W-x)=>{
  const fitted=fitBrand(str,size,maxWidth);let cursor=x,ratio=fitted.size/face.size;
  for(const ch of fitted.value){const g=face.glyphs[ch]||face.glyphs['?'];if(!g)continue;
   const gw=Math.max(1,Math.round(g[1]*ratio)),gh=Math.max(1,Math.round(face.cellH*ratio));
   scaledIcon(rgba,W,H,face.img,g[0],g[1],face.cellH,Math.round(cursor-(g[3]||0)*ratio),Math.round(y),gw,gh,color);
   cursor+=(g[2]||g[1])*ratio;
  }return cursor-x;
 };
 const centerBrand=(str,cx,y,size,color=COLORS.white,maxWidth=400)=>{
  const fitted=fitBrand(str,size,maxWidth);
  brand(fitted.value,cx-brandWidth(fitted.value,fitted.size)/2,y,fitted.size,color,maxWidth);
 };
 const wrapBrand=(str,width,size,maxLines=2)=>{
  const words=String(str||'').split(/\s+/).filter(Boolean),rows=[];let lineText='';
  for(const word of words){const next=lineText?lineText+' '+word:word;if(lineText&&brandWidth(next,size)>width){rows.push(lineText);lineText=word;}else lineText=next;}
  if(lineText)rows.push(lineText);
  if(rows.length>maxLines){rows.length=maxLines;let last=rows[maxLines-1];while(last.length>2&&brandWidth(last+'...',size)>width)last=last.slice(0,-1);rows[maxLines-1]=last+'...';}
  return rows;
 };
 const flag=(code,x,y,w=45,h=30)=>{if(code==='AQ')scaledIcon(rgba,W,H,fonts.aq,0,72,72,x,y,w,h);
  else if(code&&fonts.flags.map[code]){const[sx,fw,fh]=fonts.flags.map[code];scaledIcon(rgba,W,H,fonts.flags.img,sx,fw,fh,x,y,w,h);}
 };
 const border=(x,y,w,h,r=12,color=COLORS.cyan,background=COLORS.panel)=>{
  gfx.fillRoundRect(rgba,W,H,x,y,w,h,r,...color);
  gfx.fillRoundRect(rgba,W,H,x+2,y+2,w-4,h-4,Math.max(1,r-2),...background);
 };
 const waveform=(x,y,color=COLORS.cyan,size=1)=>{
  const points=[[0,12],[12,12],[17,4],[21,20],[25,0],[29,25],[34,10],[41,12],[56,12]];
  for(let i=1;i<points.length;i++)line(rgba,W,H,x+points[i-1][0]*size,y+points[i-1][1]*size,x+points[i][0]*size,y+points[i][1]*size,color);
 };
 // Brand masthead, radar and subtle globe outline use the same TV palette.
 gfx.fillRadialGlow(rgba,W,H,674,34,190,17,97,143,.18);
 gfx.drawRadar(rgba,W,H,64,59,28,35,210,239);
 const brandX=117,monitor='MONITOR',global=' GLOBAL';
 brand(monitor,brandX,36,37,COLORS.white,200);
 brand(global,brandX+brandWidth(monitor,37)+3,36,37,COLORS.cyan,195);
 text('tag','SISMOS · VULCÕES · CICLONES · ALERTAS',117,87,COLORS.muted,.3);
 border(691,26,181,77,12,COLORS.cyan,COLORS.panel);
 centerBrand('BOLETIM DIÁRIO',782,34,23,COLORS.white,170);
 centerBrand(day.split('-').reverse().join('/')+' (BRT)',782,66,22,COLORS.cyan,172);
 line(rgba,W,H,29,124,870,124,COLORS.cyan,.85);
 waveform(30,155,COLORS.cyan,1.25);
 brand('RESUMO SÍSMICO',113,148,54,COLORS.white,550);
 brand('DIÁRIO',113+brandWidth('RESUMO SÍSMICO',54)+14,148,54,COLORS.cyan,230);
 const date=new Date(day+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).toLocaleUpperCase('pt-BR');
 text('tag','ATIVIDADE SÍSMICA GLOBAL · '+date,117,213,COLORS.muted,.7);

 // True geographic data: all five markers come from the original queried coordinates.
 const mapX=32,mapY=275,mapW=543,mapH=356;
 border(mapX-3,mapY-3,mapW+6,mapH+6,14,COLORS.cyan,COLORS.map);
 const frame=summaryMapFrame(top,mapW,mapH,{world:true});
 drawMap({rgba,W,H,gfx,text,center,fonts,reference:true,items:layouts},mapX,mapY,frame);
 line(rgba,W,H,mapX,mapY,mapX+mapW,mapY,COLORS.cyan,.65);
 const missing=top.length-frame.markers.length;
 if(missing)text('small',missing+(missing===1?' registro sem coordenadas':' registros sem coordenadas'),mapX+9,mapY+mapH-28,COLORS.muted);

 // The hero is a separate dark LED-style module rather than a circle overlapping the world map.
 const hx=600,hy=272,hw=273,hh=362,accent=first?first.color:COLORS.cyan;
 gfx.fillRadialGlow(rgba,W,H,hx+hw/2,hy+123,154,...accent,.15);
 border(hx,hy,hw,hh,15,accent,COLORS.panel);
 gfx.fillRoundRect(rgba,W,H,hx+9,hy+10,hw-18,45,8,...(first?gfx.magColor(first.event.mag):COLORS.line));
 gfx.fillRect(rgba,W,hx+11,hy+12,hw-22,41,...COLORS.bg);
 centerBrand('EVENTO PRINCIPAL',hx+hw/2,hy+20,24,accent,hw-25);
 if(first){
  centerBrand('M'+number(first.event.mag),hx+hw/2,hy+72,91,accent,hw-20);
  line(rgba,W,H,hx+15,hy+178,hx+hw-15,hy+178,COLORS.line,.95);
  flag(first.country.code,hx+18,hy+202,45,30);
  const heroName=wrapBrand(first.place.title,194,26,2);
  heroName.forEach((label,i)=>brand(label,hx+73,hy+197+i*29,26,COLORS.white,hw-85));
  brand(first.country.label,hx+18,hy+263,20,COLORS.cyan,hw-35);
  line(rgba,W,H,hx+15,hy+296,hx+hw-15,hy+296,COLORS.line,.9);
  text('columnLabel','PROFUNDIDADE',hx+18,hy+307,COLORS.muted);
  text('title',first.depth,hx+18,hy+329,COLORS.white);
  line(rgba,W,H,hx+134,hy+306,hx+134,hy+354,COLORS.line,.9);
  text('columnLabel','HORA (BRT)',hx+145,hy+307,COLORS.muted);
  text('detail',first.when,hx+145,hy+331,COLORS.white);
 }else{
  centerBrand('SEM REGISTROS',hx+hw/2,hy+130,31,COLORS.cyan,hw-28);
  center('small','Não há eventos disponíveis',hx+hw/2,hy+207,COLORS.muted);
 }

 // A fixed cyan section heading and adaptive row heights prevent long placenames from colliding with columns.
 border(X,661,CW,51,13,COLORS.cyan,COLORS.panel);
 waveform(X+19,677,COLORS.cyan,.88);
 brand('PRINCIPAIS EVENTOS DO DIA',X+88,671,31,COLORS.white,710);
 if(layouts.length>1)border(X,rowsY,CW,rowsEnd-rowsY,11,COLORS.cyan,COLORS.panel);
 else border(X,rowsY,CW,72,11,COLORS.line,COLORS.panel);
 let rowY=rowsY;
 layouts.slice(1).forEach((l,i)=>{
  if(i)line(rgba,W,H,X+2,rowY,X+CW-2,rowY,COLORS.line,.82);
  const middle=rowY+l.height/2;
  border(X+15,middle-21,44,42,8,COLORS.orange,COLORS.bg);
  centerBrand(String(i+2),X+37,middle-18,36,COLORS.orange,40);
  border(X+74,middle-22,110,44,9,l.color,COLORS.bg);
  centerBrand('M'+number(l.event.mag),X+129,middle-18,34,l.color,104);
  let yy=middle-l.names.length*(fonts.title.cellH+1)/2;
  for(const name of l.names){text('title',name,X+199,yy,COLORS.white);yy+=fonts.title.cellH+1;}
  for(const [px,label,value] of [[X+450,'DISTÂNCIA',l.distance],[X+575,'HORA (BRT)',l.when],[X+719,'PROF.',l.depth]]){
   text('columnLabel',label,px,middle-24,COLORS.muted);
   text('detail',value,px,middle-1,COLORS.white);
  }
  rowY+=l.height;
 });
 if(layouts.length<=1)brand('Sem outros eventos no período',X+32,rowsY+18,23,COLORS.muted,CW-64);

 // Brazilian events remain separately visible even when their magnitude is below the global top five.
 if(brazil.length){
  border(X,brazilY,CW,brazilHeight,12,COLORS.green,COLORS.panel);
  flag('BR',X+18,brazilY+12,47,30);
  brand('SISMOS NO BRASIL · '+brazil.length,X+83,brazilY+10,34,COLORS.white,600);
  line(rgba,W,H,X+2,brazilY+54,X+CW-2,brazilY+54,COLORS.cyan,.63);
  let y=brazilY+66;
  for(const {event:e,names} of brazilRows){
   const height=Math.max(64,24+names.length*(fonts.detail.cellH+3));
   if(y>brazilY+66)line(rgba,W,H,X+15,y,X+CW-15,y,COLORS.line,.75);
   border(X+14,y+8,128,47,10,COLORS.green,COLORS.bg);
   centerBrand('M'+number(e.mag),X+78,y+11,38,COLORS.green,120);
   names.forEach((name,i)=>text('detail',name,X+163,y+6+i*(fonts.detail.cellH+3),COLORS.white));
   text('small',timeBrt(e.time)+' BRT',X+544,y+9,COLORS.white);
   text('small',km(e.depth),X+680,y+9,COLORS.muted);
   const sources=(e.sources||[e.source||'Fonte não informada']).filter(Boolean).join(' · ');
   text('small',sources,X+544,y+31,COLORS.muted);
   y+=height;
  }
 }
 const bands=[
  ['EVENTOS NO DIA',events.length,COLORS.cyan],
  ['M6,0 OU MAIS',events.filter(e=>e.mag>=6).length,[255,91,93]],
  ['M5,0 – M5,9',events.filter(e=>e.mag>=5&&e.mag<6).length,COLORS.orange],
  ['M4,0 – M4,9',events.filter(e=>e.mag>=4&&e.mag<5).length,[255,216,52]],
  ['ABAIXO DE M4,0',events.filter(e=>e.mag<4).length,COLORS.green]
 ];
 border(X,totalsY,CW,145,12,COLORS.cyan,COLORS.panel);
 bands.forEach(([label,count,color],i)=>{
  const w=CW/5,cx=X+w*(i+.5);
  if(i)line(rgba,W,H,X+w*i,totalsY+21,X+w*i,totalsY+126,COLORS.line);
  waveform(cx-25,totalsY+20,color,.85);
  centerBrand(count.toLocaleString('pt-BR'),cx,totalsY+63,51,color,w-12);
  center('columnLabel',label,cx,totalsY+116,COLORS.white);
 });
 const footerY=H-48;line(rgba,W,H,X,footerY-23,W-X,footerY-23,COLORS.line,.9);
 const allSources=[...new Set(['USGS',...brazil.flatMap(e=>e.sources||[e.source].filter(Boolean))])];
 const sourceLine='Fontes: '+allSources.join(' · ')+' · Dados sujeitos a revisão';
 const sourceWidth=Math.max(280,W-415-X);
 let safeSources=sourceLine;
 while(safeSources.length>12&&measure('small',safeSources)>sourceWidth)safeSources=safeSources.slice(0,-5)+'...';
 text('small',safeSources,X,footerY,COLORS.muted);
 text('small','monitorglobal.top',W-382,footerY,COLORS.white);
 text('small','@monitor_global',W-190,footerY,COLORS.cyan);
 text('small','Distâncias a São Paulo, SP',X,footerY-40,COLORS.muted);
 return {
  day,png:await gfx.png(rgba,W,H),top,total:events.length,brazilEvents:brazil,
  layout:{width:W*scale,height:H*scale,scale,splitH:470,rowsY,rowsEnd,totalsY,rowHeights,brazilY,brazilHeight,mapX,mapY,mapW,mapH},
  epicenters:frame.markers.map(({rank,id,lat,lon,x,y})=>({rank,id,lat,lon,x,y})),
  design:DAILY_SUMMARY_DESIGN
 };
}
