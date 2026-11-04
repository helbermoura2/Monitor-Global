package top.monitorglobal.tv;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import top.monitorglobal.mobile.BuildConfig;
/** Opt-in only. No polling service, location or overlay permission. */
final class PhonePush {
 static final String TOPIC="monitor_global_alerts_v1",EXTRA="monitor_push_alert";
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("phone-push",Context.MODE_PRIVATE);}
 static boolean configured(){return !BuildConfig.PUSH_APP_ID.isEmpty()&&!BuildConfig.PUSH_API_KEY.isEmpty()&&!BuildConfig.PUSH_PROJECT_ID.isEmpty();}
 static boolean enabled(Context c){return prefs(c).getBoolean("enabled",false);}
 static boolean allowed(Context c){return (Build.VERSION.SDK_INT<33||c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")==PackageManager.PERMISSION_GRANTED)&&c.getSystemService(NotificationManager.class).areNotificationsEnabled();}
 static void channels(Context c){NotificationManager n=c.getSystemService(NotificationManager.class);n.createNotificationChannel(new NotificationChannel("seismic","Sismos",NotificationManager.IMPORTANCE_HIGH));n.createNotificationChannel(new NotificationChannel("tsunami","Avisos de tsunami",NotificationManager.IMPORTANCE_HIGH));NotificationChannel quiet=new NotificationChannel("information","Boletins informativos",NotificationManager.IMPORTANCE_LOW);n.createNotificationChannel(quiet);}
 static void initialize(Context c){if(!configured()||!enabled(c))return;try{if(FirebaseApp.getApps(c).isEmpty())FirebaseApp.initializeApp(c,new FirebaseOptions.Builder().setApplicationId(BuildConfig.PUSH_APP_ID).setApiKey(BuildConfig.PUSH_API_KEY).setProjectId(BuildConfig.PUSH_PROJECT_ID).setGcmSenderId(BuildConfig.PUSH_SENDER_ID).build());FirebaseMessaging.getInstance().setAutoInitEnabled(true);}catch(RuntimeException e){prefs(c).edit().putString("status","Falha ao iniciar notificações. Tente ativar novamente.").apply();}}
 static void enable(Activity c,Runnable done){if(!configured()||!allowed(c)){done.run();return;}prefs(c).edit().putBoolean("enabled",true).putString("status","Ativando notificações…").apply();initialize(c);try{FirebaseMessaging.getInstance().subscribeToTopic(TOPIC).addOnCompleteListener(c,task->{prefs(c).edit().putString("status",task.isSuccessful()?"Inscrição push confirmada. A entrega depende da conexão e do Android.":"Inscrição pendente. Toque em ativar para tentar novamente.").apply();done.run();});}catch(RuntimeException e){prefs(c).edit().putString("status","Falha na inscrição. Tente novamente.").apply();done.run();}}
 static void disable(Context c){prefs(c).edit().putBoolean("enabled",false).putString("status","Notificações desativadas neste aplicativo.").apply();try{FirebaseMessaging.getInstance().unsubscribeFromTopic(TOPIC);FirebaseMessaging.getInstance().setAutoInitEnabled(false);}catch(RuntimeException ignored){}}
 static String status(Context c){if(!configured())return "O envio push aguarda a configuração do Firebase nesta versão.";if(!enabled(c))return "Notificações desativadas. Ative para receber avisos mesmo fora do aplicativo.";if(!allowed(c))return "O Android bloqueou as notificações. Confira as configurações do aplicativo.";return prefs(c).getString("status","Confirmando inscrição push…");}
}
