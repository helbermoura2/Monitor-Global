package top.monitorglobal.tv;
import android.app.*;import android.content.SharedPreferences;import android.graphics.Color;import android.media.AudioManager;import android.os.*;import android.widget.*;

final class TvSoundSettings {
 static void show(Activity a){
  a.setVolumeControlStream(AudioManager.STREAM_MUSIC);
  LinearLayout body=new LinearLayout(a);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(24,12,24,16);
  TextView help=new TextView(a);help.setText("Sons diferentes por aviso. Use o controle para ajustar o volume de mídia da TV. O aplicativo não altera o volume geral. Replay e boletim sem ameaça de tsunami permanecem silenciosos.");body.addView(help);
  TextView level=new TextView(a);level.setText("Intensidade do aplicativo: "+TvSounds.volume(a)+"%");body.addView(level);
  SeekBar slider=new SeekBar(a);slider.setMax(100);slider.setProgress(TvSounds.volume(a));slider.setKeyProgressIncrement(5);slider.setContentDescription("Intensidade dos avisos sonoros");body.addView(slider);
  slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int value,boolean user){level.setText("Intensidade do aplicativo: "+value+"%");if(user){Prefs.get(a).edit().putInt("soundVolume",value).apply();TvSounds.stopPreview();}}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}});
  TextView result=new TextView(a);result.setText("Selecione OUVIR para testar o áudio da TV.");body.addView(result);
  // Stream initialization is asynchronous: a fixed 250 ms delay can show a
  // stale failure. Observe the actual audio status until this dialog closes.
  SharedPreferences preferences=Prefs.get(a);
  SharedPreferences.OnSharedPreferenceChangeListener statusListener=(changed,key)->{
   if("soundStatus".equals(key))
    result.post(()->result.setText(changed.getString("soundStatus","")));
  };
  preferences.registerOnSharedPreferenceChangeListener(statusListener);
  for(TvSoundPattern cue:TvSoundPattern.values()){
   LinearLayout row=new LinearLayout(a);Switch enabled=new Switch(a);enabled.setText(cue.label);enabled.setTag("sound-category-"+cue.name());enabled.setChecked(Prefs.get(a).getBoolean(cue.preference(),true));enabled.setOnCheckedChangeListener((v,on)->{Prefs.get(a).edit().putBoolean(cue.preference(),on).apply();if(!on)TvSounds.stopPreview();});row.addView(enabled,new LinearLayout.LayoutParams(0,-2,1));
   Button test=new Button(a);test.setText("Ouvir");test.setContentDescription("Ouvir som de "+cue.label);test.setTag("sound-test-"+cue.name());test.setOnClickListener(v->{result.setText("Preparando teste de "+cue.label+"…");TvSounds.test(a,cue);});row.addView(test);body.addView(row);
  }
  ScrollView scroll=new ScrollView(a);scroll.addView(body);AlertDialog dialog=new AlertDialog.Builder(a).setTitle("Sons dos avisos da TV").setView(scroll).setPositiveButton("Concluir",null).create();dialog.setOnDismissListener(d->{preferences.unregisterOnSharedPreferenceChangeListener(statusListener);TvSounds.stopPreview();});dialog.show();
 }
}
