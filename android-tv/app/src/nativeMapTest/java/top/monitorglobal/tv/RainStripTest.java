package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
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
 private Object field(Object target,String name)throws Exception{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private String texts(View v){if(v instanceof TextView)return ((TextView)v).getText().toString();StringBuilder s=new StringBuilder();if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)s.append(texts(((ViewGroup)v).getChildAt(i))).append(' ');return s.toString();}
 private RainForecast.Summary forecast(int arrival,boolean knownEnd,boolean pauses)throws Exception{
  long now=System.currentTimeMillis()/60000*60000;JSONArray points=new JSONArray();
  for(int i=0;i<120;i++){boolean wet=arrival>=0&&i>=arrival&&(!knownEnd||i<arrival+35)&&(!pauses||i<arrival+10||i>=arrival+14);points.put(new JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000).put("rate",wet?3:0).put("type",wet?"rain":"no_precipitation"));}
  return RainForecast.summarize(new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("forecast",points),now);
 }
 private void readable(View v){
  if(v instanceof TextView){TextView t=(TextView)v;assertNotNull(t.getLayout());assertTrue("text must not be cut: "+t.getText(),t.getLayout().getLineEnd(t.getLayout().getLineCount()-1)>=t.getText().length());assertTrue(t.getLayout().getHeight()<=t.getHeight());}
  if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)readable(((ViewGroup)v).getChildAt(i));
 }
 private void render(boolean effect,String name)throws Exception{
  Context c=RuntimeEnvironment.getApplication();ShadowSettings.setCanDrawOverlays(true);RainOverlay overlay=new RainOverlay(c);RainForecast.Summary rain=forecast(8,true,false);int width=c.getResources().getDisplayMetrics().widthPixels,height=c.getResources().getDisplayMetrics().heightPixels;
  try{
   assertTrue(overlay.showRain(rain,effect,true,null,false,null));FrameLayout host=(FrameLayout)field(overlay,"current");WindowManager.LayoutParams p=(WindowManager.LayoutParams)host.getLayoutParams();
   assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);
   // Incoming rain has no active full-screen rain effect, even when enabled.
   assertEquals(Gravity.BOTTOM|Gravity.RIGHT,p.gravity);assertTrue(p.width<=width/2);assertEquals(WindowManager.LayoutParams.WRAP_CONTENT,p.height);
   host.measure(View.MeasureSpec.makeMeasureSpec(p.width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.AT_MOST));host.layout(0,0,p.width,host.getMeasuredHeight());host.setAlpha(1);host.getChildAt(0).setTranslationY(0);
   assertTrue(host.getChildAt(0) instanceof RainStripView);assertTrue("compact strip height",host.getHeight()<height*.3);readable(host);
   assertTrue(texts(host).contains("Chuva em ~8 min"));assertTrue(texts(host).contains("Moderada"));assertTrue(texts(host).contains("~35 min"));assertTrue(texts(host).contains("1,8 mm nos próximos 60 min"));assertTrue(texts(host).contains("FICTÍCIO"));assertFalse(texts(host).contains("°C"));
   Bitmap screenshot=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(screenshot);canvas.drawColor(0xff293f51);canvas.save();canvas.translate(width-p.width-p.x,height-host.getHeight()-p.y);host.draw(canvas);canvas.restore();
   File file=new File(System.getProperty("java.io.tmpdir"),"monitor-tv-rain-strip-"+name+".png");try(FileOutputStream out=new FileOutputStream(file)){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();screenshot.compress(Bitmap.CompressFormat.JPEG,85,bytes);System.out.println("RAIN_STRIP_PREVIEW_"+name+" "+Base64.getEncoder().encodeToString(bytes.toByteArray()));screenshot.recycle();
  }finally{overlay.hide();}
 }
 @Test public void incomingStripFits720pAndUsesTheApprovedBottomCorner()throws Exception{render(false,"720p");}
 @Test @Config(qualifiers="w640dp-h360dp-land-hdpi") public void smallTvRetainsEveryWord()throws Exception{render(false,"540p");}
 @Test @Config(qualifiers="w960dp-h540dp-land-xhdpi") public void fullHdRetainsEveryWord()throws Exception{render(false,"1080p");}
 @Test public void unknownDurationAndIntensityStayUnknownAndPausesAreNotContinuousRain()throws Exception{
  Context c=RuntimeEnvironment.getApplication();String unknown=texts(new RainStripView(c,forecast(0,false,false),false,false));assertTrue(unknown.contains("duração indefinida"));assertFalse(unknown.contains("~0 min"));
  String intermittent=texts(new RainStripView(c,forecast(8,true,true),false,false));assertTrue(intermittent.contains("janela ~35 min"));
  RainForecast.Summary missing=new RainForecast.Summary("soon","fraca","Chuva prevista",0,Double.NaN,"Término indefinido",System.currentTimeMillis(),System.currentTimeMillis()+600000,false);String unavailable=texts(new RainStripView(c,missing,false,false));assertTrue(unavailable.contains("Intensidade indisponível"));assertTrue(unavailable.contains("Acumulado indisponível"));assertFalse(unavailable.contains("0,0 mm"));
  String dry=texts(new RainStripView(c,forecast(-1,true,false),false,false));assertTrue(dry.contains("Sem chuva estimada"));assertFalse(dry.contains("Moderada"));
 }
 @Test public void activeRainKeepsTheStripAtTheBottomOfTheEffectWindow()throws Exception{
  Context c=RuntimeEnvironment.getApplication();ShadowSettings.setCanDrawOverlays(true);RainOverlay overlay=new RainOverlay(c);try{
   assertTrue(overlay.showRain(forecast(0,true,false),true,true,null,false,null));FrameLayout host=(FrameLayout)field(overlay,"current");WindowManager.LayoutParams p=(WindowManager.LayoutParams)host.getLayoutParams();assertEquals(-1,p.width);assertEquals(-1,p.height);
   int w=c.getResources().getDisplayMetrics().widthPixels,h=c.getResources().getDisplayMetrics().heightPixels;host.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));host.layout(0,0,w,h);
   View strip=host.getChildAt(host.getChildCount()-1);assertTrue(strip instanceof RainStripView);FrameLayout.LayoutParams box=(FrameLayout.LayoutParams)strip.getLayoutParams();assertEquals(Gravity.BOTTOM|Gravity.RIGHT,box.gravity);assertEquals(h-box.bottomMargin,strip.getBottom());assertEquals(w-box.rightMargin,strip.getRight());assertTrue(strip.getHeight()<h*.3);readable(strip);
  }finally{overlay.hide();}
 }
}
