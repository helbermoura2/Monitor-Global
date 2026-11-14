package top.monitorglobal.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
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
 static void radar(Canvas c,Paint paint,long elapsed,boolean animated){
  c.save();c.translate(RADAR_X,RADAR_Y);c.scale(RADAR_SCALE,RADAR_SCALE);
  paint.setStyle(Paint.Style.STROKE);
  paint.setStrokeWidth(1.6f);paint.setColor(Color.rgb(45,127,168));
  c.drawCircle(0,0,23,paint);c.drawCircle(0,0,16,paint);c.drawCircle(0,0,8,paint);
  paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(56,189,248));
  float angle=animated?(elapsed%RADAR_PERIOD_MS)/(float)RADAR_PERIOD_MS*360:0;
  c.drawArc(-23,-23,23,23,-90+angle,45,true,paint);c.drawCircle(0,0,3,paint);
  c.restore();
 }
}
