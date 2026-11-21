package top.monitorglobal.tv;

import android.graphics.*;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import java.util.Locale;

/** A share-ready image of the active projection, with readable catalog metadata. */
final class PhoneVolumeShare {
 private static final int GOLD=0xffebc687,TEXT=0xfff2f5f7,MUTED=0xffb5c7d0;
 private PhoneVolumeShare(){}

 static Bitmap render(PhoneQuakeVolume volume,Alert event,Typeface brand){
  int stageWidth=volume.getWidth(),stageHeight=volume.getHeight();
  if(stageWidth<=0||stageHeight<=0)return null;
  Bitmap image=Bitmap.createBitmap(1080,1920,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(image);
  Paint line=new Paint(Paint.ANTI_ALIAS_FLAG);
  canvas.drawColor(0xff091722);
  line.setColor(0xffb49056);line.setStyle(Paint.Style.STROKE);line.setStrokeWidth(4);
  canvas.drawRoundRect(22,22,1058,1898,26,26,line);
  line.setStyle(Paint.Style.FILL);
  label(canvas,"ARGOS ORBIS",64,65,51,GOLD,brand,1);
  label(canvas,"SUBSOLO 3D  ·  "+PhoneActivity.magnitude(event),64,146,36,GOLD,Typeface.DEFAULT_BOLD,1);
  label(canvas,PhoneActivity.location(event),64,205,43,TEXT,Typeface.DEFAULT_BOLD,3);
  float scale=Math.min(952f/stageWidth,1030f/stageHeight);
  float x=(1080-stageWidth*scale)/2,y=363+(1030-stageHeight*scale)/2;
  canvas.save();
  canvas.translate(x,y);canvas.scale(scale,scale);
  volume.draw(canvas);canvas.restore();
  line.setShader(new LinearGradient(64,0,1016,0,GOLD,0x108f6a35,Shader.TileMode.CLAMP));
  canvas.drawRect(64,1413,1016,1417,line);
  label(canvas,PhoneActivity.depth(event),64,1450,39,TEXT,Typeface.DEFAULT_BOLD,1);
  label(canvas,BrDates.dateTime(event.eventTime)+"  ·  "+PhoneActivity.source(event),64,1510,30,MUTED,Typeface.DEFAULT,2);
  label(canvas,coordinates(event),64,1600,30,MUTED,Typeface.DEFAULT,1);
  label(canvas,volume.hasRupture()?"Ruptura publicada · USGS":"Dourado: sismo selecionado · Azul: sismos próximos",64,1670,28,GOLD,Typeface.DEFAULT,2);
  label(canvas,"argosorbis.com.br   ·   Telegram @argosorbis",64,1800,29,TEXT,Typeface.DEFAULT_BOLD,1);
  return image;
 }
 static String coordinates(Alert event){
  Locale pt=Locale.forLanguageTag("pt-BR");
  return String.format(pt,"%.4f° %s  ·  %.4f° %s",Math.abs(event.originLatitude),event.originLatitude<0?"S":"N",
   Math.abs(event.originLongitude),event.originLongitude<0?"O":"L");
 }
 private static void label(Canvas canvas,String value,int x,int y,int size,int color,Typeface font,int lines){
  TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);
  paint.setTextSize(size);paint.setColor(color);paint.setTypeface(font);
  StaticLayout layout=StaticLayout.Builder.obtain(value,0,value.length(),paint,952)
   .setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false)
   .setEllipsize(android.text.TextUtils.TruncateAt.END).setMaxLines(lines).build();
  canvas.save();canvas.translate(x,y);layout.draw(canvas);canvas.restore();
 }
}
