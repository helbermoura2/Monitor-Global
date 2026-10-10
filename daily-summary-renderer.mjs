import { SUMMARY_MAP_LAND } from './summary-editorial-assets.mjs';

const COLORS={bg:[8,15,27],white:[237,244,247],cyan:[166,219,224],muted:[149,172,187],line:[36,55,70],map:[7,19,30],land:[23,49,71],coast:[56,94,121]};
export const DAILY_SUMMARY_DESIGN='observatorio-editorial-v1';
const mercator=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/360));
const normalizeLon=lon=>((lon%360)+360)%360;

// Cut the longitude circle at its largest empty arc, so +/-180 stays nearby.
export function summaryMapFrame(events,width=465,height=432){
    const points=events.flatMap((e,i)=>Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180?[{rank:i+1,id:e.id??null,lat:e.lat,lon:e.lon}]:[]);
    const sorted=points.map(e=>normalizeLon(e.lon)).sort((a,b)=>a-b);
    let start=0,gap=-1;
    sorted.forEach((x,i)=>{const next=sorted[(i+1)%sorted.length]+(i===sorted.length-1?360:0);if(next-x>gap){gap=next-x;start=next%360;}});
    const unwrap=lon=>{let x=normalizeLon(lon);if(x<start-1e-8)x+=360;return x;};
    const xs=points.map(e=>unwrap(e.lon)*Math.PI/180),ys=points.map(e=>mercator(e.lat));
    const minX=xs.length?Math.min(...xs):-Math.PI,maxX=xs.length?Math.max(...xs):Math.PI;
    const minY=ys.length?Math.min(...ys):-2,maxY=ys.length?Math.max(...ys):2;
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    let scale=Math.max((maxX-minX)/Math.max(1,width-116),(maxY-minY)/Math.max(1,height-112),.18/Math.min(width,height));
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
    return {width,height,cx,cy,scale,start,markers,labels,project,worldWidth:Math.min(width,Math.PI*2/scale)};
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
    const {rgba,W,H,gfx,text,center,fonts}=ctx,clip={x:x+(frame.width-frame.worldWidth)/2,y,w:frame.worldWidth,h:frame.height};
    gfx.fillRect(rgba,W,x,y,frame.width,clip.h,...COLORS.map);
    for(let lon=-180;lon<180;lon+=10){const p=frame.project(lon,0);if(p.x>0&&p.x<clip.w)line(rgba,W,H,x+p.x,y,x+p.x,y+clip.h-1,COLORS.coast,.2,clip);}
    for(let lat=-80;lat<=80;lat+=10){const p=frame.project(0,lat);if(p.y>0&&p.y<clip.h)line(rgba,W,H,x,y+p.y,x+clip.w-1,y+p.y,COLORS.coast,.2,clip);}
    for(const polygon of SUMMARY_MAP_LAND){
        const unwrapped=polygon.map(r=>{let previous=r[0][0];return r.map(([lon,lat])=>{while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;previous=lon;return[lon,lat];});});
        const mean=unwrapped[0].reduce((s,p)=>s+p[0],0)/unwrapped[0].length,shift=Math.round((frame.cx*180/Math.PI-mean)/360)*360;
        for(const copy of [-360,0,360]){
            const rings=unwrapped.map(r=>r.map(([lon,lat])=>[x+frame.width/2+((lon+shift+copy)*Math.PI/180-frame.cx)/frame.scale,y+clip.h/2-(mercator(lat)-frame.cy)/frame.scale]));
            const outer=rings[0],xs=outer.map(p=>p[0]),ys=outer.map(p=>p[1]);
            if(Math.max(...xs)<clip.x||Math.min(...xs)>=clip.x+clip.w||Math.max(...ys)<y||Math.min(...ys)>=y+clip.h)continue;
            fillPolygon(rgba,W,H,rings,COLORS.land,clip);
            for(const ring of rings)for(let i=1;i<ring.length;i++)line(rgba,W,H,...ring[i-1],...ring[i],COLORS.coast,.7,clip);
        }
    }
    // Country labels belong to their actual geographic locations, never event guesses.
    const countries=[['JAPÃO',136,31],['FILIPINAS',118,17],['ILHAS SALOMÃO',158,-17],['BRASIL',-53,-10],['CHILE',-75,-26],['PERU',-78,-8],['MÉXICO',-103,24],['INDONÉSIA',117,-7],['NOVA ZELÂNDIA',172,-43],['EUA',-104,39],['TURQUIA',35,40],['GRÉCIA',22,39]];
    for(const [name,lon,lat] of countries){const p=frame.project(lon,lat),tw=gfx.textWidth(fonts.small,name,1);if(p.x>=5&&p.x+tw<clip.w-5&&p.y>=8&&p.y<clip.h-18&&!frame.labels.some(q=>Math.hypot(q.x-(p.x+tw/2),q.y-p.y)<45))text('small',name,x+p.x,y+p.y,[104,152,174],1);}
    for(const m of frame.markers){
        const label=frame.labels.find(q=>q.rank===m.rank),color=m.rank===1?[143,227,220]:[126,181,204];
        if(m.rank===1){gfx.fillCircle(rgba,W,H,x+m.x,y+m.y,25,...color,13);gfx.drawArc(rgba,W,H,x+m.x,y+m.y,17,1,0,360,...color,90);}
        line(rgba,W,H,x+m.x,y+m.y,x+label.x,y+label.y,color,.75,clip);gfx.fillCircle(rgba,W,H,x+m.x,y+m.y,m.rank===1?4:2.5,...color);
        gfx.fillCircle(rgba,W,H,x+label.x,y+label.y,12,...color);if(m.rank!==1)gfx.fillCircle(rgba,W,H,x+label.x,y+label.y,10.5,...COLORS.map);
        center('country',String(m.rank),x+label.x,y+label.y-fonts.country.cellH/2,m.rank===1?COLORS.map:color);
    }
}

