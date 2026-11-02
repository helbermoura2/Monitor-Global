package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.content.pm.*;import android.net.Uri;import android.os.*;import android.provider.Settings;import java.io.*;import java.net.*;import java.security.*;import java.util.concurrent.*;
final class OfficialUpdater {
 interface Status {void set(String message);}
 interface Channel {org.json.JSONObject read() throws Exception;}
 private final Activity activity;private final Status status;private final ExecutorService executor=Executors.newSingleThreadExecutor();private final Handler main=new Handler(Looper.getMainLooper());private volatile boolean closed,busy;private final Channel channel;private AlertDialog currentDialog;private OfficialConfig.Release pendingPermission;
 OfficialUpdater(Activity a,Status s){this(a,s,OfficialConfig::read);}
 OfficialUpdater(Activity a,Status s,Channel reader){activity=a;status=s;channel=reader;}
 private void dialog(AlertDialog.Builder builder){if(closed||activity.isDestroyed()||activity.isFinishing())return;AlertDialog old=currentDialog;currentDialog=null;if(old!=null)old.dismiss();AlertDialog next=builder.create();currentDialog=next;next.setOnDismissListener(d->{if(currentDialog==next)currentDialog=null;});next.show();android.widget.TextView message=next.findViewById(android.R.id.message);if(message!=null)message.setTextIsSelectable(true);}
 private void notice(String title,String message){status.set(message);dialog(new AlertDialog.Builder(activity).setTitle(title).setMessage(message).setPositiveButton("Fechar",null));}
 private void feedback(String message){status.set(message);android.widget.Toast.makeText(activity,message,android.widget.Toast.LENGTH_LONG).show();}
 private void ui(Runnable r){main.post(()->{if(!closed&&!activity.isDestroyed()&&!activity.isFinishing())r.run();});}
 void check(){if(closed)return;if(BuildConfig.DEBUG){notice("Canal oficial","Compilação de desenvolvimento. Instale o APK oficial assinado para usar este canal.");return;}if(busy){feedback("A verificação já está em andamento. Aguarde o resultado.");return;}busy=true;feedback("Conferindo o canal oficial…");executor.execute(()->{try{org.json.JSONObject config=channel.read();OfficialConfig.applyTheme(activity,config);OfficialConfig.Release release=OfficialConfig.release(config);
  ui(()->{busy=false;if(!release.enabled){notice("Canal sem atualização publicada","O canal oficial ainda aguarda uma publicação assinada. Nenhum APK novo está disponível para instalar.");return;}if(!TrustPolicy.newer(BuildConfig.VERSION_CODE,release.code)){notice("Resultado da atualização","Instalada: "+BuildConfig.VERSION_NAME+"\nPublicada no canal oficial: "+release.version+"\n\nNão há um APK mais recente publicado neste canal. Nenhuma instalação foi iniciada.");return;}dialog(new AlertDialog.Builder(activity).setTitle("Atualização oficial "+release.version).setMessage("O aplicativo verificará o arquivo e a assinatura. A instalação precisa da sua confirmação na TV.").setPositiveButton("Baixar e verificar",(d,w)->download(release)).setNegativeButton("Agora não",null));});
 }catch(Exception e){ui(()->{busy=false;notice("Falha ao consultar atualização","Não foi possível consultar o canal oficial. Confira a conexão e tente novamente. Nenhuma atualização foi instalada.");});}});}
 private static String hex(byte[] b){StringBuilder out=new StringBuilder();for(byte n:b)out.append(String.format(java.util.Locale.ROOT,"%02x",n&255));return out.toString();}
 private void download(OfficialConfig.Release release){if(busy||closed)return;pendingPermission=null;busy=true;feedback("Baixando e verificando a atualização oficial…");executor.execute(()->{File part=new File(activity.getCacheDir(),"official-update.part.apk");try{
  HttpURLConnection c=(HttpURLConnection)new URL(release.url).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);MessageDigest digest=MessageDigest.getInstance("SHA-256");
  try{if(c.getResponseCode()!=200)throw new IOException("Download indisponível");if(c.getContentLengthLong()>8*1024*1024)throw new IOException("APK acima do limite");try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(part)){byte[] buffer=new byte[16384];int n,total=0;while((n=in.read(buffer))!=-1){if(closed)throw new IOException("Cancelado");total+=n;if(total>8*1024*1024)throw new IOException("APK acima do limite");digest.update(buffer,0,n);out.write(buffer,0,n);}out.getFD().sync();}}
  finally{c.disconnect();}
  if(!release.sha.equals(hex(digest.digest())))throw new SecurityException("Arquivo diferente da versão publicada");PackageInfo info=activity.getPackageManager().getPackageArchiveInfo(part.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
  if(info==null||!activity.getPackageName().equals(info.packageName)||info.getLongVersionCode()!=release.code||!TrustPolicy.newer(BuildConfig.VERSION_CODE,info.getLongVersionCode())||info.applicationInfo==null||(info.applicationInfo.flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0||info.signingInfo==null||info.signingInfo.hasMultipleSigners())throw new SecurityException("Pacote ou versão inválidos");
  android.content.pm.Signature[] signers=info.signingInfo.getApkContentsSigners();if(signers.length!=1||!BuildConfig.OFFICIAL_SIGNER_SHA256.equals(hex(MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray()))))throw new SecurityException("Assinatura de outro publicador");
  File apk=OfficialApkProvider.apk(activity);if(apk.exists()&&!apk.delete())throw new IOException("Arquivo ocupado");if(!part.renameTo(apk))throw new IOException("Não foi possível preparar instalação");ui(()->{busy=false;verified(release);});
 }catch(Exception e){part.delete();ui(()->{busy=false;notice("Atualização não instalada","A atualização não pôde ser baixada ou validada. Confira a conexão e tente novamente. O aplicativo mantém a verificação de versão e assinatura; nenhum APK foi instalado.");});}});}
 private void verified(OfficialConfig.Release release){
  if(!OfficialApkProvider.apk(activity).isFile()){notice("Arquivo não disponível","O APK verificado não está mais disponível. Verifique a atualização novamente.");return;}
  status.set("Atualização "+release.version+" verificada. Escolha Instalar agora.");
  dialog(new AlertDialog.Builder(activity).setTitle("APK oficial verificado · "+release.version).setMessage("O arquivo e a assinatura foram conferidos. Selecione Instalar agora e confirme no instalador da TV.").setPositiveButton("Instalar agora",(d,w)->install(release)).setNeutralButton("Usar Downloader",(d,w)->downloader(release)).setNegativeButton("Depois",null));
 }
 void resume(){
  if(closed||busy||pendingPermission==null)return;OfficialConfig.Release release=pendingPermission;pendingPermission=null;
  boolean allowed;try{allowed=activity.getPackageManager().canRequestPackageInstalls();}catch(RuntimeException e){downloader(release);return;}
  if(allowed)verified(release);else downloader(release);
 }
 private void install(OfficialConfig.Release release){
  if(closed)return;if(!OfficialApkProvider.apk(activity).isFile()){notice("Arquivo não disponível","Verifique a atualização novamente para preparar o APK.");return;}
  boolean allowed;try{allowed=activity.getPackageManager().canRequestPackageInstalls();}catch(RuntimeException e){downloader(release);return;}
  if(!allowed){status.set("A instalação precisa de autorização do sistema.");
   dialog(new AlertDialog.Builder(activity).setTitle("Autorizar a instalação").setMessage("O APK foi verificado. O Fire Stick precisa autorizar este aplicativo a solicitar instalações. Isso é diferente da permissão de sobreposição. Depois de autorizar, volte ao Monitor Global para continuar.").setPositiveButton("Abrir autorização",(d,w)->{try{pendingPermission=release;activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}catch(RuntimeException e){pendingPermission=null;downloader(release);}}).setNeutralButton("Usar Downloader",(d,w)->downloader(release)).setNegativeButton("Agora não",null));return;
  }
  Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/apk");Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("APK oficial",uri));
  try{activity.startActivity(intent);}catch(RuntimeException e){try{activity.startActivity(new Intent(intent).setAction(Intent.ACTION_INSTALL_PACKAGE));}catch(RuntimeException unavailable){downloader(release);}}
 }
 private void downloader(OfficialConfig.Release release){notice("Atualizar pelo Downloader","Se o Fire OS não abrir a autorização ou o instalador, abra o Downloader e use este endereço oficial:\n\n"+release.url+"\n\nInstale por cima, sem desinstalar o Monitor Global.");}
 void close(){closed=true;busy=false;pendingPermission=null;main.removeCallbacksAndMessages(null);if(currentDialog!=null){currentDialog.dismiss();currentDialog=null;}executor.shutdownNow();}
}
