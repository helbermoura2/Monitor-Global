package top.monitorglobal.tv;
import android.content.Context;import android.media.*;import android.os.*;import java.util.concurrent.*;

/** One short media-volume cue at a time. Never changes global TV volume or mute. */
final class TvSounds {
 private static final Handler MAIN=new Handler(Looper.getMainLooper());
 private static final ExecutorService PCM=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"monitor-audio");t.setDaemon(true);return t;});
 private static TvSounds instance;
 private final Context context;private final AudioManager manager;
 private AudioTrack track;private AudioFocusRequest focus;private TvSoundPattern active;private int generation;private boolean preview;private long lastAt;private TvSoundPattern last;
 private TvSounds(Context c){context=c.getApplicationContext();manager=context.getSystemService(AudioManager.class);}
 static boolean enabled(Context c,TvSoundPattern cue){return cue!=null&&Prefs.get(c).getBoolean("sound",true)&&Prefs.get(c).getBoolean(cue.preference(),true)&&volume(c)>0;}
 static int volume(Context c){return Math.max(0,Math.min(100,Prefs.get(c).getInt("soundVolume",85)));}
 static void play(Context c,TvSoundPattern cue){request(c,cue,false);}
 static void test(Context c,TvSoundPattern cue){request(c,cue,true);}
 private static void request(Context c,TvSoundPattern cue,boolean test){Context app=c.getApplicationContext();MAIN.post(()->{if(instance==null)instance=new TvSounds(app);instance.start(cue,test);});}
 static void stop(){MAIN.post(()->{if(instance!=null)instance.clear();});}
 static void stopPreview(){MAIN.post(()->{if(instance!=null&&instance.preview)instance.clear();});}
 private void status(String s){Prefs.get(context).edit().putString("soundStatus",s).apply();}
 private void start(TvSoundPattern cue,boolean test){
  if(!enabled(context,cue)){if(test)status("Som desativado: ative o som geral, esta categoria e uma intensidade acima de zero.");return;}
  PowerManager power=context.getSystemService(PowerManager.class);if(power!=null&&!power.isInteractive())return;
  long now=SystemClock.elapsedRealtime();if(active!=null&&(!test&&!preview&&active.priority>cue.priority||test&&!preview))return;
  if(!test&&last==cue&&now-lastAt<2000)return;
  clear();preview=test;active=cue;int token=generation;
  if(manager==null||manager.getStreamVolume(AudioManager.STREAM_MUSIC)==0){status("Som: volume de mídia da TV está zerado ou indisponível.");clear();return;}
  AudioAttributes attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
  focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes).setOnAudioFocusChangeListener(change->{if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){if(generation==token)clear();}},MAIN).build();
  try{if(manager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){status("Som: o sistema não liberou o áudio neste momento.");clear();return;}}
  catch(RuntimeException e){status("Som: áudio temporariamente indisponível.");clear();return;}
  final int level=volume(context);last=cue;lastAt=now;
  PCM.execute(()->{
   AudioTrack prepared=null;
   try{short[] samples=cue.pcm(level);prepared=new AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(TvSoundPattern.RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build()).setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(samples.length*2).build();if(prepared.getState()!=AudioTrack.STATE_INITIALIZED||prepared.write(samples,0,samples.length)!=samples.length)throw new IllegalStateException("Audio buffer unavailable");}
   catch(RuntimeException e){if(prepared!=null)prepared.release();MAIN.post(()->{if(generation==token){status("Som: não foi possível iniciar a saída de áudio da TV.");clear();}});return;}
   final AudioTrack ready=prepared;
   MAIN.post(()->{if(generation!=token||!enabled(context,cue)){ready.release();if(generation==token)clear();return;}track=ready;try{track.play();status((test?"Teste sonoro: ":"Som do aviso: ")+cue.label);MAIN.postDelayed(()->{if(generation==token)clear();},cue.duration()+120L);}catch(RuntimeException e){status("Som: saída de áudio indisponível.");clear();}});
  });
 }
 private void clear(){generation++;if(track!=null){try{track.stop();}catch(RuntimeException ignored){}track.release();track=null;}if(focus!=null){try{manager.abandonAudioFocusRequest(focus);}catch(RuntimeException ignored){}focus=null;}active=null;preview=false;}
}
