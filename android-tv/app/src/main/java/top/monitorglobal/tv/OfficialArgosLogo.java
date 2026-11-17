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
 private static final RectF RADAR=new RectF(186,69,478,361);
 private static volatile Bitmap base,still;
 private static final Object LOCK=new Object();
 private static final ThreadLocal<Paint> BRUSH=ThreadLocal.withInitial(()->new Paint(Paint.ANTI_ALIAS_FLAG));
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
 private static Path eyePath(){
  // Same broad eyelid silhouette as the supplied official 1440x960 video.
  Path eye=new Path();
  eye.moveTo(59,215);
  eye.quadTo(CX,-51,605,215);
  eye.quadTo(CX,481,59,215);
  eye.close();
  return eye;
 }
 static void draw(Canvas c,long elapsed,boolean animate){
  Bitmap artwork=animate?base:still;
  if(artwork==null)artwork=base!=null?base:still;
  if(artwork==null)return;
  Paint p=BRUSH.get();p.reset();p.setAntiAlias(true);p.setFilterBitmap(true);
  p.setColor(Color.WHITE);p.setStyle(Paint.Style.FILL);p.setShader(null);
  c.save();c.clipRect(X,Y,X+W,Y+H);
  if(!animate||base==null){
   // Use Android's destination-bitmap path for a pixel-identical static asset.
   c.drawBitmap(artwork,null,new RectF(X,Y,X+W,Y+H),p);
  }else{
   c.save();c.translate(X,Y);c.scale(W/ART_W,H/ART_H);
   Path eye=eyePath();
   c.drawBitmap(base,0,0,p);
   float open=eyeOpenness(elapsed,true);
   if(open<.999f){
    // Only the eye area is replaced; static labels and symbols are untouched.
    p.setColor(Color.BLACK);c.drawPath(eye,p);
    c.save();c.scale(1f,open,CX,CY);c.clipPath(eye);
    p.setColor(Color.WHITE);c.drawBitmap(base,0,0,p);
    drawPointer(c,p,elapsed);
    c.restore();
   }else{
    c.save();c.clipPath(eye);drawPointer(c,p,elapsed);c.restore();
   }
   c.restore();
  }
  drawInscriptions(c,p);
  c.restore();
 }
 private static void drawInscriptions(Canvas c,Paint p){
  // The faithful 664px official image is 95px wide on TV. Repaint its
  // inscriptions using broadcast-sized letters instead of illegible 3px pixels.
  p.reset();p.setAntiAlias(true);p.setShader(null);
  p.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));
  p.setTextAlign(Paint.Align.CENTER);p.setColor(0xffc4a16a);p.setStyle(Paint.Style.FILL);
  p.setTextSize(7.5f);c.drawText("ΠΑΝΟΠΤΗΣ",878f,42f,p);
  p.setTextSize(7.2f);c.drawText("CUSTOS ORBIS",878f,89.5f,p);
  p.setTextAlign(Paint.Align.LEFT);
 }
 private static void drawPointer(Canvas c,Paint p,long elapsed){
  float sweep=Math.floorMod(elapsed,BroadcastVisuals.RADAR_PERIOD_MS)*360f/BroadcastVisuals.RADAR_PERIOD_MS;
  c.save();c.rotate(sweep,CX,CY);
  p.setShader(null);p.setStyle(Paint.Style.FILL);
  p.setColor(0x3347ffee);
  c.drawArc(RADAR,-119,29,true,p);
  p.setColor(0x553affed);
  c.drawArc(RADAR,-95,7,true,p);
  p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(5f);p.setColor(0xff57f7ed);
  c.drawLine(CX,CY,CX,76f,p);
  p.setStyle(Paint.Style.FILL);p.setColor(0xff8cfff4);
  c.drawCircle(CX,CY,6f,p);
  c.restore();
 }
}
