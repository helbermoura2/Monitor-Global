package top.monitorglobal.tv;
import android.content.*;
public final class BootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent i){if((!Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction()))||!Prefs.get(c).getBoolean("enabled",false))return;try{c.startForegroundService(new Intent(c,MonitorService.class).setAction(MonitorService.START));}catch(RuntimeException e){Prefs.status(c,"Abra o aplicativo para retomar o monitoramento.");}}
}
