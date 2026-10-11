import {states, municipalities} from './brazil-municipality-data.mjs';
export const BRAZIL_EPICENTER_VERSION = 'ibge-municipality-v1';

// Return 0 on a boundary: simplified polygons cannot safely resolve an edge.
function ringContains(ring, x, y) {
    let inside = false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const [ax,ay]=ring[j], [bx,by]=ring[i];
        const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
        if (Math.abs(cross)<1e-10 && x>=Math.min(ax,bx)-1e-10 && x<=Math.max(ax,bx)+1e-10 && y>=Math.min(ay,by)-1e-10 && y<=Math.max(ay,by)+1e-10) return 0;
        if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
    }
    return inside?1:-1;
}
export function geometryContains(geometry, lon, lat) {
    const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
    return polygons.some(rings=>ringContains(rings[0],lon,lat)===1 && rings.slice(1).every(r=>ringContains(r,lon,lat)===-1));
}

// Shared per isolate; never download municipality boundaries for non-Brazil events.
export function createBrazilLocator(fetcher=(...args)=>fetch(...args)) {
    const cache=new Map(),pending=new Map();
    async function boundaries(code) {
        const stored=cache.get(code);
        if(stored && stored.until>Date.now())return stored.data;
        if(pending.has(code))return pending.get(code);
        const task=(async()=>{
            let data=null;
            try {
                const response=await fetcher(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${code}?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio`,{signal:AbortSignal.timeout(5000)});
                if(!response.ok)throw new Error('IBGE unavailable');
                const body=await response.text();
                if(body.length>4000000)throw new Error('IBGE geometry too large');
                const parsed=JSON.parse(body);
                if(parsed.type==='FeatureCollection' && parsed.features?.length && parsed.features.every(f=>String(f.properties?.codarea||'').startsWith(code)&&municipalities[f.properties.codarea]&&['Polygon','MultiPolygon'].includes(f.geometry?.type)))data=parsed;
            }catch{}
            cache.delete(code);cache.set(code,{data,until:Date.now()+(data?86400000:60000)});
            while(cache.size>4)cache.delete(cache.keys().next().value);
            return data;
        })();
        pending.set(code,task);
        try{return await task;}finally{pending.delete(code);}
    }
    return async function locate(lat,lon){
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -34||lat>6||lon< -74||lon> -28)return null;
        const matches=states.features.filter(f=>geometryContains(f.geometry,lon,lat));
        if(matches.length!==1)return null;
        const code=String(matches[0].properties.codarea),data=await boundaries(code);
        const areas=(data?.features||[]).filter(f=>geometryContains(f.geometry,lon,lat));
        if(areas.length!==1)return null;
        const municipalityCode=String(areas[0].properties.codarea),[name,uf]=municipalities[municipalityCode];
        return {code:municipalityCode,name,uf,provider:'IBGE',lat,lon};
    };
}
export const locateBrazilEpicenter=createBrazilLocator();
export async function enrichBrazilEpicenter(event){
    // Re-check on coordinate revisions; source regional text must never override this name.
    if(event.epicenterMunicipality?.lat===event.lat&&event.epicenterMunicipality?.lon===event.lon){
        event.place=`${event.epicenterMunicipality.name}/${event.epicenterMunicipality.uf}, Brasil`;
        return event;
    }
    const location=await locateBrazilEpicenter(event.lat,event.lon);
    if(location){event.originalPlace=event.originalPlace||event.place;event.epicenterMunicipality=location;event.place=`${location.name}/${location.uf}, Brasil`;}
    else if(event.epicenterMunicipality){event.place=event.originalPlace||'Região não informada';delete event.epicenterMunicipality;}
    return event;
}
