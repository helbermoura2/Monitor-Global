package top.monitorglobal.tv;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.*;
import com.google.zxing.*;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

/** Owner-operated setup only: never changes app-ops or treats a settings launch as permission. */
final class OverlayPermissionHelp {
 static final String GUIDE="https://github.com/helbermoura2/Monitor-Global/blob/main/android-tv/PERMISSAO_FIRE_TV.md";
 interface Launcher {void start(Intent intent);}
 static boolean openSettings(String packageName,Launcher launcher){
  Intent[] options={
   new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+packageName)),
   new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
   new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+packageName))
  };
  for(Intent intent:options)try{launcher.start(intent);return true;}catch(ActivityNotFoundException|SecurityException ignored){}
  return false;
 }
 static String command(String packageName){return "appops set "+packageName+" SYSTEM_ALERT_WINDOW allow";}
 static String status(android.content.Context c){
  return Settings.canDrawOverlays(c)?"Sobreposição permitida pelo sistema. Volte e use o teste fictício da faixa.":"Permissão ainda não concedida pelo sistema. Abrir configurações não libera a permissão automaticamente.";
 }
 static void show(Activity activity){
  LinearLayout body=new LinearLayout(activity);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(28,12,28,12);
  TextView state=text(activity,body,status(activity));state.setTextSize(20);
  text(activity,body,"A tarja precisa de autorização para aparecer sobre outros aplicativos. Alguns Fire Sticks não oferecem a tela padrão do Android; se nada abrir ou você voltar sem uma opção para permitir, use a ajuda pelo celular.");
  text(activity,body,"Aparelho: "+Build.MANUFACTURER+" "+Build.MODEL+" · Android "+Build.VERSION.RELEASE+" · API "+Build.VERSION.SDK_INT);
  button(activity,body,"Abrir tela de permissão",()->{
   boolean opened=openSettings(activity.getPackageName(),activity::startActivity);
   state.setText(opened?"Procure a opção de exibir sobre outros aplicativos. Se essa opção não aparecer, volte e abra Ajuda pelo celular.":"Este aparelho não abriu uma tela de permissão. Use Ajuda pelo celular.");
  });
  button(activity,body,"Já autorizei · verificar novamente",()->state.setText(status(activity)));
  button(activity,body,"Ajuda pelo celular · QR Code",()->phoneHelp(activity));
  ScrollView scroll=new ScrollView(activity);scroll.addView(body);
  new AlertDialog.Builder(activity).setTitle("Autorizar a faixa na TV / Fire Stick").setView(scroll).setPositiveButton("Fechar",(d,w)->{}).show();
 }
 static void phoneHelp(Activity activity){
  LinearLayout body=new LinearLayout(activity);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(28,12,28,12);
  text(activity,body,"Leia o QR Code com a câmera do celular para abrir o passo a passo. A ajuda funciona também com a versão já instalada; atualizar o APK não concede essa permissão.");
  ImageView image=new ImageView(activity);
  try{
   int side=384;BitMatrix qr=new QRCodeWriter().encode(GUIDE,BarcodeFormat.QR_CODE,side,side);
   int[] pixels=new int[side*side];for(int y=0;y<side;y++)for(int x=0;x<side;x++)pixels[y*side+x]=qr.get(x,y)?Color.BLACK:Color.WHITE;
   image.setImageBitmap(Bitmap.createBitmap(pixels,side,side,Bitmap.Config.ARGB_8888));
   int size=Math.round(210*activity.getResources().getDisplayMetrics().density);
   LinearLayout.LayoutParams box=new LinearLayout.LayoutParams(size,size);box.gravity=android.view.Gravity.CENTER_HORIZONTAL;body.addView(image,box);
  }catch(WriterException|RuntimeException ignored){text(activity,body,"Abra o endereço abaixo no navegador do celular.");}
  TextView address=text(activity,body,GUIDE);address.setTextIsSelectable(true);
  text(activity,body,"No celular, o guia explica como conectar à sua TV e autorizar apenas o Monitor Global. Se o sistema recusar o comando, a permissão continua bloqueada.");
  TextView cmd=text(activity,body,command(activity.getPackageName()));cmd.setTextIsSelectable(true);
  ScrollView scroll=new ScrollView(activity);scroll.addView(body);
  AlertDialog dialog=new AlertDialog.Builder(activity).setTitle("Liberar pelo celular").setView(scroll).setPositiveButton("Fechar",(d,w)->{}).create();
  dialog.setOnDismissListener(d->image.setImageDrawable(null));dialog.show();
 }
 private static TextView text(Activity a,LinearLayout body,String value){TextView t=new TextView(a);t.setText(value);t.setTextColor(Color.WHITE);t.setTextSize(17);t.setPadding(0,8,0,8);body.addView(t);return t;}
 private static void button(Activity a,LinearLayout body,String value,Runnable action){Button b=new Button(a);b.setText(value);b.setAllCaps(false);b.setOnClickListener(v->action.run());body.addView(b);}
}
