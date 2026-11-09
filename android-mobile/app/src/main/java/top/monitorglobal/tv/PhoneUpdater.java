package top.monitorglobal.tv;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import top.monitorglobal.mobile.BuildConfig;
import java.io.*;
import java.security.*;
import java.util.Locale;
import java.util.concurrent.*;

/** Opt-in preview updater. Hash, version, package and signer checked before installer. */
final class PhoneUpdater {
 private final Activity activity;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private boolean busy,closed,waitingPermission;
 private PhoneUpdateChannel.Release verified;
 private AlertDialog dialog;
 PhoneUpdater(Activity a){activity=a;}
 private void ui(Runnable callback){main.post(()->{if(!closed&&!activity.isFinishing()&&!activity.isDestroyed())callback.run();});}
 private void show(String title,String message,PhoneUpdateChannel.Release release,boolean install){
  if(closed||activity.isFinishing()||activity.isDestroyed())return;
  if(dialog!=null){dialog.dismiss();dialog=null;}
  AlertDialog.Builder builder=new AlertDialog.Builder(activity).setTitle(title).setMessage(message).setNegativeButton("Fechar",null);
  if(release!=null){if(install)builder.setPositiveButton("Instalar agora",(d,w)->install());else builder.setPositiveButton("Baixar e verificar",(d,w)->download(release));}
  dialog=builder.show();
 }
 void check(){
  if(closed||busy)return;
  if(!PhoneUpdateChannel.PACKAGE.equals(activity.getPackageName())){show("Canal de testes","Esta versão usa outro pacote Android. A atualização interna do canal de testes não é compatível com ela.",null,false);return;}
  busy=true;show("Verificando atualização","Conferindo a versão publicada no GitHub…",null,false);
  executor.execute(()->{try{
   PhoneUpdateChannel.Release r=PhoneUpdateChannel.read();
   ui(()->{busy=false;if(r==null){show("Canal de testes","Ainda não há APK disponível neste canal.",null,false);return;}
    if(r.code<=BuildConfig.VERSION_CODE){show("Versão atualizada","Instalada: "+BuildConfig.VERSION_NAME+"\nCanal de testes: "+r.name+"\n\nNão há versão mais recente para instalar.",null,false);return;}
    show("Nova versão "+r.name,"Há uma atualização de teste disponível. O aplicativo vai conferir o arquivo e a assinatura antes de abrir o instalador do Android.",r,false);
   });
  }catch(Exception error){ui(()->{busy=false;show("Não foi possível verificar","O canal pode ainda não ter o arquivo de atualização ou a internet pode estar indisponível. Nenhum APK foi instalado.",null,false);});}});
 }
 private static String hex(byte[] bytes){StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
 private String cert(PackageInfo info)throws Exception{
  if(info==null||info.signingInfo==null||info.signingInfo.hasMultipleSigners())throw new SecurityException("Assinatura não encontrada");
  Signature[] signers=info.signingInfo.getApkContentsSigners();
  if(signers==null||signers.length!=1)throw new SecurityException("Assinatura não reconhecida");
  return hex(MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray()));
 }
 private void download(PhoneUpdateChannel.Release r){
  if(closed||busy)return;busy=true;verified=null;show("Baixando atualização","Conferindo integridade e assinatura. O download acontece dentro do aplicativo.",null,false);
  executor.execute(()->{File part=new File(activity.getCacheDir(),"phone-update.part.apk");HttpURLConnection conn=null;
   try{
    conn=PhoneUpdateChannel.open(r.url);
    if(conn.getContentLengthLong()>PhoneUpdateChannel.MAX_APK)throw new IOException("APK acima do limite");
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    try(InputStream in=conn.getInputStream();FileOutputStream out=new FileOutputStream(part)){
     byte[] buf=new byte[16384];int n;long size=0;
     while((n=in.read(buf))!=-1){
      if(closed||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Cancelado");
      size+=n;if(size>PhoneUpdateChannel.MAX_APK)throw new IOException("APK acima do limite");
      digest.update(buf,0,n);out.write(buf,0,n);
     }out.getFD().sync();
    }
    if(!r.sha.equals(hex(digest.digest())))throw new SecurityException("Hash diferente");
    PackageManager pm=activity.getPackageManager();
    PackageInfo candidate=pm.getPackageArchiveInfo(part.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
    PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
    if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.getLongVersionCode()!=r.code||r.code<=BuildConfig.VERSION_CODE||!r.name.equals(candidate.versionName))throw new SecurityException("Pacote ou versão inválidos");
    String signer=cert(candidate);
    if(!signer.equals(r.certificate)||!signer.equals(cert(installed)))throw new SecurityException("Assinatura diferente da instalação atual");
    File apk=PhoneUpdateProvider.apk(activity);
    if(apk.exists()&&!apk.delete())throw new IOException("Arquivo ocupado");
    if(!part.renameTo(apk))throw new IOException("Falha ao preparar o APK");
    ui(()->{busy=false;verified=r;ready();});
   }catch(Exception error){part.delete();ui(()->{busy=false;verified=null;show("Atualização não instalada","Não foi possível validar o APK. A versão instalada permanece inalterada.",null,false);});}
   finally{if(conn!=null)conn.disconnect();}
  });
 }
 private void ready(){
  if(verified==null||!PhoneUpdateProvider.apk(activity).isFile()){show("Arquivo indisponível","Verifique a atualização novamente.",null,false);return;}
  show("APK verificado · "+verified.name,"Versão e assinatura conferidas. Ao tocar em Instalar agora, o Android solicitará sua confirmação.",verified,true);
 }
 private void install(){
  if(verified==null||!PhoneUpdateProvider.apk(activity).isFile()){show("Arquivo indisponível","Verifique a atualização novamente.",null,false);return;}
  if(!activity.getPackageManager().canRequestPackageInstalls()){
   if(dialog!=null){dialog.dismiss();dialog=null;}
   dialog=new AlertDialog.Builder(activity).setTitle("Autorizar instalação").setMessage("O Android precisa permitir que o Monitor Global solicite a instalação de novas versões. Ative a permissão e volte ao aplicativo; a instalação ainda solicitará sua confirmação.").setPositiveButton("Abrir permissão",(d,w)->{
    try{waitingPermission=true;activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}catch(RuntimeException e){waitingPermission=false;show("Permissão indisponível","Não foi possível abrir as configurações do Android.",null,false);}
   }).setNegativeButton("Agora não",null).show();return;
  }
  waitingPermission=false;Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/apk");
  Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
  intent.setClipData(ClipData.newRawUri("Atualização Monitor Global",uri));
  try{activity.startActivity(intent);}catch(RuntimeException error){show("Instalador indisponível","O Android não abriu o instalador. A versão atual permanece instalada.",null,false);}
 }
 void resume(){
  if(closed||!waitingPermission)return;
  waitingPermission=false;
  if(activity.getPackageManager().canRequestPackageInstalls())ready();
  else show("Permissão pendente","Para atualizar dentro do aplicativo, autorize a instalação na configuração do Android.",null,false);
 }
 void close(){closed=true;busy=false;waitingPermission=false;verified=null;executor.shutdownNow();main.removeCallbacksAndMessages(null);if(dialog!=null){dialog.dismiss();dialog=null;}}
}
