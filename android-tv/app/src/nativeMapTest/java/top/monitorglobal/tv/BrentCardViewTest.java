package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.view.*;import android.widget.*;
import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;
import org.robolectric.*;import org.robolectric.annotation.*;
import java.io.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BrentCardViewTest {
 Context c;
 @Before public void setup(){c=RuntimeEnvironment.getApplication();}
 String text(View root){if(root instanceof TextView)return ((TextView)root).getText().toString();
  String out="";if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++)out+=text(((ViewGroup)root).getChildAt(i))+" ";return out;}
 void assertVisible(View v){
  if(v.getVisibility()!=View.VISIBLE)return;
  if(v instanceof TextView){TextView t=(TextView)v;assertNotNull(t.getLayout());
   assertTrue("Clipped Brent value: "+t.getText(),t.getLayout().getLineEnd(t.getLayout().getLineCount()-1)>=t.getText().length());}
  if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)assertVisible(((ViewGroup)v).getChildAt(i));
 }
 @Test public void visuallyRendersPriceChangeTimeAndSourceWithoutOverlayingVideo()throws Exception{
  BrentQuote value=new BrentQuote(78.35,77.50,0.85,1.10,System.currentTimeMillis()-4*60000,"Yahoo Finance");
  BrentCardView card=new BrentCardView(c,value,false);
  int width=620;
  card.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),
   View.MeasureSpec.makeMeasureSpec(650,View.MeasureSpec.AT_MOST));
  card.layout(0,0,width,card.getMeasuredHeight());
  assertTrue(card.getHeight()>80);assertTrue(card.getHeight()<420);assertVisible(card);
  String content=text(card);
  assertTrue(content.contains("BRENT"));assertTrue(content.contains("78,35"));
  assertTrue(content.contains("1,10%"));assertTrue(content.contains("Yahoo Finance"));
  assertTrue(content.contains("BRT"));assertTrue(content.contains("US$"));
  assertFalse(content.contains("TESTE FICTÍCIO"));
  Bitmap bitmap=Bitmap.createBitmap(width,card.getHeight(),Bitmap.Config.ARGB_8888);
  card.draw(new Canvas(bitmap));
  try(FileOutputStream file=new FileOutputStream("/tmp/monitor-tv-brent-card.png")){assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,file));}
  bitmap.recycle();
 }
 @Test public void demoCanNeverBeConfusedWithAnActualQuote(){
  BrentCardView card=new BrentCardView(c,new BrentQuote(78.35,77.50,0.85,1.10,System.currentTimeMillis(),"DEMO"),true);
  assertTrue(text(card).contains("TESTE FICTÍCIO"));
  assertTrue(text(card).contains("DADOS SIMULADOS"));
  assertFalse(text(card).contains("Fonte: Yahoo"));
 }
}
