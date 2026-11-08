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

 private static String reason(String reason){
  switch(reason){
   case "source-unavailable":
    return "Origem: a previsão meteorológica não chegou em formato válido ao serviço de IA. Aguarde uma nova atualização dos dados.";
   case "source-stale-or-invalid":
    return "Origem: a previsão existe, mas está vencida ou incompleta para esta análise. A IA não usa dados incertos.";
   case "model-unconfigured":
    return "Origem: o motor de IA não está configurado no servidor. É necessário corrigir a configuração do serviço, não a TV.";
   case "model-error":
    return "Origem: o modelo de IA falhou ao processar os dados. O servidor limita novas tentativas por alguns minutos.";
   case "model-timeout":
    return "Origem: o modelo não concluiu a análise no limite de tempo. Tente novamente após alguns minutos.";
   case "invalid-selection":
    return "Origem: o modelo respondeu fora das regras de segurança. O texto foi rejeitado para evitar informações inventadas.";
   case "storage-unavailable":
    return "Origem: o armazenamento compartilhado da IA está temporariamente indisponível.";
   case "service-unavailable":
    return "Origem: o serviço interno da IA não respondeu. A conexão do aplicativo pode continuar funcionando normalmente.";
   case "invalid-prompt":
    return "Origem: a solicitação foi bloqueada por um limite de segurança de tamanho.";
   case "invalid-request":
    return "Origem: a solicitação não foi reconhecida pelo servidor.";
   default:
    return "O servidor não informou a causa. Pode ser a fonte meteorológica ou o processamento da IA; a TV não consegue distinguir sem diagnóstico adicional.";
  }
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
     String code=data.optString("providerCode","");
     return label+"\nA análise de IA está indisponível neste momento."
       +"\n"+reason(data.optString("reason",""))
       +(code.matches("[0-9]{4,5}")?"\nCódigo técnico do provedor: "+code:"")
       +"\nO monitoramento sísmico e os boletins meteorológicos comuns não dependem da IA.";
    default:
     return label+"\nNão foi possível confirmar um estado válido da IA. Os alertas permanecem independentes.";
   }
  }catch(JSONException e){
   return label+"\nA resposta não é um JSON válido. Nenhuma análise será apresentada.";
  }
 }
}
