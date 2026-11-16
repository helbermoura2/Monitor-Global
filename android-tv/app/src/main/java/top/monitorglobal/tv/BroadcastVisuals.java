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
 static final float BREAKING_WIDTH=190f,FOOTER_TOP=94f,FOOTER_HEIGHT=32f;
 static final float STATUS_MIN_WIDTH=88f,STATUS_MAX_WIDTH=142f;
 // Both Android TV renderers use the same headline and status typography.
 // The labels fill the existing boxes without changing the overlay/map/footer size.
 static final float BREAKING_TEXT_FILL=.86f,STATUS_TEXT_FILL=.80f;
 static final float HEADER_LABEL_HEIGHT=24f;
 // Visual center of the 70-unit body (y=24..94). Category words and headline
 // numbers use the SAME center, regardless of font size or separate subtitles.
 static final float BODY_VISUAL_CENTER_Y=61f;
 static float centeredBodyBaseline(Paint paint,Typeface face,float size){
  paint.setTypeface(face);paint.setTextSize(size);
  Paint.FontMetrics fm=paint.getFontMetrics();
  return BODY_VISUAL_CENTER_Y-(fm.ascent+fm.descent)/2f;
 }
 // The seismic M5.x value is the official reference for the LEFT 100-unit
 // event column: centered at x=56, baseline=72, with the caption at y=86.
 // Weather/rain/Brent/satellite/voice use exactly the same geometry.
 static final float EVENT_CENTER_X=56f,EVENT_MAGNITUDE_BASELINE=72f;
 static final float EVENT_CAPTION_BASELINE=86f,EVENT_CATEGORY_BASELINE=68f;
 static final float EVENT_TEXT_WIDTH=85f;
 static void eventCategory(Canvas c,Paint paint,Typeface font,String title,String caption,int color){
  c.save();c.clipRect(8f,28f,108f,94f);
  eventLabel(c,paint,font,title,EVENT_CATEGORY_BASELINE,35f,color);
  if(caption!=null&&!caption.isEmpty())eventLabel(c,paint,font,caption,EVENT_CAPTION_BASELINE,10f,Color.WHITE);
  c.restore();
 }
 static void eventLabel(Canvas c,Paint paint,Typeface font,String value,float baseline,float fontSize,int color){
  if(value==null||value.isEmpty())return;
  paint.setTypeface(font);paint.setTextScaleX(1f);
  float size=fontSize;paint.setTextSize(size);
  while(size>8f&&paint.measureText(value)>EVENT_TEXT_WIDTH){size-=.5f;paint.setTextSize(size);}
  paint.setShader(null);paint.setStyle(Paint.Style.FILL);paint.setColor(color);
  c.drawText(value,EVENT_CENTER_X-paint.measureText(value)/2f,baseline,paint);
 }
 static float statusWidth(Paint paint,android.graphics.Typeface font,String label){
  paint.setTypeface(font);paint.setTextSize(18f);
  return Math.max(STATUS_MIN_WIDTH,Math.min(STATUS_MAX_WIDTH,(float)Math.ceil(paint.measureText(label))+24f));
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
 // 960-unit coordinate system, shared by all lower thirds (not physical TV px).
 // Right edge: 960 - 35 = 925, so the full 62-unit logo is overscan-safe.
 static final float BRAND_RIGHT_INSET=35f;
 static final float RADAR_SIZE=66f,RADAR_X=960f-BRAND_RIGHT_INSET-RADAR_SIZE/2f,RADAR_Y=59f;
 static final float CONTENT_RIGHT_LIMIT=854f;
 static final float TICKER_PX_PER_SECOND=40f;
 static final long RADAR_PERIOD_MS=7200L,BLINK_PERIOD_MS=11000L;
 static final int TICKER_START_X=100;
 static float tickerOffset(long elapsed,float length,boolean animated){
  return animated&&length>0?(elapsed/1000f*TICKER_PX_PER_SECOND)%length:0f;
 }
 static void radar(Canvas c,Paint paint,long elapsed,boolean animated){
  // The same official vector drawn by RadarLogoView on TV and mobile.
  // Outer gold eye + four corner symbols remain stationary; only pointer rotates.
  float angle=animated?(elapsed%RADAR_PERIOD_MS)/(float)RADAR_PERIOD_MS*360f:0f;
  float blink=animated?(elapsed%BLINK_PERIOD_MS)/(float)BLINK_PERIOD_MS:0f;
  float open=1f;
  if(animated&&blink>.81f&&blink<.89f){
   float phase=(blink-.81f)/.08f;
   open=Math.max(.015f,Math.abs(2f*phase-1f));
  }
  c.save();
  c.translate(RADAR_X-RADAR_SIZE/2f,RADAR_Y-RADAR_SIZE/2f);
  c.scale(RADAR_SIZE/128f,RADAR_SIZE/128f);
  RadarLogoView.drawArtwork(c,paint,angle,open);
  c.restore();
 }
}
