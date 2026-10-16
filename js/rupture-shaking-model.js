/* Published ShakeMap grid; no inferred fault direction. Shared with image exports. */
(function(root){
 'use strict';
 const minimumMmi=1.5;
 const colors=[[1,[46,118,190]],[2,[74,154,220]],[3,[102,192,239]],[4,[130,214,255]],[5,[85,242,15]],[6,[255,255,0]],[7,[255,200,0]],[8,[255,120,0]],[9,[255,0,0]],[10,[190,0,0]],[11,[130,0,0]],[12,[65,0,0]]];
 function color(mmi){let i=0;while(i<colors.length-2&&mmi>=colors[i+1][0])i++;const a=colors[i],b=colors[i+1],t=Math.max(0,Math.min(1,(mmi-a[0])/(b[0]-a[0])));return 'rgb('+a[1].map((v,j)=>Math.round(v+(b[1][j]-v)*t)).join(',')+')';}
 function valid(g){return g&&Number.isInteger(g.nx)&&Number.isInteger(g.ny)&&g.nx>=2&&g.ny>=2&&g.nx*g.ny<=60000&&[g.x0,g.x1,g.y0,g.y1].every(Number.isFinite)&&g.x1>g.x0&&g.x1-g.x0<=60&&g.y1>g.y0&&g.y0>=-90&&g.y1<=90&&g.y1-g.y0<=60&&Array.isArray(g.values)&&g.values.length===g.nx*g.ny&&g.values.every(v=>v===null||Number.isFinite(v)&&v>=0&&v<=12);}
 function normalize(d){const a=d?.domain?.axes,r=d?.ranges?.MMI;if(!d?.domain?.referencing?.some(r=>r.coordinates?.join(',')==='x,y'&&r.system?.type==='GeographicCRS'&&/\/CRS84$/.test(r.system.id||''))||d?.type!=='Coverage'||r?.axisNames?.join(',')!=='y,x'||r.shape?.join(',')!==[a?.y?.num,a?.x?.num].join(','))return null;const g={x0:a.x.start,x1:a.x.stop,nx:a.x.num,y0:a.y.start,y1:a.y.stop,ny:a.y.num,values:r.values};return valid(g)?g:null;}
 function sample(g,lng,lat){lng+=360*Math.round(((g.x0+g.x1)/2-lng)/360);const x=(lng-g.x0)/(g.x1-g.x0)*(g.nx-1),y=(lat-g.y0)/(g.y1-g.y0)*(g.ny-1);if(x<0||x>g.nx-1||y<0||y>g.ny-1)return null;const ix=Math.min(g.nx-2,Math.floor(x)),iy=Math.min(g.ny-2,Math.floor(y)),v=[g.values[iy*g.nx+ix],g.values[iy*g.nx+ix+1],g.values[(iy+1)*g.nx+ix],g.values[(iy+1)*g.nx+ix+1]];if(v.some(n=>n===null))return null;const tx=x-ix,ty=y-iy;return (v[0]*(1-tx)+v[1]*tx)*(1-ty)+(v[2]*(1-tx)+v[3]*tx)*ty;}
 // Surface projection of published finite-fault polygons. Never infer a
 // strike from magnitude, a place name, nodal planes or nearby earthquakes.
 function ruptureProjection(d,g){
  if(!valid(g)||d?.type!=='FeatureCollection'||!Array.isArray(d.features)||d.features.length>100)return null;
  const features=[];let count=0;
  for(const f of d.features){const geom=f?.geometry;if(!['Polygon','MultiPolygon'].includes(geom?.type))continue;
   const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
   if(!Array.isArray(polygons)||!polygons.length)return null;
   for(const p of polygons){if(!Array.isArray(p)||!p.length)return null;
    for(const r of p){if(!Array.isArray(r)||r.length<4)return null;const line=[];
     for(const v of r){if(++count>10000||!Array.isArray(v)||v.length<2||v.length>3||!v.every(Number.isFinite)||Math.abs(v[0])>360||Math.abs(v[1])>90)return null;
      const x=v[0]+360*Math.round(((g.x0+g.x1)/2-v[0])/360),y=v[1];
      if(x<g.x0-1||x>g.x1+1||y<g.y0-1||y>g.y1+1)return null;line.push([x,y]);
     }
     if(line[0][0]!==line.at(-1)[0]||line[0][1]!==line.at(-1)[1]||!line.some(v=>v[0]!==line[0][0]||v[1]!==line[0][1]))return null;
     features.push({type:'Feature',properties:{provider:'USGS',projection:true},geometry:{type:'LineString',coordinates:line}});
    }
   }
  }
  return features.length?{type:'FeatureCollection',features}:null;
 }
 function rectangles(g){
  const groups=new Map(),dx=(g.x1-g.x0)/(g.nx-1),dy=(g.y1-g.y0)/(g.ny-1);let previous=new Map();
  for(let y=0;y<g.ny;y++){const row=new Map();let x=0;while(x<g.nx){const value=g.values[y*g.nx+x],level=value===null||value<minimumMmi?0:Math.round(value*2)/2;let end=x+1;while(end<g.nx){const n=g.values[y*g.nx+end],l=n===null||n<minimumMmi?0:Math.round(n*2)/2;if(l!==level)break;end++;}if(level>=minimumMmi){const key=[level,x,end].join('|'),old=previous.get(key);if(old){old.top=Math.min(g.y1,g.y0+(y+.5)*dy);row.set(key,old);}else{const rect={left:Math.max(g.x0,g.x0+(x-.5)*dx),right:Math.min(g.x1,g.x0+(end-.5)*dx),bottom:Math.max(g.y0,g.y0+(y-.5)*dy),top:Math.min(g.y1,g.y0+(y+.5)*dy)};if(!groups.has(level))groups.set(level,[]);groups.get(level).push(rect);row.set(key,rect);}}x=end;}previous=row;}
  return groups;
 }
 function* bands(c,land){const g=c.shaking.grid,shifted=[];for(const p of land)for(const shift of [-360,0,360]){let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;for(const [x,y]of p[0]){w=Math.min(w,x+shift);e=Math.max(e,x+shift);s=Math.min(s,y);n=Math.max(n,y);}if(e>=g.x0&&w<=g.x1&&n>=g.y0&&s<=g.y1)shifted.push(p.map(r=>r.map(([x,y])=>[x+shift,y])));}if(!shifted.length)return;for(const [mmi,rows]of rectangles(c.shaking.grid)){const polygons=rows.map(r=>[[[r.left,r.bottom],[r.right,r.bottom],[r.right,r.top],[r.left,r.top],[r.left,r.bottom]]]);let merged=[];for(let i=0;i<polygons.length;i+=150)merged=polygonClipping.union(merged,...polygons.slice(i,i+150));const coordinates=polygonClipping.intersection(merged,shifted);if(coordinates.length)yield {type:'Feature',properties:{mmi,color:color(mmi),distanceKm:0,official:true},geometry:{type:'MultiPolygon',coordinates}};}}
 root.RuptureShakingModel={valid,normalize,sample,color,bands,minimumMmi,ruptureProjection};if(typeof module!=='undefined'&&module.exports)module.exports=root.RuptureShakingModel;
})(globalThis);
