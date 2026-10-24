package top.monitorglobal.tv;
/** Monotonic timing shared by drawing, queue and local tests. */
final class BannerTimeline {
 static final long PAGE_MS=8000,FADE_MS=360,REVISION_AT_MS=2400;
 static int page(long elapsed,int count){return count<2?0:(int)(Math.max(0,elapsed)/PAGE_MS%count);}
 static float progress(long elapsed){float t=Math.min(1,Math.max(0,elapsed)/(float)FADE_MS);return t*t*(3-2*t);}
 static long durationMillis(Alert a,int seconds){return Math.max(Math.max(15,seconds)*1000L,a.companion==null?0:4*PAGE_MS);}
 static boolean magnitudeChanged(Alert a){return Double.isFinite(a.previousMagnitude)&&Double.isFinite(a.magnitude)&&Math.abs(a.previousMagnitude-a.magnitude)>.001;}
}
