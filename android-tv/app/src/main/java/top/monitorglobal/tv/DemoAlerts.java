package top.monitorglobal.tv;
import java.util.*;
/** Local-only fictional cases; these never enter a server feed or the seen-event database. */
final class DemoAlerts {
 static List<Alert> create(String scenario,long now){
  Alert quake=new Alert("demo-quake","earthquake","demo","M7,2 · Vanuatu · EXEMPLO","Profundidade: 10 km · USGS","earthquake",now,now-60000,true);
  quake.originLongitude=165.55;quake.originLatitude=-14.06;quake.source="USGS";quake.countryCode="VU";quake.magnitude=7.2;quake.depth=10;quake.tsunamiSummary="Aviso oficial · ondas perigosas possíveis · Costas de Vanuatu · EXEMPLO";
  quake.populationSummary="População potencialmente exposta (estimativa fictícia): ~53.000 · Não é contagem de vítimas";
  quake.nearbySummary="Cidades de referência · DADOS FICTÍCIOS: Luganville 197 km; Port-Olry 210 km; Sola 240 km; Lakatoro 285 km; Port-Vila 390 km";
  Alert current=new Alert(quake.id,"earthquake","demo-revision","M6,9 · Vanuatu · EXEMPLO",quake.detail,quake.state,now,quake.eventTime,true);
  current.originLongitude=quake.originLongitude;current.originLatitude=quake.originLatitude;current.populationSummary=quake.populationSummary;current.nearbySummary=quake.nearbySummary;current.source=quake.source;current.countryCode="VU";current.magnitude=6.9;current.depth=10;current.tsunamiSummary=quake.tsunamiSummary;Alert revised=current.revised(7.2);
  Alert tsunami=new Alert("demo-tsunami","tsunami","demo-warning","Costas de Vanuatu · EXEMPLO","Aviso oficial · ondas perigosas possíveis · PTWC","warning",now,quake.eventTime,true);
  tsunami.source="PTWC";tsunami.relatedQuakeId=quake.id;tsunami.tsunamiSummary="Aviso para as costas de Vanuatu · EXEMPLO. Siga as orientações das autoridades locais.";
  Alert ended=new Alert(tsunami.id,"tsunami","demo-ended","Costas de Vanuatu · EXEMPLO","Aviso encerrado · PTWC","ended",now,quake.eventTime,false);
  ended.source="PTWC";ended.relatedQuakeId=quake.id;ended.tsunamiSummary="Encerramento somente para as costas de Vanuatu · EXEMPLO. Não encerra avisos de outras regiões.";
  Alert clear=new Alert(tsunami.id,"tsunami","demo-no-threat","Costas de Vanuatu · EXEMPLO","Sem ameaça segundo o boletim · PTWC","noThreat",now,quake.eventTime,true);
  clear.source="PTWC";clear.relatedQuakeId=quake.id;clear.tsunamiSummary="Sem ameaça para as costas de Vanuatu · EXEMPLO. Não descreve outras regiões.";clear.companion=current.copy();
  for(Alert a:List.of(tsunami,ended,clear)){a.originLongitude=quake.originLongitude;a.originLatitude=quake.originLatitude;}
  quake.companion=tsunami.copy();
  switch(scenario){case "revision":return List.of(revised);case "tsunami":return List.of(tsunami);case "ended":return List.of(ended);case "noThreat":return List.of(clear);case "sequence":return List.of(quake,revised,ended,clear);default:return List.of(quake);}
 }
}
