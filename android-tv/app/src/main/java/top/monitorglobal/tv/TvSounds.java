package top.monitorglobal.tv;

import android.content.Context;
import android.media.*;
import android.os.*;
import android.util.Log;
import java.util.concurrent.*;

/** Local event cues played through the TV MEDIA route. No global volume changes. */
final class TvSounds {
 private static final String TAG="MonitorTvAudio";
 private static final Handler MAIN=new Handler(Looper.getMainLooper());
 private static final ExecutorService PCM=Executors.newSingleThreadExecutor(r->{
  Thread t=new Thread(r,"monitor-audio");t.setDaemon(true);return t;
 });
 // Android TV / Fire TV HDMI sinks generally negotiate 48 kHz PCM. Prefer
 // standard streaming output; retry other valid routes without user action.
 private static final int[][] ROUTES={
  {48000,AudioFormat.CHANNEL_OUT_STEREO,2},
  {48000,AudioFormat.CHANNEL_OUT_MONO,1},
  {44100,AudioFormat.CHANNEL_OUT_STEREO,2},
  {44100,AudioFormat.CHANNEL_OUT_MONO,1},
  {24000,AudioFormat.CHANNEL_OUT_MONO,1}
 };
 private static TvSounds instance;
 private final Context context;
 private final AudioManager manager;
 private AudioTrack track;
 private ToneGenerator fallbackTone;
 private AudioFocusRequest focus;
 private TvSoundPattern active;
 private volatile int generation;
 private boolean preview;

 private TvSounds(Context c){context=c.getApplicationContext();manager=context.getSystemService(AudioManager.class);}
 static boolean enabled(Context c,TvSoundPattern cue){
  return cue!=null&&Prefs.get(c).getBoolean("sound",true)&&Prefs.get(c).getBoolean(cue.preference(),true)&&volume(c)>0;
 }
 static int volume(Context c){return Math.max(0,Math.min(100,Prefs.get(c).getInt("soundVolume",85)));}
 static void play(Context c,TvSoundPattern cue){request(c,cue,false);}
 static void test(Context c,TvSoundPattern cue){request(c,cue,true);}
 private static void request(Context c,TvSoundPattern cue,boolean test){
  Context app=c.getApplicationContext();
  MAIN.post(()->{if(instance==null)instance=new TvSounds(app);instance.start(cue,test);});
 }
 static void stop(){MAIN.post(()->{if(instance!=null)instance.clear();});}
 static void stopPreview(){MAIN.post(()->{if(instance!=null&&instance.preview)instance.clear();});}
 private void status(String s){Prefs.get(context).edit().putString("soundStatus",s).apply();}

