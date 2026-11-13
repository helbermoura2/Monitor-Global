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
 // CNN-style lower-third composition, in the Monitor Global palette.
 // These dimensions are shared by seismic, weather, rain, market and voice.
 static final float HEADER_HEIGHT=30f,BRAND_LEFT=866f;
 static final float BREAKING_TEXT_FILL=.86f,STATUS_TEXT_FILL=.80f;
 static final float HEADER_LABEL_HEIGHT=HEADER_HEIGHT;
 static final int TAB_RED=0xffbf1827,BRAND_BACKGROUND=0xff0c2a3c;
 static final int TICKER_BACKGROUND=0xff020816;
 static void newsroomBody(Canvas canvas,Paint ink,int bodyColor,int accent){
  ink.setStyle(Paint.Style.FILL);ink.setShader(null);
  ink.setColor(bodyColor);canvas.drawRect(0,HEADER_HEIGHT,960,FOOTER_TOP,ink);
  // A dedicated right-hand brand panel replaces the floating radar,
  // like the separate network-brand area on a television lower-third.
  ink.setColor(BRAND_BACKGROUND);canvas.drawRect(BRAND_LEFT,HEADER_HEIGHT,960,FOOTER_TOP,ink);
  ink.setColor(accent);canvas.drawRect(BRAND_LEFT,HEADER_HEIGHT,BRAND_LEFT+1.5f,FOOTER_TOP,ink);
 }
 static void headlineTab(Canvas canvas,Paint ink,float left,float width,int color){
  ink.setStyle(Paint.Style.FILL);ink.setShader(null);ink.setColor(color);
  canvas.drawRoundRect(left,0,left+width,HEADER_HEIGHT,5,5,ink);
  canvas.drawRect(left,13,left+width,HEADER_HEIGHT,ink);
 }
 static float statusWidth(Paint paint,android.graphics.Typeface font,String label){
  paint.setTypeface(font);paint.setTextSize(17f);
  return Math.max(STATUS_MIN_WIDTH,Math.min(STATUS_MAX_WIDTH,(float)Math.ceil(paint.measureText(label))+32f));
 }
 /** Preserve natural Rajdhani letter proportions instead of stretching letters.
  * Fit long status labels to their panel, then center with restrained tracking.
  * The same method draws both event families and all live/replay/test states.
  */
 static void headerLabel(Canvas canvas,Paint paint,Typeface font,String label,
                         float left,float width,float fill,int color){
  if(label==null||label.isEmpty()||width<=0)return;
  paint.setTypeface(font);paint.setTextScaleX(1f);
  float size=33f;float maxWidth=width-18f;Paint.FontMetrics fm;
  do{
   paint.setTextSize(size);fm=paint.getFontMetrics();
   if(fm.descent-fm.ascent<=28.5f&&paint.measureText(label)<=maxWidth)break;
   size-=.5f;
  }while(size>13f);
  int glyphs=label.codePointCount(0,label.length());
  float rawWidth=0f;
  for(int offset=0;offset<label.length();){
   int next=label.offsetByCodePoints(offset,1);
   rawWidth+=paint.measureText(label,offset,next);offset=next;
  }
  // Small tracking evokes television captions, without stretching individual glyphs.
  float letterGap=glyphs>1?Math.max(0f,Math.min(1.3f,(maxWidth-rawWidth)/(glyphs-1))):0f;
  float fullWidth=rawWidth+(glyphs-1)*letterGap;
  float x=left+(width-fullWidth)/2f;
  float baseline=HEADER_LABEL_HEIGHT/2f-(fm.ascent+fm.descent)/2f;
  paint.setColor(color);paint.setStyle(Paint.Style.FILL);
  canvas.save();canvas.clipRect(left,0,left+width,HEADER_LABEL_HEIGHT);
  for(int offset=0;offset<label.length();){
   int next=label.offsetByCodePoints(offset,1);
   String glyph=label.substring(offset,next);
   canvas.drawText(glyph,x,baseline,paint);
   x+=paint.measureText(glyph)+letterGap;offset=next;
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
