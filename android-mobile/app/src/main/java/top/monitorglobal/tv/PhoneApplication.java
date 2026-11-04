package top.monitorglobal.tv;
public final class PhoneApplication extends android.app.Application {
 @Override public void onCreate(){super.onCreate();PhonePush.channels(this);PhonePush.initialize(this);}
}
