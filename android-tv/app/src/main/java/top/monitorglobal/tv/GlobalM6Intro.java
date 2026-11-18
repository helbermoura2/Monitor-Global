package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

/**
 * Native recreation of the approved "video 2" international newscast entrance.
 *
 * A thin, transparent-over-video lower third; no green-screen recording, WebView,
 * video decoder, borrowed broadcaster logo, fixed quake date or fictitious data.
 * The 0.7 s official reveal already performed by BannerRevealLayout is reused.
 *
 * 0–700ms: red band and travelling flare
 * 700–2600ms: yellow BREAKING NEWS flashes in and holds
 * 2600–3350ms: light trails dissolve into the approved live NewsBannerView
 *
 * Explicitly disabled for replays, updates, Brazil, regional alerts, summaries
 * and coupled tsunami bulletins, so critical information is not masked.
 */
final class GlobalM6Intro {
 static final String PREF_ENABLED="globalM6IntroEnabled";
 static final long FLASH_START_MS=700, HOLD_END_MS=2600, END_MS=3350;
 static final int YELLOW=0xffffdf22;
 private static final int WHITE=Color.WHITE;
 private static final int RED=0xffbc071a;
 private static final Typeface BOLD=Typeface.create("sans-serif",Typeface.BOLD);
 private static final Typeface NORMAL=Typeface.create("sans-serif",Typeface.NORMAL);

 private GlobalM6Intro(){}

 static boolean eligible(Context context,Alert a,boolean demo,boolean replay,
                         boolean summary,boolean regional){
  return !summary&&!regional&&!replay
   &&a!=null&&"earthquake".equals(a.kind)&&!a.compact
   &&Double.isFinite(a.magnitude)&&a.magnitude>=6
   &&(a.revision==null||a.revision.isEmpty())
   &&a.companion==null
   &&!BrazilNationalBannerView.isBrazilAlert(context,a)
   &&Prefs.get(context).getBoolean(PREF_ENABLED,true);
 }

 static boolean visible(long elapsed,boolean animated){
  return animated&&elapsed>=0&&elapsed<END_MS;
 }

 static int overlayOpacity(long elapsed){
  if(elapsed<0||elapsed>=END_MS)return 0;
  if(elapsed<=HOLD_END_MS)return 255;
  float t=(elapsed-HOLD_END_MS)/(float)(END_MS-HOLD_END_MS);
  t=t*t*(3f-2f*t);
  return Math.round(255f*(1f-t));
 }

 static float yellowOpacity(long elapsed){
  if(elapsed<FLASH_START_MS||elapsed>HOLD_END_MS)return 0f;
  float arrival=Math.min(1f,(elapsed-FLASH_START_MS)/360f);
  float exit=Math.min(1f,(HOLD_END_MS-elapsed)/240f);
  return Math.max(0f,Math.min(arrival,exit));
 }

 private static void fill(Canvas c,Paint p,float left,float top,float right,
                          float bottom,int color){
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(color);
  c.drawRect(left,top,right,bottom,p);
 }

 private static void fitted(Canvas c,Paint p,String value,Typeface font,
                            float left,float baseline,float initial,float maxWidth,int color){
  p.setShader(null);p.setTextAlign(Paint.Align.LEFT);p.setTextScaleX(1f);
  p.setTypeface(font);p.setTextSize(initial);
  float size=initial;
  while(size>12f&&p.measureText(value)>maxWidth){size-=.5f;p.setTextSize(size);}
  p.setColor(color);p.setStyle(Paint.Style.FILL);
  c.drawText(value,left,baseline,p);
 }

