package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * The detailed official Argos Orbis artwork, shared by EVERY TV lower third.
 *
 * The frame and all four small symbols stay stationary; the eye blinks in place
 * at 11-second intervals. Only the pointer INSIDE the radar rotates (7.2 s).
 * Assets are transparent renders of the official mark, not simplified vectors.
 */
final class OfficialArgosLogo {
 private static final float X=830f,Y=31f,W=95f,H=62f;
 private static final float ART_W=664f,ART_H=430f;
 private static final float CX=332f,CY=215f;
 private static volatile Bitmap base,still;
 private static final Object LOCK=new Object();
 private static final ThreadLocal<Paint> BRUSH=ThreadLocal.withInitial(()->new Paint(Paint.ANTI_ALIAS_FLAG));
 private static final ThreadLocal<Path> EYE=ThreadLocal.withInitial(Path::new);
 private static final RectF DESTINATION=new RectF(X,Y,X+W,Y+H);
 private static final android.graphics.Typeface INSCRIPTION=android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL);
 private OfficialArgosLogo(){}

 static void prepare(Context c){
  if(base!=null&&still!=null)return;
  synchronized(LOCK){
   if(base==null)base=read(c,"argos-official-logo-base.b64");
   if(still==null)still=read(c,"argos-official-logo.b64");
  }
 }
 private static Bitmap read(Context context,String name){
  try(InputStream in=context.getAssets().open(name);
      ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buf=new byte[4096];int count;
   while((count=in.read(buf))!=-1)out.write(buf,0,count);
   byte[] png=Base64.decode(out.toByteArray(),Base64.DEFAULT);
   return BitmapFactory.decodeByteArray(png,0,png.length);
  }catch(IOException | IllegalArgumentException ignored){return null;}
 }
 static boolean available(){return base!=null||still!=null;}
 static float eyeOpenness(long elapsed,boolean animate){
  if(!animate)return 1f;
  float phase=Math.floorMod(elapsed,BroadcastVisuals.BLINK_PERIOD_MS)/(float)BroadcastVisuals.BLINK_PERIOD_MS;
  return phase>.81f&&phase<.89f
    ?Math.max(.015f,Math.abs(2f*(phase-.81f)/.08f-1f)):1f;
 }
 static void draw(Canvas c,long elapsed,boolean animate){
  Bitmap artwork=base!=null?base:still;
  if(artwork==null)return;
  Paint p=BRUSH.get();p.reset();p.setAntiAlias(true);p.setFilterBitmap(true);
  c.save();c.clipRect(X,Y,X+W,Y+H);
  c.drawBitmap(artwork,null,DESTINATION,p);
  c.save();c.translate(X,Y);c.scale(W/ART_W,H/ART_H);
  Path eye=EYE.get();
  eye.reset();
  eye.moveTo(59,CY);eye.quadTo(CX,-51,605,CY);eye.quadTo(CX,481,59,CY);eye.close();
  p.setColor(Color.BLACK);p.setStyle(Paint.Style.FILL_AND_STROKE);p.setStrokeWidth(13f);
  c.drawPath(eye,p);
  eye.reset();
  float open=eyeOpenness(elapsed,animate);
  eye.moveTo(59,CY);eye.quadTo(CX,CY-266*open,605,CY);
  eye.quadTo(CX,CY+266*open,59,CY);eye.close();
  c.save();c.clipPath(eye);
  c.translate(CX,CY);c.scale(3.74f,3.74f);c.translate(-64,-64);
  float sweep=animate?Math.floorMod(elapsed,BroadcastVisuals.RADAR_PERIOD_MS)*360f/BroadcastVisuals.RADAR_PERIOD_MS:225f;
  RadarLogoView.drawRadar(c,p,sweep);
  c.restore();
  p.setColor(0xffc4a16a);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(7f);
  c.drawPath(eye,p);
  c.restore();
  drawInscriptions(c,p);
  c.restore();
 }
 private static void drawInscriptions(Canvas c,Paint p){
  // The faithful 664px official image is 95px wide on TV. Repaint its
  // inscriptions using broadcast-sized letters instead of illegible 3px pixels.
  p.reset();p.setAntiAlias(true);p.setShader(null);
  p.setTypeface(INSCRIPTION);
  p.setTextAlign(Paint.Align.CENTER);p.setColor(0xffc4a16a);p.setStyle(Paint.Style.FILL);
  p.setTextSize(7.5f);c.drawText("ΠΑΝΟΠΤΗΣ",878f,42f,p);
  p.setTextSize(7.2f);c.drawText("CUSTOS ORBIS",878f,89.5f,p);
  p.setTextAlign(Paint.Align.LEFT);
 }
}
