package top.monitorglobal.tv;
import java.net.URI;
/** No remote executable code or arbitrary APK hosts. Independent of Android for unit checks. */
public final class TrustPolicy {
 public static boolean officialApkUrl(String value){try{URI u=new URI(value);return "https".equals(u.getScheme())&&"monitorglobal.top".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getRawUserInfo()==null&&u.getRawQuery()==null&&u.getRawFragment()==null&&u.getRawPath().matches("/downloads/monitor-global-tv-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk");}catch(Exception e){return false;}}
 public static boolean digest(String s){return s!=null&&s.matches("[a-f0-9]{64}");}
 public static boolean newer(long installed,long announced){return announced>installed&&announced<=1000000000L;}
 public static int clamp(int n,int min,int max){return Math.max(min,Math.min(max,n));}
 public static String color(String value,String fallback){return value!=null&&value.matches("#[a-fA-F0-9]{6}")?value:fallback;}
}
