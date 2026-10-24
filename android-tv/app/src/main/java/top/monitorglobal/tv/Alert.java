package top.monitorglobal.tv;
public final class Alert {
 public final String id,kind,version,title,detail,state;public final long issuedAt,eventTime;public final boolean eligible;
 public String source="",countryCode="",tsunamiSummary="",relatedQuakeId="",revision="";
 public double magnitude=Double.NaN,depth=Double.NaN,previousMagnitude=Double.NaN;
 public Alert companion;
 public Alert(String id,String kind,String version,String title,String detail,String state,long issuedAt,long eventTime,boolean eligible){this.id=id;this.kind=kind;this.version=version;this.title=title;this.detail=detail;this.state=state;this.issuedAt=issuedAt;this.eventTime=eventTime;this.eligible=eligible;}
 public Alert copy(){Alert out=new Alert(id,kind,version,title,detail,state,issuedAt,eventTime,eligible);out.source=source;out.countryCode=countryCode;out.tsunamiSummary=tsunamiSummary;out.relatedQuakeId=relatedQuakeId;out.magnitude=magnitude;out.depth=depth;out.previousMagnitude=previousMagnitude;out.revision=revision;return out;}
 public Alert revised(double oldMagnitude){Alert out=copy();out.previousMagnitude=oldMagnitude;out.companion=companion;
  out.revision=Double.isFinite(oldMagnitude)&&Double.isFinite(magnitude)&&Math.abs(oldMagnitude-magnitude)>.001?String.format(java.util.Locale.forLanguageTag("pt-BR"),"M%.1f → M%.1f",oldMagnitude,magnitude):"Dados do sismo revisados";return out;}
}
