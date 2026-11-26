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
 private String category="SATÉLITE",sourceLabel="GOES-EAST",badge="CONSULTA",headline="AGUARDANDO DADOS",detail="",ticker="";
 private String renderedTicker="";private long tickerStarted=SystemClock.uptimeMillis();
 private long started=SystemClock.uptimeMillis();
 WeatherMapNewsStrip(Context c){super(c);OfficialArgosLogo.prepare(c);setFocusable(false);setBackgroundColor(Color.BLACK);}
 void radar(RadarMapClient.Frame frame,String scope,long now){
  category="RADAR";sourceLabel="INPE / DECEA";badge=frame==null?"SEM DADO":now<frame.at||now-frame.at>=60*60000L?"DEFASADO":"OBSERVADO";
  headline="REFLETIVIDADE · "+scope;
  detail=frame==null?"INPE / DECEA · radar indisponível":frame.credit()+" · "+InfraredPlan.timing(frame.at,now);
  ticker="dBZ não é taxa de chuva · cobertura piloto SP/RJ · cinza hachurado: sem dado confirmado";
  changed();
 }
 void satellite(WeatherSatelliteClient.Frame frame,String scope,long now){
  category="SATÉLITE";sourceLabel="GOES-EAST";badge=frame==null?"SEM DADO":now<frame.at||now-frame.at>InfraredPlan.FRESH_AGE?"DEFASADO":"OBSERVADO";
  headline="NUVENS · "+scope;
  detail=frame==null?"Satélite indisponível":frame.credit()+" · "+InfraredPlan.timing(frame.at,now);
  ticker="Infravermelho · não mede intensidade da chuva";
  if(frame!=null&&frame.motion!=null)ticker+=" · "+frame.motion.description()+" · "+frame.motion.coherence();
  changed();
 }
 private void changed(){setContentDescription(category+" · "+sourceLabel+" · "+badge+" · "+headline+" · "+detail+" · "+ticker);String next=OledNewsChrome.tickerDisplay(ticker);if(!next.equals(renderedTicker)){renderedTicker=next;tickerStarted=SystemClock.uptimeMillis();}invalidate();}
 static int heightForWidth(int width){return Math.max(1,Math.round(width*126f/960f));}
 @Override protected void onMeasure(int widthSpec,int heightSpec){int w=View.MeasureSpec.getSize(widthSpec);setMeasuredDimension(w,resolveSize(heightForWidth(w),heightSpec));}
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);if(getWidth()==0||getHeight()==0)return;
  long elapsed=SystemClock.uptimeMillis()-started;
  boolean animate=TvEffectsController.enabled(getContext());
  c.save();c.scale(getWidth()/960f,getHeight()/126f);
  OledNewsChrome.base(c,p);OledNewsChrome.tab(c,p,"METEOROLOGIA",true);OledNewsChrome.tab(c,p,badge,false);
  BroadcastVisuals.newsroomDividers(c,p,BroadcastVisuals.SOURCE_DIVIDER_X);
  BroadcastVisuals.eventCategory(c,p,OledNewsChrome.titleFont(null),category,sourceLabel,0xffff6d7f);
  // Identical optical center, divider and safe content bounds as the live TV strip.
  text(c,headline,142,BroadcastVisuals.centeredBodyBaseline(p,OledNewsChrome.titleFont(null),27),27,675,OledNewsChrome.titleFont(null));
  text(c,detail,142,88,16,675,OledNewsChrome.regularFont());
  BroadcastVisuals.radar(c,p,elapsed,animate);
  TvBroadcastInfoView.drawClockPlate(c,p,NewsBannerView.formatClock(System.currentTimeMillis()));
  // Same ticker rails, typography and identity plate as the automatic newsroom.
  float left=112f,right=OledNewsChrome.BRAND_PLATE_LEFT-8f;
  c.save();c.clipRect(left,95,right,124);
  int layer=c.saveLayer(left,95,right,124,null);
  p.reset();p.setAntiAlias(true);p.setTextAlign(Paint.Align.LEFT);p.setTextScaleX(1f);p.setTypeface(OledNewsChrome.tickerFont());p.setTextSize(14);p.setColor(Color.WHITE);p.setStyle(Paint.Style.FILL);
  float ink=p.measureText(renderedTicker),length=ink+104;
  if(animate&&ink>right-left){
   float offset=BroadcastVisuals.tickerOffset(Math.max(0, SystemClock.uptimeMillis()-tickerStarted-1500),length,true,40f);
   c.drawText(renderedTicker,left-offset,118.5f,p);
   if(left-offset+length<right)c.drawText(renderedTicker,left-offset+length,118.5f,p);
   OledNewsChrome.fadeTickerEdges(c,left,right);
  }else{
   String display=android.text.TextUtils.ellipsize(renderedTicker,new android.text.TextPaint(p),right-left,android.text.TextUtils.TruncateAt.END).toString();
   c.drawText(display,left,118.5f,p);
  }
  c.restoreToCount(layer);c.restore();OledNewsChrome.brandFooter(c,p,elapsed,animate);c.restore();
  if(isShown())postInvalidateDelayed(animate?33:Math.max(1000,60000-System.currentTimeMillis()%60000));
 }

 private void text(Canvas c,String value,float x,float y,float size,float width,Typeface face){
  p.setTextAlign(Paint.Align.LEFT);p.setTypeface(face);p.setTextSize(size);p.setTextScaleX(1);p.setColor(Color.WHITE);p.setShader(null);p.setStyle(Paint.Style.FILL);
  while(p.getTextSize()>10&&p.measureText(value)>width)p.setTextSize(p.getTextSize()-.5f);
  c.save();c.clipRect(x,31,x+width,94);c.drawText(value,x,y,p);c.restore();
 }
}
