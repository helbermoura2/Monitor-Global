package top.monitorglobal.tv;
import java.text.Normalizer;
import java.util.*;
/** Select complementary sentences; never turn current metrics into a new forecast. */
final class WeatherTicker {
 static final int MAX_CHARS=230;
 static String composeRain(String ai){
  StringBuilder complementary=new StringBuilder();
  for(String sentence:(ai==null?"":ai).split("(?<=[.!?])\\s+")){
   if(sentence.toLowerCase(Locale.ROOT).matches(".*[0-9]\\s*(mm|min|hora|%|°).*"))continue;
   if(complementary.length()>0)complementary.append(' ');complementary.append(sentence);
  }
  String result=compose(complementary.toString(),"");
  return result.startsWith("Sem análise complementar")?"":result;
 }

 /** Compact provenance and freshness context; freshness is not a confidence score. */
 static String sourceContext(WeatherForecast.Summary weather,RainForecast.Summary rain,long now){
  StringBuilder out=new StringBuilder();
  if(weather!=null&&weather.expiresAt>now&&weather.generatedAt>0&&weather.generatedAt<=now+60000){
   long age=Math.max(0,(now-weather.generatedAt)/60000);
   append(out,"MODELO HORÁRIO · atualizado há "+age+" min");
   append(out,age<=30?"DADO RECENTE":age<=60?"ATENÇÃO À IDADE DO MODELO":"MODELO COM MAIS DE 1 H");
  }else append(out,"MODELO HORÁRIO indisponível ou vencido");
  if(rain!=null&&rain.expiresAt>now&&rain.at>0&&rain.at<=now+60000){
   long age=Math.max(0,(now-rain.at)/60000);
   if("evidence".equals(rain.state)&&"gauge".equals(rain.level))
    append(out,"CEMADEN · medição de pluviômetro · há "+age+" min");
   else if("evidence".equals(rain.state)&&"consensus".equals(rain.level))
    append(out,"CONSENSO DE MODELOS · há "+age+" min · não é probabilidade calibrada");
   else append(out,"PREVISÃO POR MINUTO · referência há "+age+" min");
  }else append(out,"previsão de chuva indisponível ou vencida");
  append(out,"CONFIABILIDADE: origem e idade explícitas; sem nota artificial");
  return out.toString();
 }
 private static void append(StringBuilder out,String value){
  if(value==null||value.isEmpty())return;
  if(out.length()>0)out.append(" · ");
  out.append(value);
 }

 static String trend(WeatherForecast.Summary previous,WeatherForecast.Summary current){
  if(previous==null||current==null||previous.generatedAt<=0||current.generatedAt<=previous.generatedAt)return "";
  double before=parseTemperature(previous.temperatureValue),after=parseTemperature(current.temperatureValue);
  if(!Double.isFinite(before)||!Double.isFinite(after))return "";
  double delta=Math.abs(after-before);
  if(delta<0.5)return "Temperatura estável desde a última atualização horária";
  return "Temperatura "+(after>before?"subiu ":"caiu ")+RainForecast.number(delta)+"°C desde a última atualização horária";
 }
 private static double parseTemperature(String value){
  if(value==null)return Double.NaN;
  try{return Double.parseDouble(value.replace("°C","").replace(',','.').trim());}
  catch(NumberFormatException ignored){return Double.NaN;}
 }

 static String compose(String ai,String outlook){
  StringBuilder result=new StringBuilder();Set<String> seen=new HashSet<>();
  for(String source:new String[]{ai,outlook}){
   if(source==null)continue;
   for(String sentence:source.replace('\n',' ').trim().split("(?<=[.!?])\\s+")){
    String text=sentence.trim();if(text.isEmpty())continue;
    String key=Normalizer.normalize(text.toLowerCase(Locale.ROOT),Normalizer.Form.NFD).replaceAll("\\p{M}","").replaceAll("[^a-z0-9 ]","").replaceAll("\\s+"," ").trim();
    boolean future=key.matches(".*(proxim|tendenc|aument|diminu|chega|cessa|termin|intensific|persist|risco|pode|deve|mudar|variar|atenc|evit|leve|planej|aguard|durante).*");
    boolean metric=key.matches(".*(temperatura|sensacao|umidade|vento|rajada|kmh|graus|nublado|ceu).*");
    if(metric&&!future||!seen.add(key))continue;
    if(result.length()+text.length()+(result.length()>0?1:0)>MAX_CHARS)continue;
    if(result.length()>0)result.append(' ');result.append(text);
   }
  }
  return result.length()==0?"Sem análise complementar disponível nesta consulta.":result.toString();
 }
}
