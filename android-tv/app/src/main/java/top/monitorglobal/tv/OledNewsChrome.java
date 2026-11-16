package top.monitorglobal.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.graphics.Typeface;

/**
 * Argos Orbis OLED rendering of the user-supplied 1920x1080 Pixlr news template.
 * Virtual canvas is 960x126 (the existing Android TV safe-area and animation size).
 * Main bar: x=8..925, y=30..94, pure #000000 with safe overscan spacing.
 * Red left/right tags: same separated locations as the approved template.
 * No floating text panels are drawn above the lower third.
 *
 * This is a native redraw, not a copyrighted CNN bitmap, logo or intro video.
 * Text, event data, map frames and animation timelines remain live and native.
 */
final class OledNewsChrome {
 static final int OLED=Color.BLACK, INK=Color.WHITE;
 static final int RED=0xffbf1827, RED_BRIGHT=0xffed1231, RED_DARK=0xff850008;
 static final int FOOTER=0xff101115, MUTE=0xffb9c2c8;
 static final float LEFT=8f, LEFT_TAB_RIGHT=295f, RIGHT_TAB_LEFT=804f, RIGHT=925f;
 static final float BODY_TOP=30f, BODY_END=94f, FOOTER_END=126f;
 static final float CONTENT_RIGHT=829f, BRAND_PLATE_LEFT=790f;
 static final float LOGO_CENTER_X=878f, LOGO_SIZE=64f;
 static final long FOOTER_SLOT_MS=4000L, FOOTER_FADE_MS=400L;
 private OledNewsChrome(){}

