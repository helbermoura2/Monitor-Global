package top.monitorglobal.tv;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Friendly diagnostics for the existing, source-grounded Weather Briefing API.
 * Never interprets an AI response as a quake/tsunami warning or a measurement.
 */
final class WeatherAiStatus {
 private WeatherAiStatus(){}

 static boolean pending(String raw){
  try {
   if(raw==null||raw.length()>6000)return false;
   JSONObject data=new JSONObject(raw);
   return "weather-briefing-v1".equals(data.optString("version"))
    && "liberdade".equals(data.optString("area"))
    && "pending".equals(data.optString("status"));
  }catch(JSONException e){return false;}
 }

 static String describe(String raw,String kind,long now){
  String label="rain".equals(kind)?"CHUVA POR MINUTO":"TEMPO HORÁRIO";
  if(raw==null||raw.length()>6000)return label+"\nResposta ausente ou maior que o permitido. O monitoramento normal continua.";
  try {
   JSONObject data=new JSONObject(raw);
   if(!"weather-briefing-v1".equals(data.optString("version"))
      ||!"liberdade".equals(data.optString("area")))
    return label+"\nResposta não reconhecida. Nenhuma análise será apresentada.";
   String status=data.optString("status","");
   switch(status){
    case "ready":
     WeatherBriefing bulletin=WeatherBriefing.parse(raw,now);
     if(bulletin==null||!kind.equals(bulletin.kind))
      return label+"\nA análise recebida não está válida para este horário ou fonte. Nenhum texto será usado.";
     return label+" · INTERPRETAÇÃO DISPONÍVEL\n\n"+bulletin.text
       +"\n\nÁrea: Liberdade, São Paulo. Base: previsão meteorológica validada."
       +(bulletin.dataAt>0?"\nDados da fonte: "+WeatherForecast.time(bulletin.dataAt):"")
       +(bulletin.referenceAt>0&&bulletin.referenceAt!=bulletin.dataAt?
           "\nHorário de referência: "+WeatherForecast.time(bulletin.referenceAt):"")
       +"\nA IA escolhe interpretações; ela não mede o tempo nem emite alertas oficiais."
       +"\nEste diagnóstico não confirma que a previsão já foi exibida na TV.";
    case "pending":
     return label+"\nA análise está sendo preparada. A previsão normal continua aparecendo.";
    case "not_applicable":
     return label+"\nNão há nada relevante para acrescentar agora."
       +"\nIsso é esperado: a IA evita repetir temperatura, vento ou chuva já exibidos no cartão.";
    case "limited":
     return label+"\nA franquia de geração de IA chegou ao limite."
       +"\nOs avisos de terremoto, tsunami e a previsão meteorológica continuam independentes.";
    case "unavailable":
     return label+"\nA análise de IA está indisponível neste momento."
       +"\nPode ser falta de dados válidos, rede ou serviço; o boletim comum não depende dela.";
    default:
     return label+"\nNão foi possível confirmar um estado válido da IA. Os alertas permanecem independentes.";
   }
  }catch(JSONException e){
   return label+"\nA resposta não é um JSON válido. Nenhuma análise será apresentada.";
  }
 }
}
