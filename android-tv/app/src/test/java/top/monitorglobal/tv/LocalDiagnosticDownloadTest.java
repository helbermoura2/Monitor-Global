package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import java.io.*;import java.net.*;import java.nio.charset.StandardCharsets;
public class LocalDiagnosticDownloadTest {
 private LocalDiagnosticDownload server(long ttl)throws Exception{return new LocalDiagnosticDownload(InetAddress.getByName("127.0.0.1"),"{\"samples\":[1,2]}".getBytes(StandardCharsets.UTF_8),false,ttl);}
 private String request(LocalDiagnosticDownload server,String method,String target,String host,String extra)throws Exception{
  URL u=new URL(server.url());try(Socket socket=new Socket(u.getHost(),u.getPort())){socket.setSoTimeout(2500);String text=method+" "+target+" HTTP/1.1\r\nHost: "+host+"\r\n"+extra+"\r\n";socket.getOutputStream().write(text.getBytes(StandardCharsets.US_ASCII));return new String(socket.getInputStream().readAllBytes(),StandardCharsets.UTF_8);}
 }
 @Test public void immutableReportHasAttachmentAndNoCacheHeaders()throws Exception{
  byte[] source="{\"samples\":[278]}".getBytes(StandardCharsets.UTF_8);try(LocalDiagnosticDownload s=new LocalDiagnosticDownload(InetAddress.getByName("127.0.0.1"),source,true,300000)){source[0]='x';URL u=new URL(s.url());String response=request(s,"GET",u.getPath(),u.getAuthority(),"");assertTrue(response.startsWith("HTTP/1.1 200"));assertTrue(response.contains("application/json"));assertTrue(response.contains("Cache-Control: no-store"));assertTrue(response.contains("filename=\"monitor-global-tv-diagnostico-anterior.json\""));assertTrue(response.endsWith("{\"samples\":[278]}"));assertTrue(u.getPath().matches("/[a-f0-9]{32}/monitor-global-tv-diagnostico-anterior.json"));} }
 @Test public void wrongTokenTraversalQueryMethodHostAndOriginCannotReadReport()throws Exception{
  try(LocalDiagnosticDownload s=server(300000)){URL u=new URL(s.url());for(String path:new String[]{"/",u.getPath()+"?x=1","/../runtime-diagnostics.json","/invalid/report.json"})assertTrue(request(s,"GET",path,u.getAuthority(),"").startsWith("HTTP/1.1 404"));assertTrue(request(s,"POST",u.getPath(),u.getAuthority(),"").startsWith("HTTP/1.1 405"));assertTrue(request(s,"GET",u.getPath(),"attacker.example","").startsWith("HTTP/1.1 400"));assertTrue(request(s,"GET",u.getPath(),u.getAuthority(),"Origin: https://attacker.example\r\n").startsWith("HTTP/1.1 400"));}
 }
 @Test public void headDoesNotConsumeDownloadsAndFiveGetsCloseTheListener()throws Exception{
  LocalDiagnosticDownload s=server(300000);try{URL u=new URL(s.url());for(int i=0;i<6;i++){String head=request(s,"HEAD",u.getPath(),u.getAuthority(),"");assertTrue(head.startsWith("HTTP/1.1 200"));assertTrue(head.endsWith("\r\n\r\n"));}for(int i=0;i<5;i++)assertTrue(request(s,"GET",u.getPath(),u.getAuthority(),"").endsWith("{\"samples\":[1,2]}"));assertTrue(s.awaitStopped(2000));assertTrue(s.isClosed());}finally{s.close();}
 }
 @Test public void expiryAndManualCloseTerminateWorkersAndPartialConnections()throws Exception{
  LocalDiagnosticDownload expired=server(40);assertTrue(expired.awaitStopped(2000));assertTrue(expired.isClosed());LocalDiagnosticDownload s=server(300000);URL u=new URL(s.url());try(Socket slow=new Socket(u.getHost(),u.getPort())){slow.getOutputStream().write("GET / HTTP/1.1\r\n".getBytes(StandardCharsets.US_ASCII));s.close();assertTrue(s.awaitStopped(2000));}finally{s.close();}
 }
 @Test public void publicInterfacesOversizedReportsAndLongLifetimesAreRefused()throws Exception{
  try{new LocalDiagnosticDownload(InetAddress.getByName("203.0.113.1"),new byte[1],false,100);fail();}catch(IOException expected){}
  try{new LocalDiagnosticDownload(InetAddress.getByName("127.0.0.1"),new byte[262145],false,100);fail();}catch(IOException expected){}
  try{new LocalDiagnosticDownload(InetAddress.getByName("127.0.0.1"),new byte[1],false,300001);fail();}catch(IOException expected){}
 }
}
