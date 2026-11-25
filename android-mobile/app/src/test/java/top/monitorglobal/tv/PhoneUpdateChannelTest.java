package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
import org.json.JSONObject;

public class PhoneUpdateChannelTest {
 private String json(String packageName,String url,String sha,String cert,long code)throws Exception{
  return new JSONObject().put("schema",1).put("repository","helbermoura2/Monitor-Global").put("channel","mobile-stable").put("packageName",packageName)
    .put("release",new JSONObject().put("enabled",true).put("versionCode",code).put("versionName","0.1.9").put("url",url).put("sha256",sha).put("certificateSha256",cert)).toString();
 }
 @Test public void acceptsOnlyFixedStableChannel()throws Exception{
  String hash="a".repeat(64);
  PhoneUpdateChannel.Release r=PhoneUpdateChannel.parse(json(PhoneUpdateChannel.PACKAGE,PhoneUpdateChannel.APK,hash,hash,10),PhoneUpdateChannel.PACKAGE);
  assertEquals(10,r.code);assertEquals(PhoneUpdateChannel.APK,r.url);
 }
 @Test public void rejectsUntrustedUrlsAndDifferentPackage()throws Exception{
  String hash="a".repeat(64);
  for(String uri:new String[]{"https://evil.example/app.apk","http://github.com/app.apk","https://github.com/helbermoura2/Monitor-Global/releases/download/mobile-stable/other.apk"}){
   try{PhoneUpdateChannel.parse(json(PhoneUpdateChannel.PACKAGE,uri,hash,hash,11),PhoneUpdateChannel.PACKAGE);fail("unexpected URL accepted");}catch(SecurityException expected){}
  }
  try{PhoneUpdateChannel.parse(json("top.monitorglobal.mobile",PhoneUpdateChannel.APK,hash,hash,11),PhoneUpdateChannel.PACKAGE);fail("package mismatch");}catch(SecurityException expected){}
  try{PhoneUpdateChannel.parse(json(PhoneUpdateChannel.PACKAGE,PhoneUpdateChannel.APK,"wrong",hash,11),PhoneUpdateChannel.PACKAGE);fail("digest mismatch");}catch(SecurityException expected){}
 }
 @Test public void explainsMissingStableReleaseWithoutClaimingNetworkFailure(){
  assertTrue(PhoneUpdateChannel.verificationFailure(new java.io.IOException("Canal indisponível: HTTP 404")).contains("ainda não foi publicada"));
  assertTrue(PhoneUpdateChannel.verificationFailure(new java.io.IOException("Canal indisponível: HTTP 429")).contains("limitou temporariamente"));
  assertTrue(PhoneUpdateChannel.verificationFailure(new java.io.IOException("timeout")).contains("conexão com a internet"));
 }
 @Test public void disabledReleaseDoesNotOfferInstallation()throws Exception{
  String raw=new JSONObject().put("schema",1).put("repository",PhoneUpdateChannel.REPOSITORY).put("channel",PhoneUpdateChannel.CHANNEL).put("packageName",PhoneUpdateChannel.PACKAGE).put("release",new JSONObject().put("enabled",false)).toString();
  assertNull(PhoneUpdateChannel.parse(raw,PhoneUpdateChannel.PACKAGE));
 }
}
