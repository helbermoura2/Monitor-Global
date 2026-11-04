package top.monitorglobal.tv;
import org.json.*;
/** A notification carries a bounded public event, never an executable URL. */
final class PhonePushPayload {
 static Alert parse(String raw,long now){if(raw==null||raw.length()>3000)return null;try{Alert a=AlertCodec.read(new JSONObject(raw));if(a.id.length()>300||a.title.isEmpty()||a.version.isEmpty()||a.issuedAt<=0||a.issuedAt>now+60000||now-a.issuedAt>15*60000L||a.eventTime<=0||a.eventTime>now+60000)return null;if(a.kind.equals("earthquake")&&(!a.eligible||now-a.eventTime>6*3600000L))return null;return a;}catch(JSONException e){return null;}}
 static String tag(String id){try{byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder out=new StringBuilder("push-");for(byte b:hash)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
