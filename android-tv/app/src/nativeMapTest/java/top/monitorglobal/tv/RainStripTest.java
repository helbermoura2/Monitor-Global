package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.shadows.ShadowSettings;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RainStripTest {
 private Object field(Object target,String name)throws Exception{
  java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);
 }
 private String texts(View v){
  if(v instanceof TextView)return ((TextView)v).getText().toString();
  StringBuilder s=new StringBuilder();
  if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)s.append(texts(((ViewGroup)v).getChildAt(i))).append(' ');
  return s.toString();
 }
 private RainForecast.Summary forecast(int arrival,boolean knownEnd,boolean pauses)throws Exception{
  long now=System.currentTimeMillis()/60000*60000;JSONArray points=new JSONArray();
  for(int i=0;i<120;i++){
   boolean wet=arrival>=0&&i>=arrival&&(!knownEnd||i<arrival+35)&&(!pauses||i<arrival+10||i>=arrival+14);
   points.put(new JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000)
     .put("rate",wet?3:0).put("type",wet?"rain":"no_precipitation"));
  }
  return RainForecast.summarize(new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true)
   .put("at",now).put("expiresAt",now+600000)
   .put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE))
   .put("forecast",points),now);
 }
 private void render(String name)throws Exception{
  Context c=RuntimeEnvironment.getApplication();ShadowSettings.setCanDrawOverlays(true);
  RainOverlay overlay=new RainOverlay(c);RainForecast.Summary rain=forecast(8,true,false);
  int width=c.getResources().getDisplayMetrics().widthPixels,height=c.getResources().getDisplayMetrics().heightPixels;
  try{
   assertTrue(overlay.showRain(rain,false,true,null,false,null));
   FrameLayout host=(FrameLayout)field(overlay,"current");
   WindowManager.LayoutParams p=(WindowManager.LayoutParams)host.getLayoutParams();
   assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);
   assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);
   assertEquals(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL,p.gravity);
   assertTrue("News lower-third spans most of the display",p.width>width*.8);
   assertTrue("News lower-third keeps room for the map",p.height<height);
   host.measure(View.MeasureSpec.makeMeasureSpec(p.width,View.MeasureSpec.EXACTLY),
     View.MeasureSpec.makeMeasureSpec(p.height,View.MeasureSpec.EXACTLY));
   host.layout(0,0,p.width,p.height);
   View line=host.getChildAt(0);
   assertTrue(line instanceof TvBroadcastInfoView);
   assertTrue("Geographic map above AO VIVO",((TvBroadcastInfoView)line).mapSpace>0);
   ((TvBroadcastInfoView)line).startPresentation(android.os.SystemClock.uptimeMillis()-500,false);
   String content=String.valueOf(line.getContentDescription());
   assertTrue(content.contains("Chuva prevista em ~8 min"));
   assertTrue(content.contains("1,8 mm"));
   assertTrue(content.contains("SIMULAÇÃO FICTÍCIA"));
   assertFalse(content.contains("18°C"));
   Bitmap screenshot=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
   Canvas canvas=new Canvas(screenshot);canvas.drawColor(0xff293f51);canvas.save();
   canvas.translate((width-p.width)/2f,height-p.height-p.y);
   host.draw(canvas);canvas.restore();
   try(FileOutputStream out=new FileOutputStream(new File(System.getProperty("java.io.tmpdir"),"monitor-tv-weather-strip-"+name+".png"))){
    assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG,100,out));
   }finally{screenshot.recycle();}
  }finally{overlay.hide();}
 }
 @Test public void incomingRainUsesBreakingNews720p()throws Exception{render("720p");}
 @Test @Config(qualifiers="w640dp-h360dp-land-hdpi") public void smallTvStillHasItsBroadcasterMap()throws Exception{render("540p");}
 @Test @Config(qualifiers="w960dp-h540dp-land-xhdpi") public void fullHdRetainsNewsroomStripe()throws Exception{render("1080p");}
 @Test public void oldRainDataStillRejectsFictitiousMissingValues()throws Exception{
  Context c=RuntimeEnvironment.getApplication();
  String unknown=texts(new RainStripView(c,forecast(0,false,false),false,false));
  assertTrue(unknown.contains("duração indefinida"));assertFalse(unknown.contains("~0 min"));
  String intermittent=texts(new RainStripView(c,forecast(8,true,true),false,false));
  assertTrue(intermittent.contains("janela ~35 min"));
  RainForecast.Summary missing=new RainForecast.Summary("soon","fraca","Chuva prevista",0,Double.NaN,
   "Término indefinido",System.currentTimeMillis(),System.currentTimeMillis()+600000,false);
  String unavailable=texts(new RainStripView(c,missing,false,false));
  assertTrue(unavailable.contains("Intensidade indisponível"));
  assertTrue(unavailable.contains("Acumulado indisponível"));
  assertFalse(unavailable.contains("0,0 mm"));
  String dry=texts(new RainStripView(c,forecast(-1,true,false),false,false));
  assertTrue(dry.contains("Sem chuva estimada"));assertFalse(dry.contains("Moderada"));
 }
 @Test public void activeRainKeepsFullScreenAtmosphereBEHINDTheBroadcastWindow()throws Exception{
  Context c=RuntimeEnvironment.getApplication();ShadowSettings.setCanDrawOverlays(true);
  RainOverlay overlay=new RainOverlay(c);
  try{
   assertTrue(overlay.showRain(forecast(0,true,false),true,true,null,false,null));
   FrameLayout host=(FrameLayout)field(overlay,"current");
   WindowManager.LayoutParams p=(WindowManager.LayoutParams)host.getLayoutParams();
   assertTrue(p.width>0);assertTrue(p.height>0);
   assertTrue(host.getChildAt(0) instanceof TvBroadcastInfoView);
   FrameLayout effects=(FrameLayout)field(overlay,"effectHost");
   assertNotNull(effects);
   WindowManager.LayoutParams fullscreen=(WindowManager.LayoutParams)effects.getLayoutParams();
   assertEquals(-1,fullscreen.width);assertEquals(-1,fullscreen.height);
   assertTrue(effects.getChildAt(0) instanceof PreviewRain);
  }finally{overlay.hide();}
  assertNull(field(overlay,"previewRain"));assertNull(field(overlay,"effectHost"));
 }
}
