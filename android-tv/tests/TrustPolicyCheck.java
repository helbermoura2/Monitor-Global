package top.monitorglobal.tv;
public final class TrustPolicyCheck {
 static void check(boolean c,String m){if(!c)throw new AssertionError(m);}
 public static void main(String[] args){
  check(TrustPolicy.officialApkUrl("https://monitorglobal.top/downloads/monitor-global-tv-1.0.1.apk"),"Official versioned URL");
  for(String bad:new String[]{"http://monitorglobal.top/downloads/monitor-global-tv-1.0.1.apk","https://evil.example/downloads/monitor-global-tv-1.0.1.apk","https://monitorglobal.top.evil.example/downloads/monitor-global-tv-1.0.1.apk","https://user@monitorglobal.top/downloads/monitor-global-tv-1.0.1.apk","https://monitorglobal.top/downloads/../bad.apk","https://monitorglobal.top/downloads/monitor-global-tv-1.0.1.apk?url=evil","https://monitorglobal.top/downloads/monitor-global-tv-%2e.apk","javascript:evil"})check(!TrustPolicy.officialApkUrl(bad),"Reject untrusted URL: "+bad);
  check(!TrustPolicy.newer(10000,10000)&&!TrustPolicy.newer(10000,9999)&&TrustPolicy.newer(10000,10001),"No rollback or same-version install");
  check(TrustPolicy.clamp(100,20,32)==32&&TrustPolicy.clamp(-1,14,22)==14,"Theme font bounds");
  check(TrustPolicy.color("url(evil)","#ffffff").equals("#ffffff"),"No executable theme values");check(!TrustPolicy.digest("fake")&&TrustPolicy.digest("a".repeat(64)),"Digest shape");
  System.out.println("PASS: official origin, fixed path, no rollback, bounded theme and digest validation");
 }
}
