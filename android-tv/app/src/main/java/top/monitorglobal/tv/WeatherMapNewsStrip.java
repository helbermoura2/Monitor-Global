package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.Locale;

/** The existing official OLED newsroom chrome, for the full-screen weather viewer.
 * Presentation only: no notifications, replay, sound or weather inference. */
final class WeatherMapNewsStrip extends View {
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
 private String category="SATÉLITE",badge="CONSULTA",headline="Aguardando dados",detail="",ticker="";
 private long started=SystemClock.uptimeMillis();
 WeatherMapNewsStrip(Context c){super(c);OfficialArgosLogo.prepare(c);setFocusable(false);setBackgroundColor(Color.BLACK);}
 void radar(RadarMapClient.Frame frame,String scope,long now){
  category="RADAR";badge=frame==null?"SEM DADO":now<frame.at||now-frame.at>=60*60000L?"DEFASADO":"OBSERVADO";
  headline="Refletividade · "+scope;
  detail=frame==null?"INPE / DECEA · radar indisponível":frame.credit()+" · "+InfraredPlan.timing(frame.at,now);
  ticker="dBZ não é taxa de chuva · cobertura piloto SP/RJ · cinza hachurado: sem dado confirmado";
  changed();
 }
 void satellite(WeatherSatelliteClient.Frame frame,String scope,long now){
  category="GOES";badge=frame==null?"SEM DADO":now<frame.at||now-frame.at>InfraredPlan.FRESH_AGE?"DEFASADO":"OBSERVADO";
  headline="Nuvens · "+scope;
  detail=frame==null?"Satélite indisponível":frame.credit()+" · "+InfraredPlan.timing(frame.at,now);
  ticker="Infravermelho · não mede intensidade da chuva";
  if(frame!=null&&frame.motion!=null)ticker+=" · "+frame.motion.description()+" · "+frame.motion.coherence();
  changed();
 }
 private void changed(){setContentDescription(category+" · "+badge+" · "+headline+" · "+detail+" · "+ticker);invalidate();}
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);if(getWidth()==0||getHeight()==0)return;
  long elapsed=SystemClock.uptimeMillis()-started;
  boolean animate=TvEffectsController.enabled(getContext());
  c.save();c.scale(getWidth()/960f,getHeight()/126f);
  OledNewsChrome.base(c,p);OledNewsChrome.tab(c,p,"METEOROLOGIA",true);OledNewsChrome.tab(c,p,badge,false);
  BroadcastVisuals.newsroomDividers(c,p,BroadcastVisuals.SOURCE_DIVIDER_X);
  BroadcastVisuals.eventCategory(c,p,OledNewsChrome.titleFont(null),category,"ARGOS ORBIS",0xffff6d7f);
  text(c,headline,130,58,23,685,OledNewsChrome.titleFont(null));
  text(c,detail,130,84,14,685,OledNewsChrome.regularFont());
  OledNewsChrome.brand(c,p,elapsed,animate);
  c.save();c.clipRect(18,95,780,125);
  p.setTypeface(OledNewsChrome.tickerFont());p.setTextSize(14);p.setColor(Color.WHITE);p.setShader(null);p.setStyle(Paint.Style.FILL);
  float width=p.measureText(ticker)+90,offset=BroadcastVisuals.tickerOffset(elapsed,width,animate);
  c.drawText(ticker,18-offset,117,p);if(animate)c.drawText(ticker,18-offset+width,117,p);
  c.restore();OledNewsChrome.brandFooter(c,p,elapsed,animate);c.restore();
  if(animate&&isShown())postInvalidateDelayed(120);
 }
 private void text(Canvas c,String value,float x,float y,float size,float width,Typeface face){
  p.setTypeface(face);p.setTextSize(size);p.setTextScaleX(1);p.setColor(Color.WHITE);p.setShader(null);p.setStyle(Paint.Style.FILL);
  while(p.getTextSize()>10&&p.measureText(value)>width)p.setTextSize(p.getTextSize()-.5f);
  c.save();c.clipRect(x,31,x+width,94);c.drawText(value,x,y,p);c.restore();
 }
}
