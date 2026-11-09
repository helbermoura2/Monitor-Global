package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.view.View;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;

/** Lightweight transform-only motion for non-emergency TV overlays. */
final class CardMotion {
 private static final long ENTER_MS=360L,EXIT_MS=290L,FLIP_OUT_MS=260L,FLIP_IN_MS=360L;
 private CardMotion(){}
 static boolean enabled(){return ValueAnimator.areAnimatorsEnabled();}
 private static int dp(Context c,int value){return TvCardStyle.dp(c,value);}

 static void enter(View v,Context c){
  v.animate().cancel();v.setRotationY(0f);
  if(!enabled()){v.setAlpha(1f);v.setTranslationY(0f);return;}
  v.setAlpha(0f);v.setTranslationY(dp(c,48));
  v.animate().alpha(1f).translationY(0f).setDuration(ENTER_MS)
   .setInterpolator(new DecelerateInterpolator()).start();
 }
 static void exit(View v,Context c,Runnable finished){
  v.animate().cancel();
  if(!enabled()){finished.run();return;}
  v.animate().alpha(0f).translationY(dp(c,60)).setDuration(EXIT_MS)
   .setInterpolator(new AccelerateInterpolator()).withEndAction(finished).start();
 }
 /** First half of the weather -> satellite handoff. Only if a real frame is ready. */
 static void flipOut(View v,Context c,Runnable finished){
  v.animate().cancel();
  if(!enabled()){finished.run();return;}
  v.setCameraDistance(dp(c,1200));
  v.animate().rotationY(90f).alpha(0f).setDuration(FLIP_OUT_MS)
   .setInterpolator(new AccelerateInterpolator()).withEndAction(finished).start();
 }
 /** Second half of a playing-card turn; no extra bitmap copies. */
 static void flipIn(View v,Context c){
  v.animate().cancel();v.setTranslationY(0f);
  if(!enabled()){v.setAlpha(1f);v.setRotationY(0f);return;}
  v.setCameraDistance(dp(c,1200));v.setRotationY(-90f);v.setAlpha(0f);
  v.animate().rotationY(0f).alpha(1f).setDuration(FLIP_IN_MS)
   .setInterpolator(new DecelerateInterpolator()).start();
 }
}
