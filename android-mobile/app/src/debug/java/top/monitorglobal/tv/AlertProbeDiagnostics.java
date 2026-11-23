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
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import android.view.View;
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
 * Opt-in, debug-only local diagnostic. Nothing read here is uploaded or forwarded.
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
  // History displayed inside Settings must NEVER be relayed as a new emergency.
  if(!"HISTORICO".equals(kind))
   PhoneCivilRelay.send(c,safe,simulation,source,pkg,now,null);
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
   if(sbn==null||sbn.getNotification()==null||!sourceAllowed(sbn.getPackageName(),getPackageName()))return;
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
      s.getResolveInfo().serviceInfo.name.contains("AlertProbeDiagnostics$WindowCapture"))return true;
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
  root.addView(text("ARGOS ORBIS • DIAGNOSTICO LOCAL",21,ACCENT));
  line("Teste experimental de alertas do Android. Com vínculo e envio ativados, mensagens compatíveis são encaminhadas à sua TV pelo Worker. A fonte é o celular e NÃO equivale a CAP confirmado.");
  SharedPreferences p=prefs();
  boolean enabled=p.getBoolean("armed",false);
  root.addView(text("Monitoramento: "+(enabled?"ATIVADO":"DESATIVADO"),18,enabled?ACCENT:MUTED));
  line("Acessibilidade: "+(accessibilityOn()?"AUTORIZADA":"NAO AUTORIZADA"));
  line("Notificações do sistema: "+(noticeOn()?"AUTORIZADAS":"NAO AUTORIZADAS"));
  button(enabled?"Desativar diagnóstico":"Ativar diagnóstico local",()->{p.edit().putBoolean("armed",!enabled).apply();draw();});
  button("Conceder acessibilidade",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
  button("Conceder acesso às notificações",()->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
  root.addView(text("CONEXÃO COM A TV",19,ACCENT));
  line("TV: "+(PhoneCivilRelay.paired(this)?"VINCULADA":"NÃO VINCULADA"));
  line("Envio automático: "+(PhoneCivilRelay.forwarding(this)?"ATIVADO":"DESATIVADO"));
  line("Última tentativa: "+PhoneCivilRelay.prefs(this).getString("status","Nenhum envio realizado."));
  button("Vincular à TV (código de 8 dígitos)",()->{
   final android.widget.EditText input=new android.widget.EditText(this);
   input.setSingleLine(true);
   input.setHint("Código exibido na TCL P7K");
   input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
   new AlertDialog.Builder(this).setTitle("Argos Orbis · Vincular celular à TV")
    .setMessage("Na TV: Defesa Civil → Vincular celulares. Digite aqui o código de 8 dígitos, válido por 10 minutos.")
    .setView(input)
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Vincular",(dialog,which)->PhoneCivilRelay.pair(this,input.getText().toString().trim(),message->{
     new AlertDialog.Builder(this).setTitle("Vínculo com a TV").setMessage(message).setPositiveButton("Entendi",(a,b)->draw()).show();
    })).show();
  });
  button(PhoneCivilRelay.forwarding(this)?"Desativar envio automático para TV":"Ativar envio automático para TV",()->{
   if(PhoneCivilRelay.forwarding(this)){PhoneCivilRelay.disable(this);draw();return;}
   if(!PhoneCivilRelay.paired(this)){
    new AlertDialog.Builder(this).setMessage("Vincule o celular à TCL P7K antes de ativar o envio.").setPositiveButton("OK",null).show();return;
   }
   new AlertDialog.Builder(this).setTitle("Autorizar envio de alertas à TV?")
    .setMessage("Somente alertas Severos/Extremos detectados de aplicativos do sistema e simulações solicitadas. O texto segue ao Cloudflare e à sua TV. Não é verificação independente da Defesa Civil ou CAP. O histórico não é enviado como alerta novo.")
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Ativar",(a,b)->{PhoneCivilRelay.prefs(this).edit().putBoolean("forwarding",true).apply();draw();}).show();
  });
  button("Enviar TESTE para a TV pelo Worker",()->PhoneCivilRelay.test(this,message->{
   new AlertDialog.Builder(this).setTitle("Teste de transmissão para a TV").setMessage(message)
    .setPositiveButton("OK",(a,b)->draw()).show();
  }));
  button("Desvincular esta TV e apagar credencial",()->new AlertDialog.Builder(this)
   .setTitle("Desvincular Argos Orbis da TV?").setMessage("O celular deixará de enviar novos avisos. A TV mantém o próprio vínculo até você o redefinir.")
   .setNegativeButton("Cancelar",null).setPositiveButton("Desvincular",(a,b)->{PhoneCivilRelay.forget(this);draw();}).show());
  button("SIMULAR janela (não é um alerta real)",()->{
   if(!p.getBoolean("armed",false)){new AlertDialog.Builder(this).setMessage("Ative primeiro o diagnóstico local.").setPositiveButton("OK",null).show();return;}
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
  line("4. Para testar a TV, gere o código nela, vincule este celular e ATIVE o envio. Toque 'Enviar TESTE para a TV'.");
  line("5. Mantenha o detector autorizado no próximo Cell Broadcast real. Se for lido, o sistema tentará retransmitir à TV; não é garantido se o Android ocultar o texto.");
  setContentView(screen);
 }
}