 static void draw(Canvas c,Paint p,long elapsed,Alert quake,boolean demo){
  int alpha=overlayOpacity(elapsed);
  if(alpha<=0)return;
  c.save();
  c.clipRect(OledNewsChrome.LEFT,0,OledNewsChrome.RIGHT,126);
  int layer=c.saveLayerAlpha(OledNewsChrome.LEFT,0,OledNewsChrome.RIGHT,126,alpha);

  // Draw only inside the already-existing 960x126 overlay geometry.
  // Every white/red panel is physically joined: no disconnected red tags.
  p.setShader(new LinearGradient(0,30,0,94,
    new int[]{0xff93040e,0xffdd1930,0xff79010c},null,Shader.TileMode.CLAMP));
  p.setStyle(Paint.Style.FILL);
  c.drawRect(8,30,925,94,p);p.setShader(null);
  fill(c,p,8,30,925,31,0xfff04c54);
  fill(c,p,8,93,925,95,0xfffa5260);

  // The video #2 upper-left white BREAKING NEWS nameplate.
  fill(c,p,8,0,254,30,0xfff5f7f8);
  fitted(c,p,"BREAKING NEWS",BOLD,19,22,21,220,0xff1e2025);

  // The right-hand status column and official animated Argos eye: never
  // substitute the Morphe clip's branding or its green chroma background.
  fill(c,p,804,0,925,30,demo?0xff603236:0xff124c80);
  fitted(c,p,demo?"TESTE":"AO VIVO",BOLD,demo?834:828,22,21,88,WHITE);
  fill(c,p,804,30,925,94,0xff050a0e);
  BroadcastVisuals.radar(c,p,elapsed,true);

  // A compact white category footer, teal moving headline, and the brand.
  fill(c,p,8,95,231,126,0xfff1f2f2);
  fitted(c,p,"SISMO M6+ MUNDIAL",BOLD,17,117,17,206,0xff171c21);
  fill(c,p,231,95,790,126,0xff064d5d);
  fill(c,p,790,95,925,126,0xff303133);
  fitted(c,p,demo?"DADOS FICTÍCIOS":"MONITORAMENTO GLOBAL",
    BOLD,244,117,demo?18:16,524,WHITE);
  fitted(c,p,"ARGOS ORBIS",BOLD,802,116,15,110,WHITE);

  // Bright moving flare across the crimson band. No bitmaps, no blur
  // allocations, and no work outside the TV's existing view.
  float sweep=8f+(Math.min(elapsed,END_MS)/(float)END_MS)*905f;
  float streak=elapsed<FLASH_START_MS?24f+elapsed*.17f:12f;
  for(int k=5;k>=0;k--){
   float width=2f+k*4f;
   int amount=Math.max(0,160-k*23);
   p.setShader(null);p.setStyle(Paint.Style.STROKE);
   p.setStrokeWidth(width);
   p.setColor(Color.argb(amount,255,k<2?220:125,k<2?80:38));
   c.drawLine(Math.max(9,sweep-65-k*9),54,
              Math.min(802,sweep+streak+k*8),54,p);
  }
  p.setStyle(Paint.Style.FILL);
  if(elapsed<FLASH_START_MS){
   // Fast red light signal before the yellow wordmark appears.
   float band=(elapsed/(float)FLASH_START_MS)*778f;
   fill(c,p,14,62,Math.min(790,14+band),65,0xffec3147);
  }

  float yellow=yellowOpacity(elapsed);
  if(yellow>0){
   // Layered warm highlights evoke the reference's bright title flash;
   // the text stays legible instead of becoming a full-screen explosion.
   float move=Math.min(1f,(elapsed-FLASH_START_MS)/420f);
   float x=270f+(1f-move)*84f;
   int ink=Color.argb(Math.min(255,Math.round(255f*yellow)),255,224,33);
   fitted(c,p,"BREAKING NEWS",BOLD,x,77,47,517,ink);
   p.setColor(Color.argb(Math.round(130f*yellow),255,250,185));
   p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.5f);
   c.drawLine(255,87,795,87,p);
   p.setStyle(Paint.Style.FILL);
  }

  // Crucial: the caller has already rendered the genuine quake view under
  // this layer; it is revealed automatically without swapping WindowManager
  // windows or resetting the alert/replay/tsunami priority queue.
  c.restoreToCount(layer);
  c.restore();
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setAlpha(255);
 }
}
