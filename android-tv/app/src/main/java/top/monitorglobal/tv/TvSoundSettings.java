package top.monitorglobal.tv;

import android.app.*;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioManager;
import android.view.*;
import android.widget.*;

final class TvSoundSettings {
 private static final int GOLD=0xffc4a16a,INK=0xfff2eee8,MUTED=0xffbcb8b2,BLACK=0xff000000,TEAL=0xff7ddbc5;
 private static int dp(Activity a,int n){return Math.round(n*a.getResources().getDisplayMetrics().density);}
 private static GradientDrawable glass(Activity a,boolean focus,int radius){
  GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
   focus?new int[]{0xff30271d,0xff100d09}:new int[]{0xff151617,0xff080809});
  d.setCornerRadius(dp(a,radius));d.setStroke(dp(a,focus?2:1),focus?GOLD:0xff333031);return d;
 }
 private static TextView text(Activity a,String value,int size,int color){
  TextView t=new TextView(a);t.setText(value);t.setTextSize(size);t.setTextColor(color);
  t.setIncludeFontPadding(false);return t;
 }
 private static Button button(Activity a,String title){
  Button b=new Button(a);b.setId(View.generateViewId());b.setText(title);b.setAllCaps(false);
  b.setTextSize(15);b.setTextColor(INK);b.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
  b.setBackgroundTintList(null);b.setStateListAnimator(null);b.setMinHeight(0);b.setMinimumHeight(0);
  b.setMinWidth(0);b.setMinimumWidth(0);b.setIncludeFontPadding(false);b.setBackground(glass(a,false,9));
  b.setPadding(dp(a,12),0,dp(a,12),0);
  b.setOnFocusChangeListener((v,focused)->{b.setBackground(glass(a,focused,9));b.setPadding(dp(a,12),0,dp(a,12),0);});
  return b;
 }
 private static void tintSwitch(Activity a,Switch sw){
  sw.setId(View.generateViewId());sw.setTextColor(INK);sw.setTextSize(16);
  sw.setThumbTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked},new int[]{}},new int[]{TEAL,0xffa5a19c}));
  sw.setTrackTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked},new int[]{}},new int[]{0xff376b60,0xff494849}));
  sw.setPadding(dp(a,10),0,dp(a,8),0);
  sw.setOnFocusChangeListener((v,focused)->{sw.setBackground(focused?glass(a,true,9):null);sw.setPadding(dp(a,10),0,dp(a,8),0);});
 }
 private static void group(Activity a,LinearLayout body,String title){
  TextView label=text(a,title,14,GOLD);label.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));label.setLetterSpacing(.06f);
  LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(a,13);p.bottomMargin=dp(a,5);body.addView(label,p);
 }
 private static void row(Activity a,LinearLayout body,TextView result,TvSoundPattern cue){
  LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);row.setBackground(glass(a,false,11));
  row.setPadding(dp(a,4),dp(a,4),dp(a,5),dp(a,4));
  Switch enabled=new Switch(a);enabled.setText(cue.label);enabled.setTag("sound-category-"+cue.name());
  tintSwitch(a,enabled);enabled.setChecked(Prefs.get(a).getBoolean(cue.preference(),true));
  enabled.setOnCheckedChangeListener((v,on)->{Prefs.get(a).edit().putBoolean(cue.preference(),on).apply();if(!on)TvSounds.stopPreview();});
  row.addView(enabled,new LinearLayout.LayoutParams(0,dp(a,43),1));
  Button test=button(a,"Ouvir");test.setTextColor(GOLD);test.setContentDescription("Ouvir som de "+cue.label);
  test.setTag("sound-test-"+cue.name());test.setOnClickListener(v->{result.setText("Preparando teste de "+cue.label+"…");TvSounds.test(a,cue);});
  LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(dp(a,100),dp(a,38));tp.leftMargin=dp(a,10);row.addView(test,tp);
  enabled.setNextFocusRightId(test.getId());test.setNextFocusLeftId(enabled.getId());
  LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.bottomMargin=dp(a,4);body.addView(row,rp);
 }
 static void show(Activity a){show(a,()->{});}
 static void show(Activity a,Runnable onClose){
  a.setVolumeControlStream(AudioManager.STREAM_MUSIC);
  SharedPreferences preferences=Prefs.get(a);
  LinearLayout root=new LinearLayout(a);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BLACK);
  root.setPadding(dp(a,24),dp(a,14),dp(a,24),dp(a,12));
  TextView brand=text(a,"ARGOS ORBIS   /   ÁUDIO",13,GOLD);brand.setLetterSpacing(.09f);root.addView(brand);
  TextView title=text(a,"Sons dos avisos da TV",26,INK);title.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));root.addView(title);
  TextView help=text(a,"Ajuste a intensidade do app e o volume de mídia da TV. Replays, simulações da Defesa Civil e tsunami sem ameaça são silenciosos.",14,MUTED);
  LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,-2);hp.topMargin=dp(a,5);hp.bottomMargin=dp(a,9);root.addView(help,hp);
  ScrollView scroll=new ScrollView(a);scroll.setFillViewport(true);scroll.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
  LinearLayout body=new LinearLayout(a);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(0,0,dp(a,9),dp(a,8));
  scroll.addView(body,new ScrollView.LayoutParams(-1,-2));root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  group(a,body,"INTENSIDADE E CONTROLE GERAL");
  Switch master=new Switch(a);master.setText("Sons dos avisos ativados");master.setTag("sound-master");tintSwitch(a,master);
  master.setChecked(preferences.getBoolean("sound",true));master.setOnCheckedChangeListener((v,on)->{preferences.edit().putBoolean("sound",on).apply();if(!on)TvSounds.stop();});
  body.addView(master,new LinearLayout.LayoutParams(-1,dp(a,42)));
  LinearLayout volumeRow=new LinearLayout(a);volumeRow.setGravity(Gravity.CENTER_VERTICAL);
  TextView level=text(a,"Intensidade do aplicativo: "+TvSounds.volume(a)+"%",19,INK);volumeRow.addView(level,new LinearLayout.LayoutParams(0,-2,1));
  Button reset=button(a,"Restaurar padrão");reset.setTag("sound-reset");volumeRow.addView(reset,new LinearLayout.LayoutParams(dp(a,170),dp(a,38)));body.addView(volumeRow);
  SeekBar slider=new SeekBar(a);slider.setId(View.generateViewId());slider.setTag("sound-volume");slider.setMax(100);slider.setProgress(TvSounds.volume(a));slider.setKeyProgressIncrement(5);
  slider.setContentDescription("Intensidade dos avisos sonoros");slider.setProgressTintList(ColorStateList.valueOf(GOLD));slider.setThumbTintList(ColorStateList.valueOf(TEAL));
  slider.setOnFocusChangeListener((v,focused)->v.setBackground(focused?glass(a,true,9):null));
  body.addView(slider,new LinearLayout.LayoutParams(-1,dp(a,44)));
  slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int value,boolean user){level.setText("Intensidade do aplicativo: "+value+"%");if(user){preferences.edit().putInt("soundVolume",value).apply();TvSounds.stopPreview();}}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}});
  reset.setOnClickListener(v->{preferences.edit().putInt("soundVolume",85).apply();slider.setProgress(85);TvSounds.stopPreview();});
  TextView result=text(a,"Selecione OUVIR para testar o áudio da TV.",14,TEAL);result.setTag("sound-status");result.setMinLines(2);
  // Actual asynchronous playback status, not an assumed success.
  SharedPreferences.OnSharedPreferenceChangeListener statusListener=(changed,key)->{
   if("soundStatus".equals(key))result.post(()->result.setText(changed.getString("soundStatus","")));
  };
  group(a,body,"DEFESA CIVIL");
  row(a,body,result,TvSoundPattern.CIVIL_SEVERE);row(a,body,result,TvSoundPattern.CIVIL_EXTREME);
  group(a,body,"SISMOLOGIA E TSUNAMI");
  for(TvSoundPattern cue:new TvSoundPattern[]{TvSoundPattern.EARTHQUAKE,TvSoundPattern.REGIONAL,TvSoundPattern.TSUNAMI,TvSoundPattern.TSUNAMI_END,TvSoundPattern.SUMMARY})row(a,body,result,cue);
  group(a,body,"METEOROLOGIA");
  row(a,body,result,TvSoundPattern.RAIN);row(a,body,result,TvSoundPattern.WEATHER);
  group(a,body,"MERCADO");row(a,body,result,TvSoundPattern.MARKET);
  LinearLayout footer=new LinearLayout(a);footer.setGravity(Gravity.CENTER_VERTICAL);footer.setPadding(0,dp(a,8),0,0);
  footer.addView(result,new LinearLayout.LayoutParams(0,-2,1));
  Button done=button(a,"Concluir");done.setTag("sound-done");footer.addView(done,new LinearLayout.LayoutParams(dp(a,140),dp(a,44)));root.addView(footer);
  AlertDialog dialog=new AlertDialog.Builder(a).setView(root).create();
  done.setOnClickListener(v->dialog.dismiss());
  dialog.setOnDismissListener(d->{preferences.unregisterOnSharedPreferenceChangeListener(statusListener);TvSounds.stopPreview();onClose.run();});
  preferences.registerOnSharedPreferenceChangeListener(statusListener);
  dialog.show();
  Window window=dialog.getWindow();if(window!=null){window.setBackgroundDrawable(new ColorDrawable(BLACK));
   int width=a.getResources().getDisplayMetrics().widthPixels;
   int height=a.getResources().getDisplayMetrics().heightPixels;
   window.setLayout(Math.min(width-dp(a,30),dp(a,960)),height-dp(a,30));}
  master.requestFocus();
 }
}
