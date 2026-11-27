package top.monitorglobal.tv;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.text.Normalizer;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Opt-in local capture of emergency messages exposed by Android.
 * A simulated dialog / old alert history is NOT evidence of live Cell Broadcast access.
 */
public final class AlertProbeDiagnostics extends Activity {
 private static final String PREF="argos-alert-probe-local";
 private static final int DARK=0xff061018, LIGHT=0xffe8f4f4, MUTED=0xffadc4cb, ACCENT=0xff8adbe7;
 private LinearLayout root;
 private SharedPreferences prefs(){return getSharedPreferences(PREF,MODE_PRIVATE);}
 static SharedPreferences pref(Context c){return c.getSharedPreferences(PREF,MODE_PRIVATE);}
 static String normalized(String s){
  return Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
 }
 static boolean sourceAllowed(String pkg,String self){
  if(pkg==null)return false;
  return pkg.equals(self)||pkg.equals("com.android.settings")||pkg.equals("com.google.android.settings")||
   pkg.equals("com.android.systemui")||pkg.equals("com.samsung.android.cellbroadcastreceiver")||
   pkg.equals("com.sec.android.cellbroadcastreceiver")||pkg.equals("com.android.cellbroadcastreceiver")||
   pkg.equals("com.google.android.cellbroadcastreceiver")||
   pkg.startsWith("com.android.cellbroadcastreceiver.")||
   pkg.startsWith("com.google.android.cellbroadcastreceiver.");
 }
 static boolean hasOfficialWords(String s){
  String n=normalized(s);
  return (n.contains("alerta severo")||n.contains("alerta extremo"))&&n.contains("defesa civil");
 }
 static void found(Context c,String source,String pkg,String value){
  SharedPreferences p=pref(c);
  if(!p.getBoolean("armed",false)||!sourceAllowed(pkg,c.getPackageName())||!hasOfficialWords(value))return;
  boolean simulation=pkg.equals(c.getPackageName());
  long now=System.currentTimeMillis();
  if(simulation && (p.getLong("simulationUntil",0)<now))return;
  String kind=simulation?"SIMULACAO":pkg.contains("settings")?"HISTORICO":"SISTEMA";
  String safe=value.replaceAll("[\\r\\n\\t]+"," ").replaceAll(" +"," ").trim();
  if(safe.length()>650)safe=safe.substring(0,650);
  String fingerprint=normalized(safe);
  if(fingerprint.equals(p.getString("fingerprint",""))&&now-p.getLong("last",0)<30_000)return;
  SharedPreferences.Editor e=p.edit().putString("fingerprint",fingerprint)
   .putLong("last",now).putString("source",source).putString("package",pkg)
   .putString("type",kind).putString("text",safe).putInt("count",p.getInt("count",0)+1);
  if(simulation)e.putLong("simulationUntil",0);
  e.apply();

 }
 public static final class WindowCapture extends AccessibilityService {
  @Override public void onAccessibilityEvent(AccessibilityEvent event){
   if(event==null||!pref(this).getBoolean("armed",false))return;
   int t=event.getEventType();
   if(t!=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED&&t!=AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED&&
      t!=AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED)return;
   String from=String.valueOf(event.getPackageName());
   if(!sourceAllowed(from,getPackageName()))return;
   StringBuilder body=new StringBuilder();
   for(CharSequence s:event.getText())append(body,s);
   try{
    AccessibilityNodeInfo node=getRootInActiveWindow();
    if(node!=null){
     String rootPackage=String.valueOf(node.getPackageName());
     if(from.equals(rootPackage)){int[] seen={0};walk(node,body,seen,0);}
    }
   }catch(RuntimeException ignored){/* System can protect its emergency dialog. */}
   found(this,"ACESSIBILIDADE",from,body.toString());
  }
  private static void append(StringBuilder out,CharSequence s){
   if(s!=null&&s.length()>0&&out.length()<3500)out.append(s).append(' ');
  }
  private static void walk(AccessibilityNodeInfo n,StringBuilder out,int[] count,int depth){
   if(n==null||++count[0]>120||depth>12||out.length()>3500)return;
   append(out,n.getText());append(out,n.getContentDescription());
   int limit=Math.min(40,n.getChildCount());
   for(int i=0;i<limit;i++)walk(n.getChild(i),out,count,depth+1);
  }
  @Override public void onInterrupt(){}
 }
 public static final class NoticeCapture extends NotificationListenerService {
  @Override public void onNotificationPosted(StatusBarNotification sbn){
   if(!pref(this).getBoolean("armed",false)||sbn==null||sbn.getNotification()==null||!sourceAllowed(sbn.getPackageName(),getPackageName()))return;
   Bundle x=sbn.getNotification().extras;
   if(x==null)return;
   String s=String.valueOf(x.getCharSequence(Notification.EXTRA_TITLE,""))+" "+
     String.valueOf(x.getCharSequence(Notification.EXTRA_TEXT,""))+" "+
     String.valueOf(x.getCharSequence(Notification.EXTRA_BIG_TEXT,""));
   found(this,"NOTIFICACAO",sbn.getPackageName(),s);
  }
 }
 @Override public void onCreate(Bundle b){super.onCreate(b);draw();}
 @Override protected void onResume(){super.onResume();draw();}
 private TextView text(String value,int size,int color){
  TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setPadding(8,10,8,10);return t;
 }
 private void line(String s){root.addView(text(s,15,LIGHT));}
 private void button(String s,Runnable action){
  Button b=new Button(this);b.setText(s);b.setAllCaps(false);root.addView(b);
  b.setOnClickListener(v->action.run());
 }
 private boolean accessibilityOn(){
  AccessibilityManager m=(AccessibilityManager)getSystemService(ACCESSIBILITY_SERVICE);
  if(m==null)return false;
  List<AccessibilityServiceInfo> services=m.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
  for(AccessibilityServiceInfo s:services)
   if(s.getResolveInfo()!=null&&s.getResolveInfo().serviceInfo!=null&&
      new ComponentName(this,WindowCapture.class).equals(new ComponentName(s.getResolveInfo().serviceInfo.packageName,s.getResolveInfo().serviceInfo.name)))return true;
  return false;
 }
 private boolean noticeOn(){
  NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  return nm!=null&&nm.isNotificationListenerAccessGranted(
   new ComponentName(this,NoticeCapture.class));
 }
 private void draw(){
  if(isFinishing())return;
  ScrollView screen=new ScrollView(this);screen.setFillViewport(true);screen.setBackgroundColor(DARK);
  root=new LinearLayout(this);root.setPadding(22,22,22,40);root.setOrientation(LinearLayout.VERTICAL);screen.addView(root);
  root.addView(text("CAPTURA LOCAL · DEFESA CIVIL",21,ACCENT));
  line("Captura experimental de alertas severos e extremos da Defesa Civil que o Android disponibiliza. O último resultado fica salvo apenas neste aparelho.");
  SharedPreferences p=prefs();
  boolean enabled=p.getBoolean("armed",false);
  root.addView(text("Monitoramento: "+(enabled?"ATIVADO":"DESATIVADO"),18,enabled?ACCENT:MUTED));
  line("Acessibilidade: "+(accessibilityOn()?"AUTORIZADA":"NÃO AUTORIZADA"));
  line("Notificações do sistema: "+(noticeOn()?"AUTORIZADAS":"NÃO AUTORIZADAS"));
  button(enabled?"Desativar captura":"Ativar captura local",()->{p.edit().putBoolean("armed",!enabled).apply();draw();});
  button("Conceder acessibilidade",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
  button("Conceder acesso às notificações",()->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
  button("SIMULAR janela (não é um alerta real)",()->{
   if(!p.getBoolean("armed",false)){new AlertDialog.Builder(this).setMessage("Ative primeiro a captura local.").setPositiveButton("OK",null).show();return;}
   p.edit().putLong("simulationUntil",System.currentTimeMillis()+15_000).apply();
   new AlertDialog.Builder(this).setTitle("Alerta severo")
    .setMessage("Defesa Civil: TESTE SIMULADO de chuva nas zonas Oeste e Norte. Não é um aviso real. Não requer nenhuma ação.")
    .setPositiveButton("OK",(a,b)->draw()).show();
  });
  root.addView(text("ÚLTIMA DETECÇÃO",19,ACCENT));
  long last=p.getLong("last",0);
  if(last==0)line("Nenhuma janela ou notificação compatível foi detectada.");
  else{
   line("Ocorrências: "+p.getInt("count",0));
   line("Horário: "+new SimpleDateFormat("dd/MM HH:mm:ss",Locale.forLanguageTag("pt-BR")).format(new Date(last)));
   line("Origem: "+p.getString("type","")+" • "+p.getString("source","")+" • "+p.getString("package",""));
   line("Trecho lido: "+p.getString("text",""));
  }
  button("Atualizar resultado",this::draw);
  button("Limpar resultados locais",()->{p.edit().remove("last").remove("count").remove("fingerprint").remove("text").remove("source").remove("type").remove("package").apply();draw();});
  root.addView(text("COMO TESTAR",17,ACCENT));
  line("1. Ative o diagnóstico e autorize Acessibilidade e, opcionalmente, Acesso às notificações.");
  line("2. Use SIMULAR para confirmar que o serviço funciona. Este teste não confirma a leitura do Cell Broadcast.");
  line("3. Abra no Android o histórico de alertas de emergência e volte aqui para verificar se o texto apareceu. O histórico não prova recepção durante um novo alerta.");
  line("4. No próximo alerta real, confira se o Android disponibilizou o texto para a captura.");
  setContentView(screen);
 }
}
