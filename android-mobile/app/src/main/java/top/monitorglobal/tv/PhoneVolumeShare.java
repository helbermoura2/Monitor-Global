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
 private static final int GOLD=0xffe6c897,TEXT=0xfff5e8cf,MUTED=0xffdbc6a5;
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
  android.content.res.AssetManager assets=view.getContext().getAssets();
  Typeface serif=font(assets,"CormorantGaramond",700,brand);
  Typeface countryFont=font(assets,"CormorantGaramond",600,serif);
  Typeface inter=font(assets,"Inter",500,Typeface.DEFAULT);
  Typeface interBold=font(assets,"Inter",700,Typeface.DEFAULT_BOLD);
  // Georgia resolves to the system serif when unavailable in Android WebView.
  Typeface magnitudeFont=Typeface.create(Typeface.create("serif",Typeface.NORMAL),700,false);
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
  paint.setShader(new LinearGradient(0,176,0,345,new int[]{
   0xff73502d,0xffdfbd88,0xffa27a4b,0xff634226,0xffc39863,0xff39271b
  },new float[]{0,.19f,.4f,.62f,.82f,1},Shader.TileMode.CLAMP));
  canvas.drawRect(53,176,60,345,paint);
  paint.setShader(new LinearGradient(701,170,1025,266,new int[]{0xff936b35,0xffe6c783,0xff9e7540},null,Shader.TileMode.CLAMP));
  canvas.drawRoundRect(701,172,1025,268,16,16,paint);paint.setShader(null);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2);paint.setColor(0xffedd09a);
  canvas.drawRoundRect(706,177,1020,263,13,13,paint);paint.setStyle(Paint.Style.FILL);
  String mag=PhoneActivity.magnitude(event);
  centered(canvas,mag,863,222,70,0xff21170f,magnitudeFont);
  centered(canvas,"SUBSOLO 3D",95,236,75,GOLD,serif,Paint.Align.LEFT);
  drawLocation(canvas,PhoneActivity.location(event),serif,countryFont);

  String date=BrDates.dateTime(event.eventTime);
  label(canvas,date,76,1430,28,TEXT,interBold,1,480);
  rule(canvas,paint,565,1425,567,1470);
  label(canvas,PhoneActivity.source(event),595,1424,25,TEXT,interBold,2,410);
  rule(canvas,paint,69,1492,1008,1494);
  label(canvas,PhoneActivity.depth(event).replace("Profundidade: ",""),76,1520,29,TEXT,inter,2,420);
  label(canvas,"PROFUNDIDADE",76,1600,18,MUTED,interBold,1,420);
  rule(canvas,paint,565,1519,567,1621);
  String[] coordinates=coordinates(event).split("  ·  ");
  label(canvas,coordinates[0],595,1520,29,TEXT,inter,1,410);
  label(canvas,coordinates[1],595,1557,29,TEXT,inter,1,410);
  label(canvas,"COORDENADAS",595,1600,18,MUTED,interBold,1,410);
  label(canvas,"Dourado: sismo selecionado  ·  Azul: sismos próximos",70,1636,18,MUTED,inter,1,940);
  if(volume.hasRupture())label(canvas,"Geometria da ruptura · USGS",70,1657,15,MUTED,inter,1,940);
  rule(canvas,paint,69,1674,1008,1676);
  label(canvas,"argosorbis.com.br",78,1711,29,TEXT,interBold,1,400);
  rule(canvas,paint,485,1699,487,1762);
  label(canvas,"Telegram · @argosorbis",542,1715,24,TEXT,interBold,1,455);

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
 private static Typeface font(android.content.res.AssetManager assets,String family,int weight,Typeface fallback){
  try{
   Typeface loaded=new Typeface.Builder(assets,"share/assets/summary-fonts/"+family+".ttf")
    .setFontVariationSettings("'wght' "+weight).setWeight(weight).build();
   return loaded==null?fallback:loaded;
  }catch(RuntimeException ignored){return fallback;}
 }
 private static void rule(Canvas canvas,Paint paint,int left,int top,int right,int bottom){
  paint.setColor(0x827a674d);canvas.drawRect(left,top,right,bottom,paint);
 }
 private static void centered(Canvas canvas,String value,int x,int y,int size,int color,Typeface font){
  centered(canvas,value,x,y,size,color,font,Paint.Align.CENTER);
 }
 private static void centered(Canvas canvas,String value,int x,int y,int size,int color,Typeface font,Paint.Align alignment){
  Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
  paint.setTextSize(size);paint.setTypeface(font);paint.setColor(color);paint.setTextAlign(alignment);
  canvas.drawText(value,x,y-(paint.ascent()+paint.descent())/2,paint);
 }
 private static void drawLocation(Canvas canvas,String place,Typeface serif,Typeface countryFont){
  int comma=place.lastIndexOf(", ");
  String locality=comma<0?place:place.substring(0,comma+2);
  String country=comma<0?"":place.substring(comma+2);
  TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);
  float size=54,width=0,total;
  do{
   paint.setTypeface(serif);paint.setTextSize(size);
   width=paint.measureText(locality);
   paint.setTypeface(countryFont);paint.setTextSize(Math.round(size*.83f));
   total=width+paint.measureText(country);
   if(total<=930||size<=32)break;
   size--;
  }while(true);
  if(total>930){label(canvas,place,95,282,(int)size,GOLD,serif,2,930);return;}
  paint.setTypeface(serif);paint.setTextSize(size);
  float baseline=282-paint.ascent();
  paint.setShader(new LinearGradient(0,282,0,282+size,
   new int[]{0xfff7e3b6,0xffe3bf7d,0xfff8df9c,0xffb68750},
   new float[]{0,.37f,.46f,1},Shader.TileMode.CLAMP));
  paint.setShadowLayer(3,0,2,0xe6080c0b);
  canvas.drawText(locality,95,baseline,paint);
  paint.setShader(null);paint.setColor(0xffddbf8d);
  paint.setTypeface(countryFont);paint.setTextSize(Math.round(size*.83f));
  canvas.drawText(country,95+width,baseline,paint);
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
