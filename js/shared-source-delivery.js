/* Preserve shared-response age. No global fetch replacement and no stored credentials. */
(function(root){'use strict';const rows=new Map();
const names={
 'www.nhc.noaa.gov':['NHC'],'www.gdacs.org':['GDACS vulcões','GDACS ciclones','GDACS enchentes','GDACS incêndios','GDACS tsunamis'],'eonet.gsfc.nasa.gov':['EONET tempestades','EONET incêndios'],
 'earthquake.usgs.gov':['USGS','USGS-REFORCO-GLOBAL'],'www.seismicportal.eu':['EMSC','EMSC-REFORCO-GLOBAL'],'geofon.gfz-potsdam.de':['GEOFON'],'webservices.ingv.it':['INGV'],'www.isc.ac.uk':['ISC'],'moho.iag.usp.br':['USP'],'www.jma.go.jp':['JMA'],'www.data.jma.go.jp':['JMA'],'api.geonet.org.nz':['GEONET'],'data.bmkg.go.id':['BMKG'],'www.osc.org.bo':['OSC-BOL'],'www.ovsicori.una.ac.cr':['OVSICORI'],'www.snet.gob.sv':['MARN-SV'],'ide.igp.gob.pe':['IGP'],'api.gael.cloud':['CSN-Chile'],'www.ssn.unam.mx':['SSN-Mexico'],'api.orhanaydogdu.com.tr':['AFAD'],'deprem-api.vercel.app':['AFAD'],'api.weather.gov':['NWS','NWS tsunami','NWS tornados'],'www.tsunami.gov':['PTWC boletins','NTWC boletins'],
 '/usgs-volcano':['USGS-Volcano'],'volcanoes.usgs.gov':['USGS-Volcano'],'/global-volcano':['VAAC-Global'],'/gdacs-volcano':['GDACS vulcões'],'/gdacs-floods':['GDACS enchentes'],'/official-weather-alerts:eccc':['ECCC Canadá'],'/official-weather-alerts:bom':['BOM'],'/cge-bulletins':['CGE boletins'],'/metar-observed':['NOAA METAR'],'/afad-earthquakes':['AFAD'],'/ingv-earthquakes':['INGV'],'/jma-earthquakes':['JMA'],'/funvisis-earthquakes':['FUNVISIS'],'/tsunami-alerts':['PTWC boletins','NTWC boletins'],'api.open-meteo.com':['OpenMeteo','Chuva SP · modelo (Open-Meteo)'],'servicos.cptec.inpe.br':['CPTEC']
};
function record(input,response){
 let u;try{u=new URL(typeof input==='string'?input:input.url,root.location?.href);if(u.searchParams.has('url'))u=new URL(u.searchParams.get('url'));}catch{return;}
 const group=response.headers.get('X-Monitor-Source')||u.hostname,product=group==='earthquake.usgs.gov'&&u.pathname.includes('/earthquakes/feed/')?'USGS-RT':null;
 const matched=product?[product]:names[group]||names[u.pathname]||[];
 const state=response.headers.get('X-Monitor-Source-State');
 if(!state){if(response.ok)for(const[k,row]of rows)if(row.names.some(n=>matched.includes(n)))rows.delete(k);return;}
 const at=Number(response.headers.get('X-Monitor-Source-Last-Ok'))||0,receivedAt=Date.now();
 rows.set(group+'|'+(product||u.pathname),{names:matched,state,at,attempt:Number(response.headers.get('X-Monitor-Source-Attempt'))||receivedAt,next:Number(response.headers.get('X-Monitor-Source-Next-Retry'))||0,receivedAt});
 if(rows.size>100)rows.delete(rows.keys().next().value);
}
function forName(name){return [...rows.values()].filter(x=>x.names.includes(name)&&Date.now()-x.receivedAt<30*60000).sort((a,b)=>b.receivedAt-a.receivedAt)[0]||null;}
const sharedHosts=new Set([...Object.keys(names).filter(k=>!k.startsWith('/')),'sws.cemaden.gov.br','www.gdacs.org','www.nhc.noaa.gov','apiprevmet3.inmet.gov.br','eonet.gsfc.nasa.gov','www.cgesp.org','feeds.meteoalarm.org','flood-api.open-meteo.com','air-quality-api.open-meteo.com']);
function shouldShare(input){try{const u=new URL(input);return sharedHosts.has(u.hostname)&&![...u.searchParams.keys()].some(k=>/key|token|auth|password|signature/i.test(k));}catch{return false;}}
root.SharedSourceDelivery={record,forName,shouldShare,fetch:async(input,options)=>{const r=await fetch(input,options);record(input,r);return r;}};
})(window);