 static Typeface titleFont(Typeface unused){
  // Native display face with CNN Sans-like width; proprietary font files are not redistributed.
  return Typeface.create("sans-serif",Typeface.BOLD);
 }
 static Typeface regularFont(){
  return Typeface.create("sans-serif",Typeface.NORMAL);
 }
 private static void fill(Canvas canvas,Paint p,float left,float top,float right,float bottom,int color){
  p.setStyle(Paint.Style.FILL);p.setShader(null);p.setColor(color);
  canvas.drawRect(left,top,right,bottom,p);
 }
 private static void fitted(Canvas c,Paint p,String value,Typeface face,
                             float x,float baseline,float width,float desired,int color){
  if(value==null||value.isEmpty())return;
  p.setTypeface(face);p.setTextScaleX(1);float size=desired;
  p.setTextSize(size);
  while(size>11f&&p.measureText(value)>width){size-=.5f;p.setTextSize(size);}
  String display=value;
  while(!display.isEmpty()&&p.measureText(display)>width)display=display.substring(0,display.offsetByCodePoints(display.length(),-1));
  p.setColor(color);p.setShader(null);p.setStyle(Paint.Style.FILL);
  c.drawText(display,x,baseline,p);
 }
 static void base(Canvas c,Paint p){
  // The original white banner is now pitch-black OLED with a thin old-news red left edge.
  fill(c,p,LEFT,BODY_TOP,RIGHT,BODY_END,OLED);
  fill(c,p,LEFT,BODY_TOP,LEFT+6f,BODY_END,RED_DARK);
  fill(c,p,LEFT+6f,BODY_TOP,RIGHT,BODY_END,OLED);
  // Only the original lower ticker; no floating right-hand boxes above the banner.
  p.setShader(new LinearGradient(0,94,0,126,
   new int[]{0xff25262a,0xff090a0e,0xff17191e},null,Shader.TileMode.CLAMP));
  p.setStyle(Paint.Style.FILL);c.drawRoundRect(LEFT,94,RIGHT,126,0,0,p);p.setShader(null);
  fill(c,p,LEFT,94,RIGHT,95,0xff36383f);
  // Grey brand block at the ticker's right edge, matching the Pixlr original.
  fill(c,p,BRAND_PLATE_LEFT,99,RIGHT,126,0xff333436);
 }
 static void tab(Canvas c,Paint p,String label,boolean left){
  final float l=left?LEFT:RIGHT_TAB_LEFT,r=left?LEFT_TAB_RIGHT:RIGHT;
  final float corner=7f;
  p.setShader(new LinearGradient(0,0,0,30,RED_BRIGHT,RED_DARK,Shader.TileMode.CLAMP));
  p.setStyle(Paint.Style.FILL);c.drawRoundRect(l,0,r,34,corner,corner,p);p.setShader(null);
  fill(c,p,l,25,r,30,RED_DARK);
  Typeface face=titleFont(null);
  p.setTypeface(face);p.setTextSize(left?22f:20f);
  float span=r-l, size=left?22f:20f;
  while(size>12f&&p.measureText(label)>span-16){size-=.5f;p.setTextSize(size);}
  float x=l+(span-p.measureText(label))/2f;
  p.setColor(INK);c.save();c.clipRect(l,0,r,30);
  c.drawText(label,x,23.6f,p);c.restore();
 }
 static void brand(Canvas c,Paint p,long elapsed,boolean animate){
  // The project-wide official radar-eye vector, with rotating sweep and blinking eye.
  float sweep=animate?(elapsed%BroadcastVisuals.RADAR_PERIOD_MS)/(float)BroadcastVisuals.RADAR_PERIOD_MS*360f:0f;
  float blink=animate?(elapsed%BroadcastVisuals.BLINK_PERIOD_MS)/(float)BroadcastVisuals.BLINK_PERIOD_MS:0f;
  float open=1f;
  if(animate&&blink>.81f&&blink<.89f)
   open=Math.max(.015f,Math.abs(2f*((blink-.81f)/.08f)-1f));
  // The right-hand panel carries ONLY the official animated radar-eye artwork.
  // Center the complete vector (including its corner symbols) inside the safe area.
  c.save();c.clipRect(830,31,RIGHT,94);
  c.translate(LOGO_CENTER_X-LOGO_SIZE/2f,31);c.scale(LOGO_SIZE/128f,LOGO_SIZE/128f);
  RadarLogoView.drawArtwork(c,p,sweep,open);
  c.restore();
 }
 /** One address at a time: 3.2s fully shown, 0.4s fades on each side. */
 static String footerText(long elapsed){
  return (Math.max(0L,elapsed)/FOOTER_SLOT_MS)%2L==0L?"argosorbis.com.br":"@argosorbis";
 }
 static int footerOpacity(long elapsed,boolean animated){
  if(!animated)return 255;
  long phase=Math.floorMod(elapsed,FOOTER_SLOT_MS);
  if(phase<FOOTER_FADE_MS)return Math.round(255f*phase/FOOTER_FADE_MS);
  if(phase>FOOTER_SLOT_MS-FOOTER_FADE_MS)
   return Math.round(255f*(FOOTER_SLOT_MS-phase)/FOOTER_FADE_MS);
  return 255;
 }
 /** Uniform bullet spacing between ticker sections without altering source figures. */
 static String tickerDisplay(String raw){
  if(raw==null)return "";
  return raw.replaceAll("\\s*•\\s*","      •      ");
 }
 static Typeface tickerFont(){
  return Typeface.create("sans-serif-medium",Typeface.NORMAL);
 }
 static void brandFooter(Canvas c,Paint p,long elapsed,boolean animated){
  int opacity=footerOpacity(elapsed,animated);
  if(opacity<=0)return;
  // Paint just one address over the grey plate already drawn by base().
  // A fade-through-blank guarantees both labels are never present together.
  int layer=c.saveLayerAlpha(BRAND_PLATE_LEFT,99,RIGHT,126,opacity);
  c.clipRect(BRAND_PLATE_LEFT+2,99,RIGHT-2,126);
  // Center the single visible address optically, not against the left box edge.
  String address=footerText(elapsed);
  p.setTypeface(regularFont());p.setTextScaleX(1f);p.setShader(null);
  float size=address.startsWith("@")?15.8f:14.8f, available=RIGHT-BRAND_PLATE_LEFT-12;
  p.setTextSize(size);
  while(size>9.5f&&p.measureText(address)>available){size-=.5f;p.setTextSize(size);}
  p.setColor(INK);p.setStyle(Paint.Style.FILL);
  Paint.FontMetrics metrics=p.getFontMetrics();
  float centerY=(99f+126f)/2f;
  float baseline=centerY-(metrics.ascent+metrics.descent)/2f;
  c.drawText(address,(BRAND_PLATE_LEFT+RIGHT-p.measureText(address))/2f,baseline,p);
  c.restoreToCount(layer);
 }
}
