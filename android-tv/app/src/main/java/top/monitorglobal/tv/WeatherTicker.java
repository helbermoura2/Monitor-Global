package top.monitorglobal.tv;
import java.text.Normalizer;
import java.util.*;
/** Select complementary sentences; never turn current metrics into a new forecast. */
final class WeatherTicker {
 static final int MAX_CHARS=230;
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
