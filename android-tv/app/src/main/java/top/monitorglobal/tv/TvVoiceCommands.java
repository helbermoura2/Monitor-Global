package top.monitorglobal.tv;

import java.text.Normalizer;
import java.util.Locale;

/** Strict, offline interpretation of common TV card requests. Never invents data. */
final class TvVoiceCommands {
 static final String WEATHER="weather", BRENT="brent", BRAZIL="brazil",
     RECENT_QUAKE="recent-quake", TODAY="today", YESTERDAY="yesterday",
     SATELLITE="satellite", WEATHER_AI="weather-ai", UNKNOWN="unknown";
 private TvVoiceCommands(){}

 static String route(String phrase){
  if(phrase==null)return UNKNOWN;
  String s=Normalizer.normalize(phrase,Normalizer.Form.NFD)
    .replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT)
    .replaceAll("[^a-z0-9 ]"," ").replaceAll("\\s+"," ").trim();
  if(s.isEmpty())return UNKNOWN;
  if(has(s,"brent")||has(s,"petroleo")&&has(s,"cotacao","preco","barril"))return BRENT;
  if(has(s,"satelite","satellite","imagem de satelite"))return SATELLITE;
  boolean quake=has(s,"sismo","sismos","terremoto","terremotos","tremor","tremores","abalo","abalos");
  if(quake&&has(s,"brasil","brasileiro","brasileiros","brasileira","brasileiras"))return BRAZIL;
  if(quake&&has(s,"ontem","dia anterior"))return YESTERDAY;
  if(quake&&has(s,"maior","maiores","hoje","resumo"))return TODAY;
  if(quake)return RECENT_QUAKE;
  if(has(s,"inteligencia artificial","analise da ia","analise meteorologica"))return WEATHER_AI;
  if(has(s,"temperatura","clima","meteorologia","previsao do tempo","tempo","chuva","chovendo","sensacao termica"))return WEATHER;
  return UNKNOWN;
 }
 private static boolean has(String s,String... words){
  for(String word:words)if((" "+s+" ").contains(" "+word+" "))return true;
  return false;
 }
}
