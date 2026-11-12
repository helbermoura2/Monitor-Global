package top.monitorglobal.tv;
/** Source-backed rain facts shared by rendering and accessibility. */
final class RainBannerContent {
 final String topic,headline,amount,rate,duration,durationLabel,end,accessible;
 RainBannerContent(RainForecast.Summary r){
  topic=r!=null&&r.title.startsWith("Neve")?"NEVE":"CHUVA";
  String level=r==null?"":r.forecastLevel;
  headline=r==null?"DADOS INDISPONÍVEIS":r.state.equals("soon")?(r.arrivalMinutes>=0?"EM APROX. "+r.arrivalMinutes+" MIN":"PREVISTA"):r.state.equals("now")?(level.isEmpty()?"EM ANDAMENTO":level.toUpperCase(java.util.Locale.forLanguageTag("pt-BR"))+" AGORA"):"SEM CHUVA PREVISTA";
  amount=r!=null&&Double.isFinite(r.amount)&&r.amount>=0?RainForecast.number(r.amount)+" mm":"INDISPONÍVEL";
  rate=r!=null&&Double.isFinite(r.forecastRate)&&r.forecastRate>=.1?RainForecast.number(r.forecastRate)+" mm/h":"INDISPONÍVEL";
  duration=r!=null&&r.durationMinutes>0?"~"+r.durationMinutes+" min":"INDEFINIDA";
  durationLabel=r==null?"DURAÇÃO ESTIMADA":r.durationLabel.toUpperCase(java.util.Locale.forLanguageTag("pt-BR"));
  end=r!=null&&r.endMinutes>=0?"Término em ~"+r.endMinutes+" min":"Término ainda indefinido";
  accessible=(r==null?"Chuva indisponível":r.title)+" · "+amount+" previstos · próximos 60 min · "+rate+" · "+(r==null?"Duração indefinida":r.durationText)+" · "+end;
 }
}
