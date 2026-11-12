package top.monitorglobal.tv;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** On-screen status only; regional replay uses the same full-width seismic Banner with map. */
final class RegionalReplayDetails {
 private RegionalReplayDetails(){}
 static boolean eligible(Alert a){
  return a!=null&&a.compact&&"earthquake".equals(a.kind)
   &&Double.isFinite(a.magnitude)&&a.magnitude>=5&&a.magnitude<6
   &&Double.isFinite(a.depth)&&a.depth>=0&&a.depth<=70
   &&a.targetArea!=null&&!a.targetArea.isEmpty();
 }
 static String summary(Alert a){
  if(!eligible(a))return "Nenhum aviso M5+ real e elegível salvo nesta TV.";
  return String.format(Locale.forLanguageTag("pt-BR"),"M%.1f · %s · %.0f km",
    a.magnitude,a.targetArea,a.depth);
 }
 static String detail(Alert a){
  if(!eligible(a))return "Ainda não existe um aviso regional real M5,0–5,9 salvo neste aparelho. "
   +"O replay não busca sismos históricos e os testes fictícios não criam um registro. "
   +"A região, a magnitude e a profundidade (até 70 km) precisam atender às regras.";
  long at=a.eventTime>0?a.eventTime:a.issuedAt;
  SimpleDateFormat time=new SimpleDateFormat("dd/MM/yyyy 'às' HH:mm 'BRT'",Locale.forLanguageTag("pt-BR"));
  time.setTimeZone(TimeZone.getTimeZone("America/Sao_Paulo"));
  return summary(a)+"\n"+a.title+"\n"
   +"Evento original: "+(at>0?time.format(new Date(at)):"horário não informado")
   +"\nFonte: "+(a.provider!=null&&!a.provider.isEmpty()?a.provider:"não identificada")
   +"\nDuração: 15 segundos, sem som, começando após 10 segundos."
   +"\nA tarja sísmica REPLAY com mapa do epicentro aparece SOBRE o vídeo em reprodução."
   +"\nAvisos prioritários podem interromper a exibição.";
 }
}
