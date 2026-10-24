package top.monitorglobal.tv;
import android.content.*;import org.json.*;import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;
final class OfficialConfig {
 static final String URL="https://monitorglobal.top/android-tv/distribution/stable.json",REPOSITORY="helbermoura2/Monitor-Global";
 static final class Release {boolean enabled;int code;String version,url,sha;}
 static JSONObject read() throws Exception {
  HttpURLConnection c=(HttpURLConnection)new java.net.URL(URL).openConnection();c.setConnectTimeout(5000);c.setReadTimeout(8000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("Cache-Control","no-cache");
  try{if(c.getResponseCode()!=200)throw new IOException("Canal oficial indisponível");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>65536)throw new IOException("Manifesto acima do limite");bytes.write(b,0,n);}}
   JSONObject root=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));if(root.optInt("schema")!=1||!REPOSITORY.equals(root.optString("repository"))||!"top.monitorglobal.tv.preview".equals(root.optString("packageName"))||!BuildConfig.OFFICIAL_SIGNER_SHA256.equals(root.optString("certificateSha256")))throw new SecurityException("Identidade do canal oficial inválida");return root;
  }finally{c.disconnect();}
 }
 static Release release(JSONObject root) throws Exception {JSONObject r=root.getJSONObject("release");Release out=new Release();out.enabled=r.optBoolean("enabled",false);if(!out.enabled)return out;
  out.code=r.getInt("versionCode");out.version=r.getString("versionName");out.url=r.getString("url");out.sha=r.getString("sha256");
  if(!out.version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")||!TrustPolicy.officialApkUrl(out.url)||!TrustPolicy.digest(out.sha))throw new SecurityException("Metadados de atualização inválidos");return out;
 }
 static void applyTheme(Context c,JSONObject root){JSONObject t=root.optJSONObject("theme");if(t==null)return;int version=t.optInt("version",0);if(version<1||version<Prefs.get(c).getInt("themeVersion",0))return;
  Prefs.get(c).edit().putInt("themeVersion",version).putString("themeBackground",TrustPolicy.color(t.optString("background"),"#101f27")).putString("themeAccent",TrustPolicy.color(t.optString("accent"),"#79d4c7")).putString("themeText",TrustPolicy.color(t.optString("text"),"#ffffff")).putInt("themeTitleSp",TrustPolicy.clamp(t.optInt("titleSp",23),20,32)).putInt("themeBodySp",TrustPolicy.clamp(t.optInt("bodySp",16),14,22)).putInt("themeCornerDp",TrustPolicy.clamp(t.optInt("cornerDp",14),0,24)).putInt("themeWidthPercent",TrustPolicy.clamp(t.optInt("widthPercent",92),65,96)).putBoolean("themeTop","top".equals(t.optString("position"))).apply();
 }
}
