package top.monitorglobal.tv;

import android.content.Context;

/** Eligibility and approved video-2 timing. BannerOpening owns the single scene.
 * No rendering over NewsBannerView: the host switches from opening to data.
 */
final class GlobalM6Intro {
 static final String PREF_ENABLED="globalM6IntroEnabled";
 static final long TITLE_START_MS=700,HOLD_END_MS=2600,END_MS=3350;
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

 static boolean visible(long elapsed,boolean animated){return animated&&elapsed>=0&&elapsed<END_MS;}
}
