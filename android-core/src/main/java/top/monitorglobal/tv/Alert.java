package top.monitorglobal.tv;
public final class Alert {
 public final String id,kind,version,title,detail,state;public final long issuedAt,eventTime;public final boolean eligible;
 public java.util.List<String> targetAreas=new java.util.ArrayList<>();public String targetArea="";public boolean compact;
 public String provider="",catalog="";public java.util.List<String> aliases=new java.util.ArrayList<>();
 public String source="",countryCode="",tsunamiSummary="",relatedQuakeId="",revision="";
 public double magnitude=Double.NaN,depth=Double.NaN,previousMagnitude=Double.NaN;
 public String legacyVersion="";public String bulletinProduct="",officialEventId="";public long originTime;public double originLongitude=Double.NaN,originLatitude=Double.NaN;
 public String mapJson="";
 public String populationSummary="",nearbySummary="";
 public Alert companion;
 public Alert(String id,String kind,String version,String title,String detail,String state,long issuedAt,long eventTime,boolean eligible){this.id=id;this.kind=kind;this.version=version;this.title=title;this.detail=detail;this.state=state;this.issuedAt=issuedAt;this.eventTime=eventTime;this.eligible=eligible;}
 public boolean quietInformation(){return kind.equals("tsunami")&&state.equals("noThreat");}
 public Alert copy(){Alert out=new Alert(id,kind,version,title,detail,state,issuedAt,eventTime,eligible);out.mapJson=mapJson;out.targetArea=targetArea;out.targetAreas=new java.util.ArrayList<>(targetAreas);out.compact=compact;out.legacyVersion=legacyVersion;out.bulletinProduct=bulletinProduct;out.officialEventId=officialEventId;out.originTime=originTime;out.originLongitude=originLongitude;out.originLatitude=originLatitude;out.provider=provider;out.catalog=catalog;out.aliases=new java.util.ArrayList<>(aliases);out.populationSummary=populationSummary;out.nearbySummary=nearbySummary;out.source=source;out.countryCode=countryCode;out.tsunamiSummary=tsunamiSummary;out.relatedQuakeId=relatedQuakeId;out.magnitude=magnitude;out.depth=depth;out.previousMagnitude=previousMagnitude;out.revision=revision;return out;}
 /** Conservative same-product identity; never lets another region/product cancel this one. */
 public static boolean sameBulletin(Alert a,Alert b){
  if(a==null||b==null||!a.kind.equals("tsunami")||!b.kind.equals("tsunami"))return false;
  if(a.id.equals(b.id))return true;
  if(a.bulletinProduct.isEmpty()||!a.bulletinProduct.equals(b.bulletinProduct))return false;
  if(!a.officialEventId.isEmpty()&&!b.officialEventId.isEmpty())return a.officialEventId.equals(b.officialEventId);
  if(!a.relatedQuakeId.isEmpty()&&!b.relatedQuakeId.isEmpty())return a.relatedQuakeId.equals(b.relatedQuakeId);
  if(a.originTime<=0||b.originTime<=0||Math.abs(a.originTime-b.originTime)>600000||!located(a)||!located(b))return false;
  double r=Math.PI/180,dl=(a.originLongitude-b.originLongitude)*r,dp=(a.originLatitude-b.originLatitude)*r;
  double x=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(a.originLatitude*r)*Math.cos(b.originLatitude*r)*Math.sin(dl/2)*Math.sin(dl/2);
  return 12742*Math.asin(Math.sqrt(Math.min(1,x)))<=100;
 }
 private static boolean located(Alert a){return Double.isFinite(a.originLongitude)&&Double.isFinite(a.originLatitude)&&Math.abs(a.originLongitude)<=180&&Math.abs(a.originLatitude)<=90;}
 public Alert bulletinIdentity(){Alert a=new Alert(id,kind,"","","","",issuedAt,eventTime,false);a.bulletinProduct=bulletinProduct;a.officialEventId=officialEventId;a.originTime=originTime;a.originLongitude=originLongitude;a.originLatitude=originLatitude;a.relatedQuakeId=relatedQuakeId;return a;}
 public Alert revised(double oldMagnitude){Alert out=copy();out.previousMagnitude=oldMagnitude;out.companion=companion;
  out.revision=Double.isFinite(oldMagnitude)&&Double.isFinite(magnitude)&&Math.abs(oldMagnitude-magnitude)>.001?String.format(java.util.Locale.forLanguageTag("pt-BR"),"M%.1f → M%.1f",oldMagnitude,magnitude):"Dados do sismo revisados";return out;}
}