export async function renderEditorialDailySummary(quakes,fonts,gfx){
    const {day,events}=quakes,W=900,X=48,CW=804,MAP_W=465,HERO_X=527,HERO_W=325,MAP_Y=338;
    const top=events.slice().sort((a,b)=>b.mag-a.mag||a.time-b.time).slice(0,5);
    const measure=(key,s,tracking=0)=>gfx.textWidth(fonts[key],gfx.clean(s,fonts[key]),tracking);
    const wrap=(key,s,width)=>gfx.wrap(fonts[key],s,width);
    const layouts=top.map(e=>{
        const country=gfx.country(e.place),place=gfx.place(e.place);
        if(country.code&&place.title.includes(',')){const suffix=place.title.slice(place.title.lastIndexOf(',')+1).trim();if(suffix.toLocaleUpperCase('pt-BR')===country.label||gfx.country(suffix).code===country.code||/^(AK|CA|HI|NV|WA|OR|ID|UT|AZ|MT|WY|CO|NM|TX|OK|KS)$/.test(suffix))place.title=place.title.slice(0,place.title.lastIndexOf(','));}
        const when=Number.isFinite(e.time)?new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'Horário não informado';
        const depth=Number.isFinite(e.depth)?`${Math.round(Math.max(0,e.depth))} km de profundidade`:'Profundidade não informada';
        const names=wrap('title',place.title,490),detail=place.detail?wrap('detail',place.detail,490):[],meta=wrap('caption',when+' BRT · '+depth,490),countries=wrap('country',country.label,490);
        return {event:e,country,place,when,depth,names,detail,meta,countries,height:Math.max(128,24+countries.length*(fonts.country.cellH+3)+names.length*(fonts.title.cellH+3)+detail.length*(fonts.detail.cellH+2)+meta.length*(fonts.caption.cellH+2))};
    });
    const first=layouts[0],heroNames=first?wrap('heroName',first.place.title,HERO_W-44):[],heroCountries=first?wrap('country',first.country.label,HERO_W-44):[],heroDetail=first?.place.detail?wrap('caption',first.place.detail,HERO_W-44):[];
    const heroBottom=first?373+heroCountries.length*(fonts.country.cellH+3)+heroNames.length*(fonts.heroName.cellH+3)+heroDetail.length*(fonts.caption.cellH+3):470;
    const splitH=Math.max(470,heroBottom),mapHeight=splitH-37;
    const rowsY=MAP_Y+splitH+54,rowHeights=layouts.slice(1).map(l=>l.height),rowsEnd=rowsY+rowHeights.reduce((a,b)=>a+b,0);
    const H=Math.ceil(Math.max(1600,rowsEnd+226)),totalsY=Math.max(rowsEnd,H-226);
    const rgba=new Uint8Array(W*H*4);gfx.fillRect(rgba,W,0,0,W,H,...COLORS.bg);gfx.fillRadialGlow(rgba,W,H,260,180,520,28,47,66,.2);
    const text=(key,s,x,y,color=COLORS.white,tracking=0)=>gfx.drawText(rgba,W,H,fonts[key],gfx.clean(s,fonts[key]),x,y,...color,tracking);
    const center=(key,s,x,y,color=COLORS.white,tracking=0)=>text(key,s,x-measure(key,s,tracking)/2,y,color,tracking);
    const flag=(code,x,y)=>{if(code==='AQ')scaledIcon(rgba,W,H,fonts.aq,0,72,72,x,y,39,39);else if(fonts.flags.map[code]){const[sx,w,h]=fonts.flags.map[code];scaledIcon(rgba,W,H,fonts.flags.img,sx,w,h,x,y,45,30);}};
    const border=(x,y,w,h)=>{gfx.fillRoundRect(rgba,W,H,x,y,w,h,6,...COLORS.line);gfx.fillRoundRect(rgba,W,H,x+1,y+1,w-2,h-2,5,16,34,48);};
    gfx.drawRadar(rgba,W,H,68,60,19,159,213,219);text('brand','MONITOR GLOBAL',102,48,COLORS.white,2);
    text('tag','BOLETIM / '+day.split('-').reverse().join('/')+' / BRT',X,110,COLORS.muted,1.5);
    text('heading','Resumo',X,128);text('subtitle','sísmico diário.',X,208,COLORS.cyan);
    text('tag','00:00 — 23:59',X,298,COLORS.muted,1.4);
    const rankingTitle='OS CINCO MAIORES EVENTOS';text('small',rankingTitle,W-X-measure('small',rankingTitle,1.2),298,[146,197,207],1.2);
    border(X,MAP_Y,MAP_W,splitH);border(HERO_X,MAP_Y,HERO_W,splitH);
    const frame=summaryMapFrame(top,MAP_W-2,mapHeight-1);
    drawMap({rgba,W,H,gfx,text,center,fonts},X+1,MAP_Y+1,frame);
    const located=frame.markers.length,missing=top.length-located;
    const ranks=located===top.length&&located>1?'1–'+located:frame.markers.map(p=>p.rank).join(', ');
    const mapCaption=located?`EPICENTROS ${ranks} · USGS`:top.length?'COORDENADAS NÃO INFORMADAS':'SEM SISMOS NO PERÍODO';
    center('small',mapCaption,X+MAP_W/2,MAP_Y+splitH-(missing?34:28),COLORS.muted,.7);
    if(missing)center('small',`${missing} ${missing===1?'registro sem coordenadas':'registros sem coordenadas'}`,X+MAP_W/2,MAP_Y+splitH-18,COLORS.muted);
    const heroCenter=HERO_X+HERO_W/2;
    if(first){
        gfx.drawArc(rgba,W,H,heroCenter,MAP_Y+169,119,11,180,180,37,65,78);
        gfx.drawArc(rgba,W,H,heroCenter,MAP_Y+169,119,11,180,180*Math.min(1,Math.max(0,first.event.mag)/8),143,227,220,170);
        center('small','01 · MAIOR DO DIA',heroCenter,MAP_Y+79,[166,220,226],1.8);
        const mag=first.event.mag.toFixed(1).replace('.',','),mw=measure('hero',mag),mPrefix=measure('prefix','M');
        text('prefix','M',heroCenter-(mw+mPrefix+12)/2,MAP_Y+189,[179,238,231]);text('hero',mag,heroCenter-(mw+mPrefix+12)/2+mPrefix+12,MAP_Y+128,[179,238,231]);
        flag(first.country.code,heroCenter-22,MAP_Y+237);
        let yy=MAP_Y+279;for(const s of heroCountries){center('country',s,heroCenter,yy,[150,189,199],1);yy+=fonts.country.cellH+3;}
        yy+=6;for(const s of heroNames){center('heroName',s,heroCenter,yy);yy+=fonts.heroName.cellH+3;}
        yy+=8;for(const s of heroDetail){center('caption',s,heroCenter,yy,[177,199,207]);yy+=fonts.caption.cellH+3;}
        yy+=10;center('caption',first.when+' BRT',heroCenter,yy,COLORS.muted);yy+=fonts.caption.cellH+4;center('caption',first.depth,heroCenter,yy,COLORS.muted);
    }else{center('heroName','Sem sismos',heroCenter,MAP_Y+195,COLORS.cyan);center('caption','registrados no período',heroCenter,MAP_Y+243,COLORS.muted);}
    text('section','OUTROS DESTAQUES',X,rowsY-39,COLORS.cyan);
    const legend='Números correspondem ao mapa';text('small',legend,W-X-measure('small',legend),rowsY-40,COLORS.muted);
    let rowY=rowsY;
    layouts.slice(1).forEach((l,i)=>{
        gfx.fillRect(rgba,W,X,rowY,CW,1,...COLORS.line);
        gfx.fillRoundRect(rgba,W,H,X,rowY+l.height/2-15,37,30,5,26,50,69);center('small',String(i+2).padStart(2,'0'),X+18.5,rowY+l.height/2-fonts.small.cellH/2,[165,206,220]);
        text('magnitude','M'+l.event.mag.toFixed(1).replace('.',','),X+62,rowY+l.height/2-fonts.magnitude.cellH/2,[204,224,230]);
        let yy=rowY+14;const px=X+213;for(const s of l.countries){text('country',s,px,yy,[138,193,204],.7);yy+=fonts.country.cellH+3;}
        for(const s of l.names){text('title',s,px,yy);yy+=fonts.title.cellH+3;}
        for(const s of l.detail){text('detail',s,px,yy,[176,192,199]);yy+=fonts.detail.cellH+2;}
        for(const s of l.meta){text('caption',s,px,yy,COLORS.muted);yy+=fonts.caption.cellH+2;}
        flag(l.country.code,W-X-45,rowY+l.height/2-15);rowY+=l.height;
    });
    border(X,totalsY,CW,109);
    const total=events.length.toLocaleString('pt-BR'),totalW=measure('total',total);text('total',total,X+24,totalsY+13,[159,223,218]);
    const countLabel=events.length===1?'sismo no dia':'sismos no dia';for(const [i,s] of wrap('small',countLabel,76).entries())text('small',s,X+24+totalW+13,totalsY+38+i*(fonts.small.cellH+3),COLORS.muted);
    const bands=[['M6+',events.filter(e=>e.mag>=6).length],['M5–5,9',events.filter(e=>e.mag>=5&&e.mag<6).length],['M4–4,9',events.filter(e=>e.mag>=4&&e.mag<5).length],['Outros',events.filter(e=>e.mag<4).length]];
    bands.forEach(([name,count],i)=>{const bx=X+440+i*98;center('band',count.toLocaleString('pt-BR'),bx,totalsY+25);center('small',name,bx,totalsY+69,COLORS.muted);});
    center('small','Um dia de atividade sísmica, em cinco destaques.',W/2,totalsY+127,[128,152,172]);
    gfx.fillRect(rgba,W,X,H-71,CW,1,...COLORS.line);text('small','Fonte: USGS · Dados sujeitos a revisão',X,H-48,COLORS.muted);
    const domain='monitorglobal.top';text('country',domain,W-X-measure('country',domain),H-48,[182,214,223]);
    return {day,png:await gfx.png(rgba,W,H),top,total:events.length,layout:{width:W,height:H,splitH,rowsY,rowsEnd,totalsY,rowHeights},epicenters:frame.markers.map(({rank,id,lat,lon,x,y})=>({rank,id,lat,lon,x,y})),design:DAILY_SUMMARY_DESIGN};
}
