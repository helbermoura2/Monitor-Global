package top.monitorglobal.tv;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** Explicit owner-started, short-lived download of one immutable report on the LAN. */
final class LocalDiagnosticDownload implements AutoCloseable {
 static final int MAX_BYTES=262144;
 static final long DURATION_MS=300000;
 private final ServerSocket listener;
 private final ScheduledExecutorService expiry;
 private final Thread worker;
 private final byte[] data;
 private final String path,host,filename;
 private volatile Socket active;
 private volatile boolean closed;
 private int downloads;
 LocalDiagnosticDownload(InetAddress address,byte[] snapshot,boolean previous,long lifetime) throws IOException {
  if(!(address instanceof Inet4Address)||(!address.isSiteLocalAddress()&&!address.isLoopbackAddress()))throw new IOException("Rede local indisponível");
  if(snapshot.length==0||snapshot.length>MAX_BYTES||lifetime<=0||lifetime>DURATION_MS)throw new IOException("Relatório ou prazo inválido");
  data=snapshot.clone();filename=previous?"monitor-global-tv-diagnostico-anterior.json":"monitor-global-tv-diagnostico.json";
  byte[] secret=new byte[16];new SecureRandom().nextBytes(secret);StringBuilder token=new StringBuilder();for(byte b:secret)token.append(String.format(Locale.ROOT,"%02x",b&255));
  path="/"+token+"/"+filename;
  listener=new ServerSocket(0,2,address);host=address.getHostAddress()+":"+listener.getLocalPort();
  expiry=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"diagnostic-download-expiry");t.setDaemon(true);return t;});
  worker=new Thread(this::serve,"diagnostic-download");worker.setDaemon(true);worker.start();expiry.schedule(this::close,lifetime,TimeUnit.MILLISECONDS);
 }
 String url(){return "http://"+host+path;}
 boolean isClosed(){return closed;}
 private void serve(){
  try{while(!closed){try(Socket socket=listener.accept()){
   active=socket;if(closed)break;socket.setSoTimeout(1500);handle(socket);
  }catch(IOException ignored){/* A partial/disconnected client does not retain resources. */}finally{active=null;}}}
  finally{close();}
 }
 private String line(InputStream in,int[] size)throws IOException{
  ByteArrayOutputStream out=new ByteArrayOutputStream();for(;;){int c=in.read();if(c<0)throw new EOFException();if(++size[0]>4096)throw new IOException("Pedido acima do limite");if(c=='\n')break;if(c!='\r')out.write(c);}return out.toString("US-ASCII");
 }
 private void handle(Socket socket)throws IOException{
  InputStream in=socket.getInputStream();int[] size={0};String[] request=line(in,size).split(" ");String suppliedHost="",origin="";boolean malformed=false;
  for(;;){String h=line(in,size);if(h.isEmpty())break;int colon=h.indexOf(':');if(colon<1){malformed=true;continue;}String name=h.substring(0,colon).trim(),value=h.substring(colon+1).trim();if(name.equalsIgnoreCase("Host")){if(!suppliedHost.isEmpty())malformed=true;suppliedHost=value;}if(name.equalsIgnoreCase("Origin"))origin=value;}
  if(malformed||request.length!=3||!host.equals(suppliedHost)||(!origin.isEmpty()&&!origin.equals("http://"+host))){reply(socket,400,false);return;}
  if(!request[1].equals(path)){reply(socket,404,false);return;}
  if(!request[0].equals("GET")&&!request[0].equals("HEAD")){reply(socket,405,false);return;}
  boolean get=request[0].equals("GET");reply(socket,200,get);if(get&&++downloads>=5)close();
 }
 private void reply(Socket socket,int status,boolean body)throws IOException{
  String reason=status==200?"OK":status==404?"Not Found":status==405?"Method Not Allowed":"Bad Request";
  String headers="HTTP/1.1 "+status+" "+reason+"\r\nContent-Type: application/json\r\nContent-Length: "+(status==200?data.length:0)+"\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n"+(status==200?"Content-Disposition: attachment; filename=\""+filename+"\"\r\n":"")+"\r\n";
  OutputStream out=socket.getOutputStream();out.write(headers.getBytes(StandardCharsets.US_ASCII));if(body)out.write(data);out.flush();
 }
 @Override public synchronized void close(){if(closed)return;closed=true;try{listener.close();}catch(IOException ignored){}Socket socket=active;if(socket!=null)try{socket.close();}catch(IOException ignored){}expiry.shutdownNow();}
 boolean awaitStopped(long millis)throws InterruptedException{worker.join(millis);return !worker.isAlive()&&expiry.awaitTermination(millis,TimeUnit.MILLISECONDS);}
}
