package top.monitorglobal.tv;
import android.content.*;import android.view.*;import android.widget.*;import android.os.*;import android.graphics.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class CompactNoticeTest {
 private Context c;
 private Object field(Object o,String name)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(o);}
 private String texts(View v){if(v instanceof TextView)return ((TextView)v).getText().toString();StringBuilder out=new StringBuilder();if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)out.append(texts(((ViewGroup)v).getChildAt(i))).append(" ");return out.toString();}
 private Alert sample(){Alert a=new Alert("demo","earthquake","v","M5,4 · Katmandu, Nepal","","earthquake",1800000000000L,1800000000000L,false);a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";a.targetArea="Katmandu · Nepal";a.countryCode="NP";return a;}
 private Bitmap draw(View v){int width=((WindowManager.LayoutParams)v.getLayoutParams()).width;v.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(900,View.MeasureSpec.AT_MOST));v.layout(0,0,width,v.getMeasuredHeight());v.setAlpha(1);v.setTranslationY(0);Bitmap b=Bitmap.createBitmap(width,v.getHeight(),Bitmap.Config.ARGB_8888);v.draw(new Canvas(b));return b;}
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("sound",false).commit();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);}
 @Test public void compactCardDrawsAndClosesWithoutKeepingAnOverlayToneOrFlag()throws Exception{
  CompactNotice card=new CompactNotice(c);card.show(sample(),true);View view=(View)field(card,"current");assertNotNull(view);WindowManager.LayoutParams p=(WindowManager.LayoutParams)view.getLayoutParams();assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);
  Bitmap flag=(Bitmap)field(card,"countryFlag");assertNotNull(flag);assertNotNull(field(card,"flagView"));
  Bitmap b=draw(view);try{assertTrue(view.getHeight()<c.getResources().getDisplayMetrics().heightPixels/2);assertTrue(Color.alpha(b.getPixel(b.getWidth()/2,20))>200);assertEquals("lower outer corners are softly clipped",0,Color.alpha(b.getPixel(0,b.getHeight()-1)));int redFlag=0;for(int y=0;y<b.getHeight();y++)for(int x=0;x<b.getWidth();x++){int pixel=b.getPixel(x,y);if(Color.red(pixel)>150&&Color.green(pixel)<100&&Color.blue(pixel)<150&&Color.alpha(pixel)>200)redFlag++;}assertTrue("Nepal flag must be drawn, not a radar placeholder",redFlag>30);String content=texts(view);assertTrue(content.contains("AVISO SÍSMICO REGIONAL · FICTÍCIO"));assertTrue(content.contains("M5,4"));assertTrue(content.contains("Katmandu, Nepal"));assertTrue(content.contains("Profundidade: 12 km"));assertTrue(content.contains("Fonte: EXEMPLO"));assertTrue(content.contains("Danos: sem informação"));assertFalse(content.contains("Área monitorada: Katmandu"));try(java.io.FileOutputStream stream=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-target-card.png"))){b.compress(Bitmap.CompressFormat.PNG,100,stream);}}finally{b.recycle();}
  Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));assertNotNull("Regional notice remains visible beyond the old 8-second limit",field(card,"current"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(6));assertNull(field(card,"current"));assertNull(field(card,"tone"));assertNull(field(card,"countryFlag"));assertTrue(flag.isRecycled());card.show(sample(),true);card.hide();assertNull(field(card,"current"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(16));assertNull(field(card,"current"));
 }
 @Test public void unknownCountryAndMissingMetricsNeverInventAFlagOrZero()throws Exception{
  CompactNotice card=new CompactNotice(c);Alert a=new Alert("ocean","earthquake","v","M5,1 · Oceano Pacífico","","earthquake",1,0,false);a.magnitude=5.1;
  try{card.show(a,false);View view=(View)field(card,"current");assertNotNull(view);assertNull(field(card,"countryFlag"));assertNull(field(card,"flagView"));Bitmap b=draw(view);b.recycle();String content=texts(view);assertTrue(content.contains("Profundidade não informada"));assertTrue(content.contains("Horário não informado"));assertTrue(content.contains("Fonte não informada"));assertFalse(content.contains("0 km"));assertFalse(content.contains("NaN"));}finally{card.hide();}
 }
 @Test public void reducedMotionRetainsTheSameDataAndImmediatePreemptionRecyclesTheFlag()throws Exception{
  java.lang.reflect.Method scale=android.animation.ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);scale.invoke(null,0f);CompactNotice card=new CompactNotice(c);
  try{card.show(sample(),true);View view=(View)field(card,"current");assertEquals(1,view.getAlpha(),0);assertEquals(0,view.getTranslationY(),0);Bitmap flag=(Bitmap)field(card,"countryFlag");card.hide();assertNull(field(card,"current"));assertTrue(flag.isRecycled());Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));assertNull(field(card,"current"));}finally{card.hide();scale.invoke(null,1f);}
 }
 @Test public void regionalReplayShowsOriginalDateAndNeverPlaysNotificationSound()throws Exception{
  Prefs.get(c).edit().putBoolean("sound",true).commit();
  Alert a=sample();a.compact=true;
  CompactNotice card=new CompactNotice(c);
  try{
   card.show(a,false,true);
   View v=(View)field(card,"current");assertNotNull(v);
   String content=texts(v);
   assertTrue(content.contains("REPLAY · SISMO REGIONAL"));
   assertTrue(content.matches("(?s).*\\d{2}/\\d{2}/\\d{4}.*"));
   assertTrue("Replay must not create another alert sound",field(card,"tone")==null);
   assertTrue(v.getContentDescription().toString().contains("Replay histórico"));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));
   assertNotNull(field(card,"current"));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(6));
   assertNull(field(card,"current"));
  }finally{card.hide();}
 }
 @Test public void onlyRealEligibleM5NoticeIsPersistedForOfflineReplay()throws Exception{
  Alert a=sample();a.compact=true;
  Prefs.rememberTarget(c,a);
  Alert saved=Prefs.lastTarget(c);
  assertNotNull(saved);assertEquals(a.id,saved.id);assertEquals(a.targetArea,saved.targetArea);
  assertEquals(a.eventTime,saved.eventTime);
  Alert ineligible=sample();ineligible.compact=false;Prefs.rememberTarget(c,ineligible);
  assertEquals(a.id,Prefs.lastTarget(c).id);
  Alert m6=sample();m6.compact=true;m6.magnitude=6.1;Prefs.rememberTarget(c,m6);
  assertEquals(a.id,Prefs.lastTarget(c).id);
  Alert deep=sample();deep.compact=true;deep.depth=100;Prefs.rememberTarget(c,deep);
  assertEquals(a.id,Prefs.lastTarget(c).id);
 }
 @Test public void targetBaselineAndCompactCodecSurviveRestart()throws Exception{Prefs.get(c).edit().clear().commit();AlertTracker t=new AlertTracker();t.targetsReady=true;Prefs.save(c,t);assertTrue(Prefs.tracker(c).targetsReady);Alert a=new Alert("demo","earthquake","v","test","","earthquake",1,1,false);a.targetArea="Katmandu · Nepal";a.compact=true;Alert b=AlertCodec.read(AlertCodec.write(a));assertTrue(b.compact);assertEquals(a.targetArea,b.targetArea);}
}
