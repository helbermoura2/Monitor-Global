package top.monitorglobal.tv;

import android.content.Context;
import android.view.View;
import java.util.Arrays;

/** Local, silent and visibly fictitious fixtures. Never enters the real feed/notification queue. */
final class TvEffectsDemo {
 private TvEffectsDemo(){}
 static Alert quake(boolean brazil,boolean regional){
  long now=System.currentTimeMillis();
  Alert a=new Alert("EFFECTS-DEMO","earthquake","demo",brazil?"M3,8 · Jacobina, Bahia, Brasil":regional?"M5,4 · Katmandu, Nepal":"M6,8 · Honshu, Japão","SIMULAÇÃO · NÃO É ALERTA REAL","earthquake",now,now,false);
  a.magnitude=brazil?3.8:regional?5.4:6.8;a.depth=12;a.countryCode=brazil?"BR":regional?"NP":"JP";
  a.source="SIMULAÇÃO";a.originLongitude=brazil?-40.516:regional?85.324:141.4;
  a.originLatitude=brazil?-11.181:regional?27.717:38.1;a.compact=regional;
  if(regional)a.targetArea="Katmandu · Nepal";
  return a;
 }
 static View create(Context c,TvEffectsController.EffectsCategory category){
  long now=System.currentTimeMillis();
  RainForecast.Summary rain=new RainForecast.Summary("now","fraca","Chuva estimada · SIMULAÇÃO",1.2,3.2,"Término estimado em ~35 min",now,now+600000,true,0,35,35,4.5,"Duração estimada: ~35 min");
  WeatherForecast.Summary weather=new WeatherForecast.Summary("22°C","Nublado · SIMULAÇÃO","Vento 12 km/h","Umidade 81%","SIMULAÇÃO",now+600000,false,"22°C","23°C","81%","12 km/h","19 km/h","Cloudy");
  switch(category){
   case GLOBAL_M6:return new NewsBannerView(c,quake(false,false),true,false);
   case BRAZIL:return new BrazilNationalBannerView(c,quake(true,false),true,false);
   case REGIONAL:return new NewsBannerView(c,quake(false,true),true,false,true);
   case TSUNAMI:return new NewsBannerView(c,DemoAlerts.create("tsunami",now).get(0),true,false);
   case WEATHER:return TvBroadcastInfoView.weather(c,null,weather,true);
   case RAIN:return TvBroadcastInfoView.rain(c,rain,weather,true);
   case MARKET:return TvBroadcastInfoView.market(c,new BrentQuote(78.35,77.5,.85,1.1,now,"SIMULAÇÃO"),new DollarQuote(5.32,.02,.38,now,"SIMULAÇÃO"),true);
   case SUMMARY:return NewsBannerView.simulationSummary(c,Arrays.asList(quake(false,false),quake(true,false)));
   case SATELLITE:return TvBroadcastInfoView.satelliteDemo(c);
   case CIVIL:return TvBroadcastInfoView.civilAlert(c,
     new DefesaCivilSp.Notice("EFFECTS-CIVIL-DEMO","ARGOS ORBIS · TESTE FICTÍCIO",
       "SIMULAÇÃO DE ALERTA SEVERO da Defesa Civil. Não é uma emergência real.",
       "Severe",now,now+20000),true);
   default:return TvBroadcastInfoView.voiceStatus(c,"SIMULAÇÃO · CONSULTA POR VOZ","Teste visual sem consulta nem alerta real");
  }
 }
 static long duration(TvEffectsController.EffectsCategory category){
  switch(category){case REGIONAL:case WEATHER:case SATELLITE:return 15000;
   case RAIN:case MARKET:return 12000;case VOICE:return 6000;
   case SUMMARY:return BannerTimeline.summaryTotalDuration(2,android.animation.ValueAnimator.areAnimatorsEnabled());
   default:return 20000;}
 }
}
