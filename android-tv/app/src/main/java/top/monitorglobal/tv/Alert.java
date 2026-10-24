package top.monitorglobal.tv;
public final class Alert {
 public final String id,kind,version,title,detail,state;public final long issuedAt,eventTime;public final boolean eligible;
 public Alert(String id,String kind,String version,String title,String detail,String state,long issuedAt,long eventTime,boolean eligible){this.id=id;this.kind=kind;this.version=version;this.title=title;this.detail=detail;this.state=state;this.issuedAt=issuedAt;this.eventTime=eventTime;this.eligible=eligible;}
}
