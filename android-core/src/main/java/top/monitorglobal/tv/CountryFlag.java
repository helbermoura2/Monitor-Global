package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
import java.text.Normalizer;
import java.util.*;
/** Flag of the named country/region, never a nearest-coast guess for an ocean. */
final class CountryFlag {
 private static String normal(String s){return Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).trim();}
 static Bitmap load(Context c,Alert alert){
  if(!alert.kind.equals("earthquake"))return null;
  String code=alert.countryCode;
  if(!code.matches("[A-Z]{2}")){
   String place=normal(alert.title.replaceFirst(" · EXEMPLO$",""));String found="";
   for(String iso:Locale.getISOCountries()){Locale country=new Locale("",iso);for(Locale language:new Locale[]{Locale.ENGLISH,Locale.forLanguageTag("pt-BR")}){
    String name=normal(country.getDisplayCountry(language));if(place.endsWith(", "+name)||place.endsWith(" · "+name)){if(!found.isEmpty()&&!found.equals(iso))return null;found=iso;}
   }}code=found;
  }
  if(!code.matches("[A-Z]{2}"))return null;
  try(java.io.InputStream in=c.getAssets().open("flags/"+code.toLowerCase(Locale.ROOT)+".png")){return BitmapFactory.decodeStream(in);}catch(java.io.IOException e){return null;}
 }
}
