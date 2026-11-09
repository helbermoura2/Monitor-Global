package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Single native design vocabulary for Brent, temperature and voice/quake TV HUDs. */
final class TvCardStyle {
 static final int BODY=0xff071724;
 static final int FOOT=0xff020816;
 static final int CYAN=0xff38bdf8;
 static final int WHITE=0xfff1f7ff;
 static final int MUTED=0xffbfd1df;
 static final int GREEN=0xff43e6a1;
 static final int RED=0xffff747e;
 private TvCardStyle(){}

 static Typeface brand(Context c){
  try{return Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf");}
  catch(RuntimeException e){return Typeface.DEFAULT_BOLD;}
 }
 static int dp(Context c,int n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
 static GradientDrawable panel(Context c,int color){
  GradientDrawable d=new GradientDrawable();
  d.setColor(color);
  d.setCornerRadius(dp(c,10));
  return d;
 }
 static LinearLayout section(Context c,int background,int hPad,int vPad){
  LinearLayout out=new LinearLayout(c);
  out.setOrientation(LinearLayout.VERTICAL);
  out.setBackgroundColor(background);
  out.setPadding(dp(c,hPad),dp(c,vPad),dp(c,hPad),dp(c,vPad));
  return out;
 }
 static LinearLayout header(Context c){return section(c,CYAN,16,9);}
 static LinearLayout body(Context c){return section(c,BODY,18,13);}
 static LinearLayout footer(Context c){return section(c,FOOT,16,8);}
 static TextView label(Context c,String text,int size,int color,Typeface face,int maxLines){
  TextView view=new TextView(c);
  view.setText(text);
  view.setTextSize(size);
  view.setTextColor(color);
  view.setTypeface(face);
  view.setMaxLines(maxLines);
  view.setIncludeFontPadding(false);
  return view;
 }
}
