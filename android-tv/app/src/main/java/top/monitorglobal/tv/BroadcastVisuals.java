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
 /** Center a full, untruncated Rajdhani title inside a 24-unit broadcast tab.
  * Font height fits vertically; horizontal scale fills a fixed fraction of the
  * red tab, including AO VIVO, REPLAY, TESTE, COTAÇÕES and longer demo labels.
  * Paint scale is restored before the normal ticker, map and radar are drawn.
  */
 static void headerLabel(Canvas canvas,Paint paint,Typeface font,String label,
                         float left,float width,float fill,int color){
  if(label==null||label.isEmpty()||width<=0)return;
  paint.setTypeface(font);paint.setTextScaleX(1f);paint.setTextSize(25f);
  Paint.FontMetrics fm=paint.getFontMetrics();
  float lineHeight=fm.descent-fm.ascent;
  if(lineHeight>23.5f){paint.setTextSize(25f*23.5f/lineHeight);fm=paint.getFontMetrics();}
  float normalWidth=paint.measureText(label);
  float targetWidth=width*fill;
  paint.setTextScaleX(normalWidth>0?targetWidth/normalWidth:1f);
  paint.setColor(color);paint.setStyle(Paint.Style.FILL);
  float baseline=HEADER_LABEL_HEIGHT/2f-(fm.ascent+fm.descent)/2f;
  canvas.save();canvas.clipRect(left,0,left+width,HEADER_LABEL_HEIGHT);
  canvas.drawText(label,left+(width-targetWidth)/2f,baseline,paint);
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
