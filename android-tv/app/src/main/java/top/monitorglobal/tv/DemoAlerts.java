package top.monitorglobal.tv;
import java.util.*;
/** Local-only fictional cases; these never enter a server feed or the seen-event database. */
final class DemoAlerts {
 static List<Alert> create(String scenario,long now){
  Alert quake=new Alert("demo-quake","earthquake","demo","M7,2 · Vanuatu · EXEMPLO","Profundidade: 10 km · USGS","earthquake",now,now-60000,true);
  quake.source="USGS";quake.countryCode="VU";quake.magnitude=7.2;quake.depth=10;quake.tsunamiSummary="Aviso oficial · ondas perigosas possíveis · Costas de Vanuatu · EXEMPLO";
  Alert current=new Alert(quake.id,"earthquake","demo-revision","M6,9 · Vanuatu · EXEMPLO",quake.detail,quake.state,now,quake.eventTime,true);
  current.source=quake.source;current.countryCode="VU";current.magnitude=6.9;current.depth=10;current.tsunamiSummary=quake.tsunamiSummary;Alert revised=current.revised(7.2);
  Alert tsunami=new Alert("demo-tsunami","tsunami","demo-warning","Costas de Vanuatu · EXEMPLO","Aviso oficial · ondas perigosas possíveis · PTWC","warning",now,quake.eventTime,true);
  tsunami.source="PTWC";tsunami.relatedQuakeId=quake.id;tsunami.tsunamiSummary="Aviso para as costas de Vanuatu · EXEMPLO. Siga as orientações das autoridades locais.";
  Alert ended=new Alert(tsunami.id,"tsunami","demo-ended","Costas de Vanuatu · EXEMPLO","Aviso encerrado · PTWC","ended",now,quake.eventTime,false);
  ended.source="PTWC";ended.relatedQuakeId=quake.id;ended.tsunamiSummary="Encerramento somente para as costas de Vanuatu · EXEMPLO. Não encerra avisos de outras regiões.";
  switch(scenario){case "revision":return List.of(revised);case "tsunami":return List.of(tsunami);case "ended":return List.of(ended);case "sequence":return List.of(quake,tsunami,revised,ended);default:return List.of(quake);}
 }
}
