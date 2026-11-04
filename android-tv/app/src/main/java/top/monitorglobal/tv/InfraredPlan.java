package top.monitorglobal.tv;
import java.time.*;import java.time.format.*;import java.util.*;import java.util.regex.*;
/** Only producer-advertised infrared timestamps; no inferred rain or lightning. */
final class InfraredPlan {
 static final String ROOT="https://gibs.earthdata.nasa.gov/",LAYER="GOES-East_ABI_Band13_Clean_Infrared",LEGEND=ROOT+"legends/Clean_Longwave_Infrared_Window_Band_H.png";
 static final long STEP=600000,MAX_AGE=6*3600000L;static final int WIDTH=512;
 static final Scope BRAZIL=new Scope("BRASIL",-75,-35,-28,6),SOUTHEAST=new Scope("SUDESTE",-54,-27,-38,-17);
 static final class Scope {final String name;final double west,south,east,north;final int height;Scope(String n,double w,double s,double e,double north){name=n;west=w;south=s;east=e;this.north=north;height=(int)Math.round(WIDTH*(merc(north)-merc(s))/Math.toRadians(e-w));}float x(double lon){return (float)((lon-west)/(east-west)*WIDTH);}float y(double lat){return (float)((merc(north)-merc(lat))/(merc(north)-merc(south))*height);}}
 static double merc(double lat){return Math.log(Math.tan(Math.PI/4+Math.toRadians(lat)/2));}
 static String iso(long time){return Instant.ofEpochMilli(time/1000*1000).toString();}
 static String domains(long now){return ROOT+"wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=DescribeDomains&VERSION=1.0.0&LAYER="+LAYER+"&TILEMATRIXSET=GoogleMapsCompatible_Level7&TIME="+iso(now-4*3600000L)+"/"+iso(now);}
 static List<Long> frames(String xml,long now){TreeSet<Long> all=new TreeSet<>();if(xml==null||xml.length()>131072)return new ArrayList<>();Matcher m=Pattern.compile("<(?:[\\w-]+:)?Domain(?:\\s[^>]*)?>([^<]+)</(?:[\\w-]+:)?Domain>").matcher(xml);while(m.find())for(String item:m.group(1).split(",")){String[] p=item.trim().split("/");if(p.length!=1&&p.length!=3||p.length==3&&!p[2].matches("PT10M|PT600S"))continue;try{long start=Instant.parse(p[0]).toEpochMilli(),end=p.length==3?Instant.parse(p[1]).toEpochMilli():start;if(end<start||end>now)continue;for(int i=0;i<6;i++){long at=end-i*STEP;if(at<start||now-at>MAX_AGE)break;all.add(at);}}catch(DateTimeException ignored){}}List<Long> result=new ArrayList<>(all);return new ArrayList<>(result.subList(Math.max(0,result.size()-6),result.size()));}
 static String image(Scope s,long time){double r=6378137;String bbox=String.format(Locale.US,"%.2f,%.2f,%.2f,%.2f",r*Math.toRadians(s.west),r*merc(s.south),r*Math.toRadians(s.east),r*merc(s.north));return ROOT+"wms/epsg3857/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS="+LAYER+"&STYLES=&SRS=EPSG:3857&BBOX="+bbox+"&WIDTH="+WIDTH+"&HEIGHT="+s.height+"&FORMAT=image/png&TRANSPARENT=TRUE&TIME="+iso(time);}
 static String timing(long at,long now){String date=DateTimeFormatter.ofPattern("dd/MM/uuuu HH:mm 'BRT'",Locale.forLanguageTag("pt-BR")).withZone(ZoneId.of("America/Sao_Paulo")).format(Instant.ofEpochMilli(at));long age=Math.max(0,(now-at)/60000);return "Imagem: "+date+" · há "+age+" min"+(age>90?" · IMAGEM ANTIGA":"");}
}
