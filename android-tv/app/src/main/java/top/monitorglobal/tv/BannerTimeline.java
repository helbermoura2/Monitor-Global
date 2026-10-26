package top.monitorglobal.tv;
/** Monotonic timing shared by drawing, queue and local tests. */
final class BannerTimeline {
 static final long SUMMARY_PAGE_MS=6000;
 static long summaryDuration(int count){return Math.min(5,Math.max(0,count))*SUMMARY_PAGE_MS;}
 static final long PAGE_MS=8000,FADE_MS=360,PAGE_FADE_MS=650,REVISION_AT_MS=2400;
 static final long WIPE_MS=700;
 static long summaryContentDuration(int count,boolean animated){int n=Math.min(5,Math.max(0,count));return n==0?0:n*SUMMARY_PAGE_MS+(animated?(n-1)*PAGE_FADE_MS:0);}
 static long summaryTotalDuration(int count,boolean animated){long content=summaryContentDuration(count,animated);return content==0?0:content+(animated?2*WIPE_MS:0);}
 static long summaryElapsed(long elapsed,boolean animated){return Math.max(0,elapsed-(animated?WIPE_MS:0));}
 static int summaryPage(long elapsed,int count,boolean animated){long fade=animated?PAGE_FADE_MS:0;return Math.max(0,Math.min(Math.min(5,count)-1,(int)((Math.max(0,elapsed)+fade)/(SUMMARY_PAGE_MS+fade))));}
 static long summaryFadeElapsed(long elapsed,int index){return index==0?Long.MAX_VALUE:elapsed-(index*(SUMMARY_PAGE_MS+PAGE_FADE_MS)-PAGE_FADE_MS);}
 static int page(long elapsed,int count){return count<2?0:(int)(Math.max(0,elapsed)/PAGE_MS%count);}
 static float progress(long elapsed){float t=Math.min(1,Math.max(0,elapsed)/(float)FADE_MS);return t*t*(3-2*t);}
 static float pageProgress(long elapsed){float t=Math.min(1,Math.max(0,elapsed)/(float)PAGE_FADE_MS);return t*t*(3-2*t);}
 static long durationMillis(Alert a,int seconds){return Math.max(Math.max(15,seconds)*1000L,a.companion==null?0:4*PAGE_MS);}
 static boolean magnitudeChanged(Alert a){return Double.isFinite(a.previousMagnitude)&&Double.isFinite(a.magnitude)&&Math.abs(a.previousMagnitude-a.magnitude)>.001;}
}