 private static final class Prepared {
  final AudioTrack output;
  final short[] data;
  final String route;
  Prepared(AudioTrack output,short[] data,String route){
   this.output=output;this.data=data;this.route=route;
  }
 }
 private static void dispose(AudioTrack output){
  if(output==null)return;
  try{if(output.getPlayState()==AudioTrack.PLAYSTATE_PLAYING)output.pause();}
  catch(RuntimeException ignored){}
  try{output.flush();}catch(RuntimeException ignored){}
  try{output.release();}catch(RuntimeException ignored){}
 }
 /** Construct and validate a streaming PCM output before ever claiming it plays.
  * No UI thread allocations or blocking writes. Each failed route is discarded. */
 private static Prepared prepare(TvSoundPattern cue,int level,int token,TvSounds owner,AudioAttributes attributes){
  for(int[] cfg:ROUTES){
   if(owner.generation!=token)return null;
   int rate=cfg[0],mask=cfg[1],channels=cfg[2];
   AudioTrack candidate=null;
   try{
    int minimum=AudioTrack.getMinBufferSize(rate,mask,AudioFormat.ENCODING_PCM_16BIT);
    if(minimum<=0)continue;
    int buffer=Math.max(minimum,rate*channels*2/8); // >=125 ms of PCM.
    candidate=new AudioTrack.Builder().setAudioAttributes(attributes)
      .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(rate).setChannelMask(mask).build())
      .setTransferMode(AudioTrack.MODE_STREAM)
      .setBufferSizeInBytes(buffer).build();
    if(candidate.getState()!=AudioTrack.STATE_INITIALIZED)throw new IllegalStateException("Uninitialized stream");
    short[] samples=cue.pcm(level,rate,channels);
    return new Prepared(candidate,samples,rate+" Hz / "+channels+" ch");
   }catch(RuntimeException error){
    Log.w(TAG,"AudioTrack route unavailable: "+rate+" Hz / "+channels+" ch",error);
    dispose(candidate);
   }
  }
  return null;
 }
 private void start(TvSoundPattern cue,boolean test){
  if(!enabled(context,cue)){
   if(test)status("Som desativado: ative o som geral, esta categoria e uma intensidade acima de zero.");
   return;
  }
  PowerManager power=context.getSystemService(PowerManager.class);
  if(power!=null&&!power.isInteractive())return;
  if(!TvSoundPattern.canReplace(active,preview,cue,test))return;
  clear();preview=test;active=cue;
  final int token=generation;
  if(manager==null||manager.getStreamVolume(AudioManager.STREAM_MUSIC)==0){
   status("Som: volume de mídia da TV está zerado ou indisponível.");
   clear();return;
  }
  final AudioAttributes attributes=new AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
  try{
   focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
     .setAudioAttributes(attributes).setOnAudioFocusChangeListener(change->{
      if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){
       if(generation==token)clear();
      }
     },MAIN).build();
   if(manager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){
    status("Som: o sistema não liberou o áudio neste momento.");
    clear();return;
   }
  }catch(RuntimeException error){
   Log.w(TAG,"Audio focus unavailable",error);
   status("Som: o áudio está temporariamente ocupado ou indisponível.");
   clear();return;
  }
  status("Som: preparando saída de áudio compatível com a TV…");
  final int level=volume(context);
  PCM.execute(()->{
   Prepared prepared=prepare(cue,level,token,this,attributes);
   MAIN.post(()->{
    if(generation!=token||!enabled(context,cue)){
     if(prepared!=null)dispose(prepared.output);
     if(generation==token)clear();
     return;
    }
    if(prepared==null){
     startFallback(token,cue,test,"nenhuma saída PCM aceita");
     return;
    }
    track=prepared.output;
    try{
     track.play();
     if(track.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING)
      throw new IllegalStateException("AudioTrack not in PLAYING state");
     // Work is queued only after play(); short-array writes in MODE_STREAM
     // must NEVER block the TV UI or precede stream playback.
     PCM.execute(()->feed(prepared,token,cue,test));
     status((test?"Teste sonoro enviado: ":"Som do aviso enviado: ")+cue.label);
     MAIN.postDelayed(()->{if(generation==token)clear();},cue.duration()+600L);
    }catch(RuntimeException failure){
     Log.w(TAG,"Unable to start PCM stream "+prepared.route,failure);
     dispose(track);track=null;
     startFallback(token,cue,test,"falha ao iniciar PCM");
    }
   });
  });
 }
 private void feed(Prepared prepared,int token,TvSoundPattern cue,boolean test){
  int cursor=0;
  try{
   while(cursor<prepared.data.length&&generation==token){
    int next=Math.min(4096,prepared.data.length-cursor);
    int written=prepared.output.write(prepared.data,cursor,next,AudioTrack.WRITE_BLOCKING);
    if(written<=0)throw new IllegalStateException("PCM write returned "+written);
    cursor+=written;
   }
  }catch(RuntimeException failure){
   Log.w(TAG,"AudioTrack stream write failed: "+prepared.route,failure);
   MAIN.post(()->{
    if(generation==token)startFallback(token,cue,test,"falha ao transmitir PCM");
   });
  }
 }
 /** Last-resort audible output on devices rejecting ALL PCM configurations.
  * Generic beep is explicitly labelled; it never masquerades as a distinct cue. */
 private void startFallback(int token,TvSoundPattern cue,boolean test,String why){
  if(generation!=token)return;
  if(track!=null){dispose(track);track=null;}
  Log.w(TAG,"Using media ToneGenerator: "+why);
  try{
   fallbackTone=new ToneGenerator(AudioManager.STREAM_MUSIC,volume(context));
   if(!fallbackTone.startTone(ToneGenerator.TONE_PROP_BEEP,Math.min(850,cue.duration())))
    throw new IllegalStateException("ToneGenerator declined playback");
   status((test?"Teste: ":"Aviso: ")+"sinal alternativo da TV ("+cue.label+"). O áudio PCM não foi aceito.");
   MAIN.postDelayed(()->{if(generation==token)clear();},Math.min(850,cue.duration())+250L);
  }catch(RuntimeException error){
   Log.e(TAG,"All audio outputs failed",error);
   status("Som: a TV recusou áudio PCM e sinal alternativo. Verifique a saída de mídia/HDMI.");
   clear();
  }
 }
 private void clear(){
  generation++;
  if(track!=null){dispose(track);track=null;}
  if(fallbackTone!=null){
   try{fallbackTone.stopTone();}catch(RuntimeException ignored){}
   try{fallbackTone.release();}catch(RuntimeException ignored){}
   fallbackTone=null;
  }
  if(focus!=null){
   if(manager!=null)try{manager.abandonAudioFocusRequest(focus);}catch(RuntimeException ignored){}
   focus=null;
  }
  active=null;preview=false;
 }
}
