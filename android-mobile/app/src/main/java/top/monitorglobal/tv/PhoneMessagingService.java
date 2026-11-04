package top.monitorglobal.tv;
import android.app.*;
import android.content.Intent;
import com.google.firebase.messaging.*;
import top.monitorglobal.mobile.R;
public final class PhoneMessagingService extends FirebaseMessagingService {
 @Override public void onNewToken(String token){if(PhonePush.enabled(this)&&PhonePush.configured())FirebaseMessaging.getInstance().subscribeToTopic(PhonePush.TOPIC);}
 @android.annotation.SuppressLint("MissingPermission")
 @Override public void onMessageReceived(RemoteMessage message){
  if(!PhonePush.enabled(this)||!PhonePush.allowed(this))return;
  String raw=message.getData().get("alert");Alert a=PhonePushPayload.parse(raw,System.currentTimeMillis());if(a==null)return;
  String tag=PhonePushPayload.tag(a.id),last=PhonePush.prefs(this).getString(tag,"");if(last.equals(a.version))return;
  PhonePush.channels(this);String channel=a.quietInformation()?"information":a.kind.equals("tsunami")?"tsunami":"seismic";
  Intent intent=new Intent(this,PhoneActivity.class).putExtra(PhonePush.EXTRA,raw).setAction(tag).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent tap=PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification notification=new Notification.Builder(this,channel).setSmallIcon(R.drawable.ic_notification).setContentTitle(a.title).setContentText(a.detail).setStyle(new Notification.BigTextStyle().bigText(a.detail)).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_EVENT).build();
  try{getSystemService(NotificationManager.class).notify(tag,0,notification);PhonePush.prefs(this).edit().putString(tag,a.version).apply();pruneHistory();}catch(SecurityException ignored){}
 }
 private void pruneHistory(){android.content.SharedPreferences p=PhonePush.prefs(this);java.util.List<String> keys=new java.util.ArrayList<>();for(String k:p.getAll().keySet())if(k.startsWith("push-"))keys.add(k);if(keys.size()>120){android.content.SharedPreferences.Editor e=p.edit();for(int i=0;i<keys.size()-120;i++)e.remove(keys.get(i));e.apply();}}
}
