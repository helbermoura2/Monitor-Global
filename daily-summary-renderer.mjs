import { SUMMARY_MAP_LAND } from './summary-editorial-assets.mjs';

const COLORS={bg:[2,16,31],white:[232,236,238],cyan:[152,231,232],muted:[149,172,187],line:[36,55,70],map:[2,16,31],land:[20,43,64],coast:[30,59,80]};
export const DAILY_SUMMARY_DESIGN='referencia-editorial-v3';
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
    const i=(y*w+x)*4;for(let c=0;c<3;c++)rgba[i+c]=rgba[i+c]*(1-alpha)+color[c]*alpha;rgba[i+3]=255;
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
function scaledIcon(rgba,w,h,image,sx,sw,sh,x,y,width,height){
    for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
        const px=Math.max(0,Math.min(sw-1,(dx+.5)*sw/width-.5)),py=Math.max(0,Math.min(sh-1,(dy+.5)*sh/height-.5)),lx=Math.floor(px),ly=Math.floor(py),fx=px-lx,fy=py-ly;
        let alpha=0;const color=[0,0,0];
        for(const [xx,wx] of [[lx,1-fx],[Math.min(sw-1,lx+1),fx]])for(const [yy,wy] of [[ly,1-fy],[Math.min(sh-1,ly+1),fy]]){const source=(yy*image.width+sx+xx)*4,a=image.rgba[source+3]/255*wx*wy;alpha+=a;for(let k=0;k<3;k++)color[k]+=image.rgba[source+k]*a;}
        if(alpha)pixel(rgba,w,h,x+dx,y+dy,color.map(c=>c/alpha),alpha);
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
        const color=COLORS.cyan,item=items[m.rank-1],names=reference&&item?[...gfx.wrap(fonts.small,item.place.title,124),...gfx.wrap(fonts.small,item.country.label,124)]:[];
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

export async function renderEditorialDailySummary(quakes,fonts,gfx){
 const {day,events}=quakes,W=900,X=29,CW=842;
 const top=events.slice().sort((a,b)=>b.mag-a.mag||a.time-b.time).slice(0,5);
 const measure=(key,s,tracking=0)=>gfx.textWidth(fonts[key],gfx.clean(s,fonts[key]),tracking);
 const wrap=(key,s,width)=>gfx.wrap(fonts[key],s,width);
 const km=value=>Number.isFinite(value)?Math.round(Math.max(0,value)).toLocaleString('pt-BR')+' km':'—';
 const distance=e=>{if(!Number.isFinite(e.lat)||!Number.isFinite(e.lon))return null;const rad=Math.PI/180,a=(e.lat+23.55)*rad,b=(e.lon+46.63)*rad,v=Math.sin(a/2)**2+Math.cos(-23.55*rad)*Math.cos(e.lat*rad)*Math.sin(b/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,v)));};
 const layouts=top.map(e=>{
  const country=gfx.country(e.place),place=gfx.place(e.place);
  if(country.label!=='EUA')country.label=country.label.toLocaleLowerCase('pt-BR').split(' ').map((w,i)=>i&&['de','do','da','dos','das','e'].includes(w)?w:w.charAt(0).toLocaleUpperCase('pt-BR')+w.slice(1)).join(' ');
  if(country.code&&place.title.includes(',')){const suffix=place.title.slice(place.title.lastIndexOf(',')+1).trim();if(suffix.toLocaleUpperCase('pt-BR')===country.label.toLocaleUpperCase('pt-BR')||gfx.country(suffix).code===country.code||/^(AK|CA|HI|NV|WA|OR|ID|UT|AZ|MT|WY|CO|NM|TX|OK|KS)$/.test(suffix))place.title=place.title.slice(0,place.title.lastIndexOf(','));}
  const when=Number.isFinite(e.time)?new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):'—';
  const names=[...wrap('title',place.title,164),...wrap('title',country.label,164)];
  return {event:e,country,place,when,depth:km(e.depth),distance:km(distance(e)),names,height:Math.max(92,28+names.length*(fonts.title.cellH+2))};
 });
 const first=layouts[0],heroNames=first?wrap('heroName',first.place.title,278):[],heroCountries=first?wrap('country',first.country.label,278):[];
 const extraHero=Math.max(0,(heroNames.length-1)*(fonts.heroName.cellH+4)+(heroCountries.length-1)*(fonts.country.cellH+3));
 const rowsY=760+extraHero,rowHeights=layouts.slice(1).map(l=>l.height),rowsEnd=rowsY+rowHeights.reduce((a,b)=>a+b,0);
 const totalsY=Math.max(1150+extraHero,rowsEnd+22),H=Math.max(1344,totalsY+194);
 const rgba=new Uint8Array(W*H*4);gfx.fillRect(rgba,W,0,0,W,H,...COLORS.bg);
 const text=(key,s,x,y,color=COLORS.white,tracking=0)=>gfx.drawText(rgba,W,H,fonts[key],gfx.clean(s,fonts[key]),x,y,...color,tracking);
 const center=(key,s,x,y,color=COLORS.white,tracking=0)=>text(key,s,x-measure(key,s,tracking)/2,y,color,tracking);
 const flag=(code,x,y)=>{if(code==='AQ')scaledIcon(rgba,W,H,fonts.aq,0,72,72,x,y,45,38);else if(fonts.flags.map[code]){const[sx,w,h]=fonts.flags.map[code];scaledIcon(rgba,W,H,fonts.flags.img,sx,w,h,x,y,45,30);}};
 const border=(x,y,w,h,r=11,color=COLORS.line)=>{gfx.fillRoundRect(rgba,W,H,x,y,w,h,r,...color);gfx.fillRoundRect(rgba,W,H,x+1,y+1,w-2,h-2,r-1,...COLORS.bg);};
 gfx.drawRadar(rgba,W,H,64,60,27,112,198,214);text('brand','MONITOR GLOBAL',113,51,COLORS.white,4.5);
 const edition='BOLETIM / '+day.split('-').reverse().join('/')+' / BRT';text('tag',edition,W-34-measure('tag',edition,1),52,COLORS.white,1);
 text('heading','Resumo sísmico',38,122);text('subtitle','diário',38,207);text('subtitle','.',38+measure('subtitle','diário'),207,COLORS.cyan);
 const date=new Date(day+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).toLocaleUpperCase('pt-BR');
 text('tag','ATIVIDADE SÍSMICA GLOBAL · '+date,38,313,COLORS.white,1.3);
 const frame=summaryMapFrame(top,575,390,{world:true});drawMap({rgba,W,H,gfx,text,center,fonts,reference:true,items:layouts},26,348,frame);
 const missing=top.length-frame.markers.length;if(missing)text('small',missing+' '+(missing===1?'registro sem coordenadas':'registros sem coordenadas'),38,725,COLORS.muted);
 const cx=714,cy=340;
 if(first){
  gfx.drawArc(rgba,W,H,cx,cy,156,1,0,360,34,62,77,120);
  // Continuous radial coverage avoids visible seams between short arc segments.
  for(let py=cy-164;py<=cy+164;py++)for(let px=cx-164;px<=cx+164;px++){
   const dx=px-cx,dy=py-cy,d=Math.abs(Math.hypot(dx,dy)-156),angle=Math.atan2(dy,dx)*180/Math.PI;
   if(angle< -90||angle>68||d>8)continue;
   const fade=Math.min(1,(68-angle)/33),edge=Math.max(0,Math.min(1,2-d));
   pixel(rgba,W,H,px,py,[89,220,231],Math.max(0,1-d/8)*.08*fade);
   if(edge)pixel(rgba,W,H,px,py,[144,242,239],edge*.82*fade);
  }
  flag(first.country.code,cx-22,218);center('tag','EVENTO PRINCIPAL',cx,279,COLORS.white,1.4);
  const magnitude='M '+first.event.mag.toFixed(1).replace('.',',');center('hero',magnitude,cx,306,COLORS.cyan);
  let yy=409;for(const s of heroNames){center('heroName',s,cx,yy);yy+=fonts.heroName.cellH+4;}
  yy+=5;for(const s of heroCountries){center('country',s,cx,yy,COLORS.cyan);yy+=fonts.country.cellH+3;}
  const metaY=Math.max(520,yy+24);line(rgba,W,H,624,metaY-9,829,metaY-9,COLORS.line);
  border(626,metaY+22,30,36,3,COLORS.muted);line(rgba,W,H,630,metaY+50,651,metaY+27,COLORS.muted);line(rgba,W,H,630,metaY+41,630,metaY+51,COLORS.muted);line(rgba,W,H,630,metaY+51,640,metaY+51,COLORS.muted);
  text('tag','PROFUNDIDADE',677,metaY+20,COLORS.white,1);text('caption',first.depth,677,metaY+44);
  gfx.drawArc(rgba,W,H,642,metaY+116,16,1.5,0,360,...COLORS.muted);line(rgba,W,H,642,metaY+106,642,metaY+116,COLORS.muted);line(rgba,W,H,642,metaY+116,652,metaY+121,COLORS.muted);
  text('tag','HORA (BRT)',677,metaY+98,COLORS.white,1);text('caption',first.when,677,metaY+122);
 }else{center('heroName','Sem sismos',cx,340,COLORS.cyan);center('caption','registrados no período',cx,395);}
 if(layouts.length>1)border(X,rowsY,CW,rowsEnd-rowsY);
 let rowY=rowsY;
 layouts.slice(1).forEach((l,i)=>{
  if(i)line(rgba,W,H,X+1,rowY,W-X-1,rowY,COLORS.line);
  const middle=rowY+l.height/2; border(47,middle-25,45,50,9,[97,156,168]);center('caption',String(i+2),69,middle-fonts.caption.cellH/2,COLORS.cyan);
  border(109,middle-25,102,50,19,[83,142,157]);center('magnitude','M'+l.event.mag.toFixed(1).replace('.',','),160,middle-fonts.magnitude.cellH/2,COLORS.cyan);
  let yy=middle-l.names.length*(fonts.title.cellH+2)/2;for(const name of l.names){text('title',name,230,yy);yy+=fonts.title.cellH+2;}
  for(const [x,label,value]of [[414,'DISTÂNCIA',l.distance],[541,'HORA',l.when+' BRT'],[688,'PROFUNDIDADE',l.depth]]){text('columnLabel',label,x,middle-26,COLORS.muted,.4);text('detail',value,x,middle-2);}
  flag(l.country.code,802,middle-15);rowY+=l.height;
 });
 const cells=[['EVENTOS HOJE',events.length],['M6,0 OU MAIS',events.filter(e=>e.mag>=6).length],['M5,0 – M5,9',events.filter(e=>e.mag>=5&&e.mag<6).length],['M4,0 – M4,9',events.filter(e=>e.mag>=4&&e.mag<5).length],['ABAIXO DE M4,0',events.filter(e=>e.mag<4).length]];
 border(X,totalsY,CW,140);
 cells.forEach(([label,count],i)=>{const x=X+CW/5*(i+.5);if(i)line(rgba,W,H,X+CW/5*i,totalsY+24,X+CW/5*i,totalsY+111,COLORS.line);center(i?'band':'total',count.toLocaleString('pt-BR'),x,totalsY+18,COLORS.cyan);center('tag',label,x,totalsY+91,COLORS.white);});
 text('small','Fonte: USGS · Dados sujeitos a revisão · Distâncias a São Paulo',X,H-30,COLORS.muted);
 const domain='monitorglobal.top';text('tag',domain,W-X-measure('tag',domain),H-31,COLORS.cyan);
 return {day,png:await gfx.png(rgba,W,H),top,total:events.length,layout:{width:W,height:H,splitH:435,rowsY,rowsEnd,totalsY,rowHeights},epicenters:frame.markers.map(({rank,id,lat,lon,x,y})=>({rank,id,lat,lon,x,y})),design:DAILY_SUMMARY_DESIGN};
}
