package top.monitorglobal.tv;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

/** Fixed public preview release channel, no Worker, no executable network responses. */
final class PhoneUpdateChannel {
 static final String REPOSITORY="helbermoura2/Monitor-Global";
 static final String CHANNEL="mobile-preview";
 static final String PACKAGE="top.monitorglobal.mobile.dev";
 static final String MANIFEST="https://github.com/helbermoura2/Monitor-Global/releases/download/mobile-preview/mobile-update.json";
 static final String APK="https://github.com/helbermoura2/Monitor-Global/releases/download/mobile-preview/monitor-global-mobile-preview.apk";
 static final long MAX_APK=40L*1024*1024;
 static final class Release {
  final long code;final String name,url,sha,certificate;
  Release(long c,String n,String u,String s,String cert){code=c;name=n;url=u;sha=s;certificate=cert;}
 }
 static boolean digest(String value){return value!=null&&value.matches("[0-9a-f]{64}");}
 static Release parse(String raw,String installedPackage)throws Exception {
  if(raw==null||raw.length()>16384)throw new IOException("Manifesto excedeu o limite");
  JSONObject root=new JSONObject(raw);
  if(root.optInt("schema")!=1||!REPOSITORY.equals(root.optString("repository"))||!CHANNEL.equals(root.optString("channel"))||!PACKAGE.equals(root.optString("packageName"))||!PACKAGE.equals(installedPackage))throw new SecurityException("Canal ou pacote diferente");
  JSONObject r=root.getJSONObject("release");
  if(!r.optBoolean("enabled",false))return null;
  long code=r.getLong("versionCode");
  String name=r.getString("versionName"),url=r.getString("url"),sha=r.getString("sha256"),certificate=r.getString("certificateSha256");
  if(code<1||code>1000000000L||!name.matches("[0-9]+\\.[0-9]+\\.[0-9]+-teste")||!APK.equals(url)||!digest(sha)||!digest(certificate))throw new SecurityException("Metadados inválidos");
  return new Release(code,name,url,sha,certificate);
 }
 static HttpURLConnection open(String initial)throws Exception{
  if(!MANIFEST.equals(initial)&&!APK.equals(initial))throw new SecurityException("URL inicial não autorizada");
  URL url=new URL(initial);
  for(int i=0;i<5;i++){
   URI uri=url.toURI();
   if(!"https".equals(uri.getScheme())||uri.getRawUserInfo()!=null||uri.getPort()!=-1||uri.getRawFragment()!=null)throw new SecurityException("Redirecionamento inseguro");
   String host=uri.getHost();
   if(i==0){if(!"github.com".equals(host)||uri.getRawQuery()!=null)throw new SecurityException("Origem inválida");}
   else if(!("release-assets.githubusercontent.com".equals(host)||"objects.githubusercontent.com".equals(host)))throw new SecurityException("Destino fora do canal de releases");
   HttpURLConnection conn=(HttpURLConnection)url.openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(8000);conn.setReadTimeout(20000);conn.setRequestProperty("User-Agent","MonitorGlobal-Mobile-Preview-Updater");conn.setRequestProperty("Cache-Control","no-cache");
   int status=conn.getResponseCode();
   if(status==301||status==302||status==303||status==307||status==308){
    String location=conn.getHeaderField("Location");conn.disconnect();if(location==null||location.length()>4096)throw new IOException("Redirecionamento inválido");
    url=new URL(url,location);continue;
   }
   if(status!=200){conn.disconnect();throw new IOException("Canal indisponível: HTTP "+status);}
   return conn;
  }
  throw new IOException("Redirecionamentos excessivos");
 }
 static Release read()throws Exception{
  HttpURLConnection conn=open(MANIFEST);
  try{
   if(conn.getContentLengthLong()>16384)throw new IOException("Manifesto grande");
   ByteArrayOutputStream buffer=new ByteArrayOutputStream();
   try(InputStream in=conn.getInputStream()){
    byte[] piece=new byte[2048];int n;while((n=in.read(piece))!=-1){if(buffer.size()+n>16384)throw new IOException("Manifesto grande");buffer.write(piece,0,n);}
   }
   return parse(new String(buffer.toByteArray(),StandardCharsets.UTF_8),PACKAGE);
  }finally{conn.disconnect();}
 }
}
