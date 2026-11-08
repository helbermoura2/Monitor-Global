package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.*;import android.view.*;import android.widget.*;
import java.util.*;

/** Compact Brent on-video HUD in the original Monitor Global navy/cyan palette. */
final class BrentCardView extends LinearLayout {
 static final int BODY=0xff071724,DEEP=0xff020816,CYAN=0xff38bdf8,WHITE=0xfff1f7ff,MUTED=0xffb7c7d8,GREEN=0xff43e6a1,RED=0xffff747e;
 private final Typeface brand;
 BrentCardView(Context c,BrentQuote q,boolean demo){
  super(c);setOrientation(VERTICAL);
  brand=load(c);setBackground(round(BODY));
  LinearLayout bar=new LinearLayout(c);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(16),dp(9),dp(16),dp(9));bar.setBackgroundColor(CYAN);addView(bar,new LayoutParams(-1,-2));
  bar.addView(label("BRENT  /  PETRÓLEO",17,DEEP,true),new LayoutParams(0,-2,1));
  bar.addView(label(demo?"TESTE FICTÍCIO":"ICE · BZ=F",12,DEEP,true));
  LinearLayout body=new LinearLayout(c);body.setOrientation(VERTICAL);body.setPadding(dp(18),dp(13),dp(18),dp(13));addView(body,new LayoutParams(-1,-2));
  LinearLayout values=new LinearLayout(c);values.setGravity(Gravity.CENTER_VERTICAL);body.addView(values,new LayoutParams(-1,-2));
  LinearLayout main=new LinearLayout(c);main.setOrientation(VERTICAL);values.addView(main,new LayoutParams(0,-2,1));
  main.addView(label("US$  "+String.format(Locale.forLanguageTag("pt-BR"),"%.2f",q.price),39,WHITE,true));
  main.addView(label("POR BARRIL",14,MUTED,true));
  if(q.percent!=null){
   final int tint=q.change>0?GREEN:q.change<0?RED:MUTED;
   LinearLayout delta=new LinearLayout(c);delta.setGravity(Gravity.CENTER);delta.setOrientation(VERTICAL);delta.setPadding(dp(12),dp(7),dp(12),dp(7));
   GradientDrawable bg=round(DEEP);bg.setStroke(dp(1),tint);delta.setBackground(bg);values.addView(delta,new LayoutParams(-2,-2));
   delta.addView(label((q.percent>=0?"▲ +":"▼ ")+String.format(Locale.forLanguageTag("pt-BR"),"%.2f",q.percent)+"%",21,tint,true));
   delta.addView(label((q.change>=0?"+":"")+String.format(Locale.forLanguageTag("pt-BR"),"%.2f",q.change)+" US$",13,tint,true));
  }else body.addView(label("Variação indisponível",14,MUTED,false));
  View divider=new View(c);divider.setBackgroundColor(0xff244658);LayoutParams sep=new LayoutParams(-1,dp(1));sep.topMargin=dp(12);sep.bottomMargin=dp(9);body.addView(divider,sep);
  body.addView(label(demo?"DADOS SIMULADOS · NÃO É COTAÇÃO":"Fonte: "+q.source+" · ref. "+BrentQuote.clock(q.at),14,MUTED,false));
  body.addView(label("Preço indicativo, sujeito a atraso. Futuros Brent (BZ=F).",12,MUTED,false));
 }
 private Typeface load(Context c){try{return Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf");}catch(RuntimeException e){return Typeface.DEFAULT_BOLD;}}
 private TextView label(String s,int sp,int color,boolean bold){
  TextView t=new TextView(getContext());t.setText(s);t.setTextColor(color);t.setTextSize(sp);t.setTypeface(bold?brand:Typeface.DEFAULT);
  t.setMaxLines(2);t.setIncludeFontPadding(false);return t;
 }
 private GradientDrawable round(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(10));return d;}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
}
