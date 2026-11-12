package top.monitorglobal.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;

/**
 * Single visual authority for the TV lower-third radar mark and ticker movement.
 * Both earthquake NewsBannerView and weather/market TvBroadcastInfoView draw
 * this SAME glyph at the SAME pixel coordinates and animate at the SAME rates.
 */
final class BroadcastVisuals {
 private BroadcastVisuals(){}
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
