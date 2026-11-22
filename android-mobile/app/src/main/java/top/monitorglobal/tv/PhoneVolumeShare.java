package top.monitorglobal.tv;

import android.graphics.*;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/** Shared engraved composition for the still and every frame of the 3D tour. */
final class PhoneVolumeShare implements AutoCloseable {
 private static final int GOLD=0xffebc687,TEXT=0xfff2f5f7,MUTED=0xffb5c7d0;
 static final int WIDTH=1080,HEIGHT=1920;
 private static final Rect STAGE=new Rect(8,408,1072,1370);
 private final Bitmap shell;
 private final PhoneQuakeVolume volume;

 PhoneVolumeShare(PhoneQuakeVolume view,Alert event,Typeface brand,int width,int height){
  volume=view.exportCopy();
  shell=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(shell);
  canvas.scale(width/(float)WIDTH,height/(float)HEIGHT);
  canvas.drawColor(0xff091722);
  Typeface serif=brand;
  try{serif=Typeface.createFromAsset(view.getContext().getAssets(),"share/assets/summary-fonts/CormorantGaramond.ttf");}
  catch(RuntimeException ignored){}
  Bitmap art=null;
  try(InputStream stream=view.getContext().getAssets().open("share/img/argos-share-engraving.webp")){
   art=BitmapFactory.decodeStream(stream);
  }catch(IOException ignored){}
  Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
  if(art!=null){
   canvas.save();canvas.clipOutRect(STAGE);canvas.drawBitmap(art,null,new Rect(0,0,WIDTH,HEIGHT),paint);canvas.restore();
   art.recycle();
  }else{
   paint.setColor(0xffb49056);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(4);
   canvas.drawRoundRect(22,22,1058,1898,20,20,paint);paint.setStyle(Paint.Style.FILL);
   label(canvas,"ARGOS ORBIS",66,44,56,GOLD,serif,1,940);
  }
  paint.setShader(new LinearGradient(700,166,1000,266,new int[]{0xfff5dda3,0xffae7c3d,0xfff1d495},null,Shader.TileMode.CLAMP));
  canvas.drawRoundRect(700,170,1020,266,16,16,paint);paint.setShader(null);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3);paint.setColor(0xfff2d9a5);
  canvas.drawRoundRect(704,174,1016,262,13,13,paint);paint.setStyle(Paint.Style.FILL);
  label(canvas,PhoneActivity.magnitude(event),700,176,59,0xff21170c,serif,1,320,Layout.Alignment.ALIGN_CENTER);
  label(canvas,"SUBSOLO 3D",66,185,52,GOLD,serif,1,610);
  label(canvas,PhoneActivity.location(event),66,283,39,GOLD,serif,2,940);
  label(canvas,BrDates.dateTime(event.eventTime)+"  ·  "+PhoneActivity.source(event),74,1419,28,TEXT,Typeface.DEFAULT_BOLD,2,930);
  paint.setColor(0xff705d42);canvas.drawRect(72,1500,1008,1502,paint);
  label(canvas,PhoneActivity.depth(event),74,1529,37,TEXT,Typeface.DEFAULT_BOLD,1,930);
  label(canvas,coordinates(event),74,1583,31,TEXT,Typeface.DEFAULT,1,930);
  label(canvas,"Dourado: sismo selecionado  ·  Azul: sismos próximos",74,1647,24,MUTED,Typeface.DEFAULT,1,930);
  if(volume.hasRupture())label(canvas,"Geometria da ruptura · USGS",74,1684,24,GOLD,Typeface.DEFAULT,1,930);
  paint.setColor(0xff705d42);canvas.drawRect(72,1724,1008,1726,paint);
  label(canvas,"argosorbis.com.br   ·   Telegram @argosorbis",74,1744,28,TEXT,Typeface.DEFAULT_BOLD,1,930);
 }

 void draw(Canvas canvas,float tourProgress){
  if(tourProgress>=0)volume.exportTourPose(tourProgress);
  canvas.drawBitmap(shell,0,0,null);
  canvas.save();
  canvas.scale(shell.getWidth()/(float)WIDTH,shell.getHeight()/(float)HEIGHT);
  canvas.clipRect(STAGE);
  canvas.drawColor(0xff0b1821);
  float scale=Math.min(STAGE.width()/(float)volume.getWidth(),STAGE.height()/(float)volume.getHeight());
  canvas.translate(STAGE.exactCenterX()-volume.getWidth()*scale/2,STAGE.exactCenterY()-volume.getHeight()*scale/2);
  canvas.scale(scale,scale);
  canvas.clipRect(0,0,volume.getWidth(),volume.getHeight());
  volume.drawExport(canvas);
  canvas.restore();
 }
 static Bitmap render(PhoneQuakeVolume volume,Alert event,Typeface brand){
  if(volume.getWidth()<=0||volume.getHeight()<=0)return null;
  Bitmap image=Bitmap.createBitmap(WIDTH,HEIGHT,Bitmap.Config.ARGB_8888);
  try(PhoneVolumeShare frame=new PhoneVolumeShare(volume,event,brand,WIDTH,HEIGHT)){
   frame.draw(new Canvas(image),-1);
  }
  return image;
 }
 @Override public void close(){shell.recycle();}

 static String coordinates(Alert event){
  Locale pt=Locale.forLanguageTag("pt-BR");
  return String.format(pt,"%.4f° %s  ·  %.4f° %s",Math.abs(event.originLatitude),event.originLatitude<0?"S":"N",
   Math.abs(event.originLongitude),event.originLongitude<0?"O":"L");
 }
 private static void label(Canvas canvas,String value,int x,int y,int size,int color,Typeface font,int lines,int width){
  label(canvas,value,x,y,size,color,font,lines,width,Layout.Alignment.ALIGN_NORMAL);
 }
 private static void label(Canvas canvas,String value,int x,int y,int size,int color,Typeface font,int lines,int width,Layout.Alignment alignment){
  TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);
  paint.setTextSize(size);paint.setColor(color);paint.setTypeface(font);
  StaticLayout layout=StaticLayout.Builder.obtain(value,0,value.length(),paint,width)
   .setAlignment(alignment).setIncludePad(false)
   .setEllipsize(android.text.TextUtils.TruncateAt.END).setMaxLines(lines).build();
  canvas.save();canvas.translate(x,y);layout.draw(canvas);canvas.restore();
 }
}
