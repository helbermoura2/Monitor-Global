package top.monitorglobal.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;

/**
 * Single visual authority for the TV lower-third radar mark and ticker movement.
 * Both earthquake NewsBannerView and weather/market TvBroadcastInfoView draw
 * this SAME glyph at the SAME pixel coordinates and animate at the SAME rates.
 */
final class BroadcastVisuals {
 private BroadcastVisuals(){}
 // Shared geometry for seismic, weather, rain, and market broadcasts.
 static final float BREAKING_WIDTH=260f,FOOTER_TOP=94f,FOOTER_HEIGHT=32f;
 static final float STATUS_MIN_WIDTH=154f,STATUS_MAX_WIDTH=176f;
 // Both Android TV renderers use the same headline and status typography.
 // The labels fill the existing boxes without changing the overlay/map/footer size.
 static final float BREAKING_TEXT_FILL=.86f,STATUS_TEXT_FILL=.80f;
 static final float HEADER_LABEL_HEIGHT=24f;
 static float statusWidth(Paint paint,android.graphics.Typeface font,String label){
  paint.setTypeface(font);paint.setTextSize(17f);
  return Math.max(STATUS_MIN_WIDTH,Math.min(STATUS_MAX_WIDTH,(float)Math.ceil(paint.measureText(label))+32f));
 }
 /** Rajdhani lettering retains natural glyph proportions in the 24-unit headline bar.
  * Draw the same centered label for sismos, meteorologia, mercados, voz and replay.
  * Never expand individual letters horizontally as the former 1.0.88 effect did.
  */
 static void headerLabel(Canvas canvas,Paint paint,Typeface font,String label,
                         float left,float width,float fill,int color){
  if(label==null||label.isEmpty()||width<=0)return;
  paint.setTypeface(font);paint.setTextScaleX(1f);
  float size=28f,limit=width-18f;Paint.FontMetrics fm;
  do{
   paint.setTextSize(size);fm=paint.getFontMetrics();
   if(fm.descent-fm.ascent<=22.5f&&paint.measureText(label)<=limit)break;
   size-=.5f;
  }while(size>12f);
  float glyphWidth=0f;int glyphs=0;
  for(int i=0;i<label.length();){
   int next=label.offsetByCodePoints(i,1);
   glyphWidth+=paint.measureText(label,i,next);glyphs++;i=next;
  }
  float letterGap=glyphs>1?Math.max(0f,Math.min(1.3f,(limit-glyphWidth)/(glyphs-1))):0f;
  float fullWidth=glyphWidth+Math.max(0,glyphs-1)*letterGap;
  float x=left+(width-fullWidth)/2f;
  float baseline=12f-(fm.ascent+fm.descent)/2f;
  paint.setStyle(Paint.Style.FILL);paint.setColor(color);
  canvas.save();canvas.clipRect(left,0,left+width,24f);
  for(int i=0;i<label.length();){
   int next=label.offsetByCodePoints(i,1);
   String glyph=label.substring(i,next);
   canvas.drawText(glyph,x,baseline,paint);
   x+=paint.measureText(glyph)+letterGap;i=next;
  }
  canvas.restore();paint.setTextScaleX(1f);
 }
 static final float RADAR_X=922f,RADAR_Y=61f;
 static final float RADAR_SCALE=72f/52f;
 static final float TICKER_PX_PER_SECOND=40f;
 static final long RADAR_PERIOD_MS=2400;
 static final int TICKER_START_X=100;
 static float tickerOffset(long elapsed,float length,boolean animated){
  return animated&&length>0?(elapsed/1000f*TICKER_PX_PER_SECOND)%length:0f;
 }
 /** Native compact rendering of the official vigilante eye. Keep the rings fixed;
  * only the pointer turns and the eye briefly blinks, as on the website.
  * Native drawing avoids spawning WebView instances in the repeated overlays.
  */
 static void radar(Canvas c,Paint paint,long elapsed,boolean animated){
  c.save();
  c.translate(RADAR_X,RADAR_Y);
  c.scale(1.05f,1.05f);
  float openness=1f;
  if(animated){
   float phase=(elapsed%11000L)/11000f;
   if(phase>=.81f&&phase<.89f)
    openness=Math.max(.015f,Math.abs(2f*(phase-.81f)/.08f-1f));
  }
  Path eye=new Path();
  eye.moveTo(-34,0);
  eye.quadTo(0,-25*openness,34,0);
  eye.quadTo(0,25*openness,-34,0);
  eye.close();
  c.save();c.clipPath(eye);
  paint.setStyle(Paint.Style.FILL);paint.setColor(0xff052f35);
  c.drawRect(-36,-28,36,28,paint);
  paint.setStyle(Paint.Style.STROKE);
  paint.setColor(0xff13d7d5);paint.setStrokeWidth(2.1f);
  for(int radius:new int[]{24,17,9})c.drawCircle(0,0,radius,paint);
  paint.setColor(0xff0d7c82);paint.setStrokeWidth(1.1f);
  c.drawLine(-25,0,25,0,paint);c.drawLine(0,-25,0,25,paint);
  c.save();
  float degrees=animated?(elapsed%7200L)/7200f*360f:0f;
  c.rotate(degrees);
  paint.setStyle(Paint.Style.FILL);paint.setColor(0x6626ddd2);
  Path beam=new Path();beam.moveTo(0,0);beam.lineTo(24,0);
  beam.arcTo(-24,-24,24,24,0,32,false);beam.close();c.drawPath(beam,paint);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2.4f);
  paint.setColor(0xff4efff0);c.drawLine(0,0,24,0,paint);
  c.restore();
  paint.setStyle(Paint.Style.FILL);paint.setColor(0xff19dccb);c.drawCircle(0,0,5,paint);
  c.restore();
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3f);
  paint.setColor(0xffc4a16a);c.drawPath(eye,paint);
  c.restore();
 }
}
