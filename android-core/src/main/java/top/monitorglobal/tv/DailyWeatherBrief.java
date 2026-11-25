package top.monitorglobal.tv;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import org.json.*;

final class DailyWeatherBrief {
 static final ZoneId ZONE=ZoneId.of("America/Sao_Paulo");
 private static final LocalTime MORNING=LocalTime.of(11,30), EVENING=LocalTime.of(23,45);
 private static final DateTimeFormatter DATE=DateTimeFormatter.ofPattern("dd/MM");
 private static final String URL_SOURCE="https://api.open-meteo.com/v1/forecast"
  +"?latitude=-23.555&longitude=-46.635&timezone=America%2FSao_Paulo&forecast_days=2"
  +"&daily=temperature_2m_min,temperature_2m_max&hourly=precipitation_probability,weather_code";

 static final class Slot {
  final ZonedDateTime at;
  final boolean tomorrow;
  Slot(ZonedDateTime at,boolean tomorrow){this.at=at;this.tomorrow=tomorrow;}
  LocalDate date(){return at.toLocalDate().plusDays(tomorrow?1:0);}
  String key(){return at.toLocalDate()+(tomorrow?"-evening":"-morning");}
  String title(){return (tomorrow?"Amanhã":"Hoje")+" · Liberdade · "+date().format(DATE);}
 }
 static Slot due(long millis){
  ZonedDateTime now=Instant.ofEpochMilli(millis).atZone(ZONE);
  LocalTime time=now.toLocalTime();
  if(!time.isBefore(EVENING))return new Slot(now.toLocalDate().atTime(EVENING).atZone(ZONE),true);
  if(!time.isBefore(MORNING)&&time.isBefore(MORNING.plusMinutes(40)))return new Slot(now.toLocalDate().atTime(MORNING).atZone(ZONE),false);
  return null;
 }
 static long next(long millis){
  ZonedDateTime now=Instant.ofEpochMilli(millis).atZone(ZONE);
  LocalDate day=now.toLocalDate();
  LocalTime time=now.toLocalTime();
  ZonedDateTime next=time.isBefore(MORNING)?day.atTime(MORNING).atZone(ZONE):
   time.isBefore(EVENING)?day.atTime(EVENING).atZone(ZONE):day.plusDays(1).atTime(MORNING).atZone(ZONE);
  return next.toInstant().toEpochMilli();
 }

 static String read(Slot slot,long millis)throws IOException,JSONException{
  HttpURLConnection c=(HttpURLConnection)new URL(URL_SOURCE).openConnection();
  c.setConnectTimeout(6000);c.setReadTimeout(6000);c.setInstanceFollowRedirects(false);
  try{
   if(c.getResponseCode()!=200)throw new IOException("Open-Meteo indisponível");
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream in=c.getInputStream()){
    byte[] buffer=new byte[4096];
    for(int count;(count=in.read(buffer))!=-1;){
     if(bytes.size()+count>64_000)throw new IOException("Previsão acima do limite");
     bytes.write(buffer,0,count);
    }
   }
   return summarize(new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)),slot,millis);
  }finally{c.disconnect();}
 }

 static String summarize(JSONObject data,Slot slot,long millis)throws JSONException{
  if(!"America/Sao_Paulo".equals(data.getString("timezone")))throw new JSONException("Fuso incorreto");
  JSONObject daily=data.getJSONObject("daily"),hourly=data.getJSONObject("hourly");
  JSONArray dates=daily.getJSONArray("time"),hours=hourly.getJSONArray("time");
  String date=slot.date().toString();
  int day=-1;
  for(int i=0;i<dates.length();i++)if(date.equals(dates.getString(i)))day=i;
  if(day<0)throw new JSONException("Dia da previsão indisponível");
  double min=daily.getJSONArray("temperature_2m_min").getDouble(day),max=daily.getJSONArray("temperature_2m_max").getDouble(day);
  if(!Double.isFinite(min)||!Double.isFinite(max)||min< -30||max>60||min>max)throw new JSONException("Temperaturas inválidas");
  LocalDateTime first=slot.date().atStartOfDay();
  if(!slot.tomorrow){
   LocalDateTime now=Instant.ofEpochMilli(millis).atZone(ZONE).toLocalDateTime();
   first=now.withMinute(0).withSecond(0).withNano(0);
  }
  JSONArray chances=hourly.getJSONArray("precipitation_probability"),codes=hourly.getJSONArray("weather_code");
  int peak=-1,probability=-1;boolean storm=false;
  int forecastHours=0;
  for(int i=0;i<hours.length();i++){
   LocalDateTime hour=LocalDateTime.parse(hours.getString(i));
   if(!hour.toLocalDate().equals(slot.date())||hour.isBefore(first))continue;
   if(chances.isNull(i)||codes.isNull(i))continue;
   int p=chances.getInt(i),code=codes.getInt(i);
   if(p<0||p>100)continue;
   forecastHours++;
   boolean thunder=code==95||code==96||code==99;
   if(thunder&&!storm||thunder==storm&&p>probability){peak=hour.getHour();probability=p;storm=thunder;}
  }
  if(forecastHours==0)throw new JSONException("Chuva prevista indisponível");
  String rain=storm?"Chance de tempestade por volta das "+peak+"h":
   probability>=30?"Maior chance de chuva às "+peak+"h ("+probability+"%)":
   "Baixa chance de chuva "+(slot.tomorrow?"ao longo do dia":"no restante do dia");
  return "Mín. "+Math.round(min)+" °C · máx. "+Math.round(max)+" °C. "+rain+".";
 }
 private DailyWeatherBrief(){}
}
