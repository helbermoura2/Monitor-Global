package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.util.Collections;

import static org.junit.Assert.*;

/** Regional M5.x broadcast is distinct while retaining the approved M6+ geometry. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35, qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RegionalLowerThirdTest {
 private Context context;
 @Before public void before(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
 }
 private Alert regional(){
  Alert a=new Alert("regional-jp-demo","earthquake","v1",
    "M5,4 · Costa de Honshu, Japão","Profundidade: 24 km · USGS",
    "earthquake",1763300000000L,1763300000000L,true);
  a.compact=true;
  a.targetArea="Tóquio · Japão";
  a.magnitude=5.4;
  a.depth=24;
  a.countryCode="JP";
  a.provider="USGS";a.source="USGS";
  a.originLongitude=140.35;a.originLatitude=35.65;
  return a;
 }
 private Object field(Object obj,String key) throws Exception{
  java.lang.reflect.Field f=obj.getClass().getDeclaredField(key);
  f.setAccessible(true);return f.get(obj);
 }
 private Bitmap render(NewsBannerView view) throws Exception{
  int extra=(Integer)field(view,"mapSpace");
  view.layout(0,0,960,126+extra);
  view.startPresentation(android.os.SystemClock.uptimeMillis()-1000,false);
  Bitmap full=Bitmap.createBitmap(960,126+extra,Bitmap.Config.ARGB_8888);
  view.draw(new Canvas(full));
  if(extra==0)return full;
  Bitmap lower=Bitmap.createBitmap(full,0,extra,960,126);
  full.recycle();
  return lower;
 }
 @Test public void regionalOnlyAppliesToExplicitRegionalFlow(){
  Alert a=regional();
  NewsBannerView ordinary=new NewsBannerView(context,a,false,false);
  NewsBannerView special=new NewsBannerView(context,a,false,false,true);
  assertEquals("AO VIVO",ordinary.badgeLabel());
  assertEquals("REGIONAL",special.badgeLabel());
  assertTrue(special.getContentDescription().toString().contains("AVISO REGIONAL"));
  assertTrue(special.getContentDescription().toString().contains("Tóquio"));
  assertTrue(special.getContentDescription().toString().contains("USGS"));
  assertEquals("REPLAY",new NewsBannerView(context,a,false,true,true).badgeLabel());
  assertEquals("TESTE",new NewsBannerView(context,a,true,false,true).badgeLabel());
 }
 @Test public void regionalDoesNotChangeTheDailySummary(){
  Alert a=regional();
  NewsBannerView summary=new NewsBannerView(context,Collections.singletonList(a),
    "2026-11-16",false,true);
  assertFalse((Boolean)uncheckedField(summary,"regional"));
  assertEquals("RESUMO",summary.badgeLabel());
  assertTrue(summary.getContentDescription().toString().contains("RESUMO DO DIA"));
 }
 private Object uncheckedField(Object value,String name){
  try{return field(value,name);}catch(Exception e){throw new AssertionError(e);}
 }
 @Test public void regionalKeepsM6CenterFrameFootersAndOverscan()throws Exception{
  NewsBannerView regional=new NewsBannerView(context,regional(),false,false,true);
  Bitmap b=render(regional);
  try{
   int redLabel=0,redMagnitude=0;
   for(int y=5;y<26;y++)for(int x=20;x<250;x++){
    int px=b.getPixel(x,y);
    if(Color.red(px)>150&&Color.green(px)<120)redLabel++;
   }
   for(int y=39;y<87;y++)for(int x=30;x<106;x++){
    int px=b.getPixel(x,y);
    if(Color.red(px)>210&&Color.green(px)>55&&Color.green(px)<165)redMagnitude++;
   }
   assertTrue("red regional title should use existing attached red tab",redLabel>200);
   assertTrue("magnitude remains large and optically centered",redMagnitude>100);
   assertEquals("body is still black OLED",Color.BLACK,b.getPixel(805,60));
   assertEquals("right overscan stays clear",0,Color.alpha(b.getPixel(948,60)));
   assertEquals(15000,CompactNotice.DURATION_MS);
   try(java.io.FileOutputStream out=new java.io.FileOutputStream(
       System.getProperty("java.io.tmpdir")+"/monitor-tv-banner-regional.png")){
    b.compress(Bitmap.CompressFormat.PNG,100,out);
   }
  }finally{b.recycle();}
 }
 @Test public void replayIsClearlyHistoricalAndNotASecondLiveAlert(){
  NewsBannerView view=new NewsBannerView(context,regional(),false,true,true);
  assertEquals("REPLAY",view.badgeLabel());
  String message=view.getContentDescription().toString();
  assertTrue(message.contains("REGISTRO HISTÓRICO"));
  assertTrue(message.contains("REPLAY"));
  assertTrue(message.contains("ÁREA MONITORADA"));
 }
}
