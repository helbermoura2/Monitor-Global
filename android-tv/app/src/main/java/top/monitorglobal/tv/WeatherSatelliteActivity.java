package top.monitorglobal.tv;
import android.app.Activity;import android.os.*;import android.graphics.Color;import android.graphics.drawable.GradientDrawable;import android.view.*;import android.widget.*;import java.util.*;import java.util.concurrent.*;
/** Remote-control viewer: two geographic scopes, explicit bounded playback, no idle work. */
public final class WeatherSatelliteActivity extends Activity {
 java.util.function.Function<android.content.Context,WeatherSatelliteClient> sourceFactory=WeatherSatelliteClient::new;
 private final Handler main=new Handler(Looper.getMainLooper());private ExecutorService worker;private WeatherSatelliteClient client;private WeatherSatelliteClient.Frame frame;private WeatherSatelliteCard card;private FrameLayout image;private TextView status;private Button animation,exit,layer;private boolean radarMode;private RadarMapClient radar;private android.graphics.Bitmap radarBitmap;private final List<Button> controls=new ArrayList<>();private InfraredPlan.Scope scope=InfraredPlan.BRAZIL;private boolean active,busy,playing;private int generation,index;private List<Long> times=new ArrayList<>();private final Runnable step=()->load(false);
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setBackgroundColor(WeatherCardView.BODY);page.setPadding(dp(24),dp(12),dp(24),dp(12));status=new TextView(this);status.setTextSize(17);status.setTextColor(Color.WHITE);status.setPadding(0,0,0,dp(6));page.addView(status,new LinearLayout.LayoutParams(-1,-2));image=new FrameLayout(this);page.addView(image,new LinearLayout.LayoutParams(-1,0,1));LinearLayout buttons=new LinearLayout(this);page.addView(buttons,new LinearLayout.LayoutParams(-1,-2));button(buttons,"Brasil",()->select(InfraredPlan.BRAZIL));button(buttons,"Sudeste",()->select(InfraredPlan.SOUTHEAST));layer=button(buttons,"Radar",()->switchLayer());animation=button(buttons,"Animar",()->{playing=!playing;animation.setText(playing?"Pausar":"Animar");main.removeCallbacks(step);if(playing){index=-1;if(!busy)load(false);}});button(buttons,"Atualizar",()->{if(!busy){playing=false;animation.setText("Animar");times.clear();load(true);}});exit=button(buttons,"Voltar",this::finish);setContentView(page);}
 private void clearDisplayed(){
  image.removeAllViews();if(card!=null){card.clear();card=null;}if(frame!=null){frame.close();frame=null;}
  if(radarBitmap!=null){radarBitmap.recycle();radarBitmap=null;}
 }
 private void switchLayer(){
  if(busy||!active)return;radarMode=!radarMode;playing=false;times.clear();main.removeCallbacks(step);
  animation.setText("Animar");animation.setEnabled(!radarMode);layer.setText(radarMode?"Satélite":"Radar");
  if(radarMode)scope=InfraredPlan.SOUTHEAST;
  clearDisplayed();load(true);
 }
 private void loadRadar(){
  busy=true;for(Button b:controls)b.setEnabled(b==exit);
  int token=generation;InfraredPlan.Scope selected=scope;RadarMapClient source=radar;WeatherSatelliteClient geography=client;
  status.setText("Radar observado · consultando INPE / DECEA");
  worker.execute(()->{
   RadarMapClient.Frame result=null;android.graphics.Bitmap bitmap=null;
   try{result=source.latest(System.currentTimeMillis());bitmap=RadarMapRender.render(this,geography,selected,result);}catch(Exception|OutOfMemoryError ignored){}
   final RadarMapClient.Frame ready=result;final android.graphics.Bitmap drawn=bitmap;
   main.post(()->{
    if(!active||token!=generation){if(drawn!=null)drawn.recycle();return;}
    busy=false;for(Button b:controls)b.setEnabled(b!=animation);
    clearDisplayed();
    if(drawn==null||ready==null){if(drawn!=null)drawn.recycle();status.setText("Radar indisponível · INPE / DECEA · cobertura piloto, não indica ausência de chuva");return;}
    long now=System.currentTimeMillis();radarBitmap=drawn;
    ImageView map=new ImageView(this);map.setImageBitmap(drawn);map.setScaleType(ImageView.ScaleType.FIT_CENTER);map.setContentDescription("Radar observado em dBZ, áreas cinza sem dado confirmado");image.addView(map,new FrameLayout.LayoutParams(-1,-1));
    status.setText(ready.credit()+" · "+InfraredPlan.timing(ready.at,now)+(now-ready.at>60*60000L?" · VENCIDO":"")+" · dBZ · cinza: sem dado confirmado");
   });
  });
 }
 private void select(InfraredPlan.Scope next){if(busy)return;scope=next;times.clear();playing=false;animation.setText("Animar");main.removeCallbacks(step);load(true);}
 @Override protected void onStart(){super.onStart();active=true;animation.setText("Animar");client=sourceFactory.apply(this);radar=new RadarMapClient();worker=Executors.newSingleThreadExecutor();load(true);}
 private void load(boolean latest){if(!active||busy)return;if(radarMode){loadRadar();return;}busy=true;for(Button b:controls)b.setEnabled(b==exit);animation.setEnabled(true);int token=generation;InfraredPlan.Scope selected=scope;status.setText(frame==null?"Consultando satélite · "+scope.name:"Atualizando satélite · a imagem anterior permanece visível");WeatherSatelliteClient source=client;long target=0;if(!latest&&!times.isEmpty()){index=nextFrameIndex(index,times.size());target=times.get(index);}final long at=target;
  worker.execute(()->{WeatherSatelliteClient.Frame result=null;try{if(latest)source.available(System.currentTimeMillis(),true);result=at>0?source.frame(selected,at,System.currentTimeMillis()):source.latest(selected,System.currentTimeMillis());}catch(Exception|OutOfMemoryError ignored){}WeatherSatelliteClient.Frame ready=result;main.post(()->{if(!active||token!=generation){if(ready!=null)ready.close();return;}busy=false;for(Button b:controls)b.setEnabled(true);if(ready!=null){WeatherSatelliteCard previous=card;WeatherSatelliteClient.Frame old=frame;image.removeAllViews();if(previous!=null)previous.clear();frame=ready;card=new WeatherSatelliteCard(this,ready,true);image.addView(card,new FrameLayout.LayoutParams(-1,-1));if(old!=null)old.close();times=ready.times;index=Math.max(0,times.indexOf(ready.at));status.setText("MONITOR GLOBAL · "+selected.name+" · QUADRO "+(index+1)+"/"+Math.max(1,times.size())+" · "+InfraredPlan.timing(ready.at,System.currentTimeMillis())+(playing?" · DO MAIS ANTIGO AO MAIS RECENTE":" · MAIS RECENTE"));}else status.setText(frame==null?"Satélite indisponível agora. Use Atualizar para tentar novamente.":"Quadro indisponível · mantendo a imagem com o horário indicado");if(playing&&active)main.postDelayed(step,2500);});});
 }
 @Override protected void onStop(){active=false;generation++;busy=false;playing=false;main.removeCallbacksAndMessages(null);if(client!=null)client.close();if(radar!=null)radar.close();if(worker!=null)worker.shutdownNow();clearDisplayed();times.clear();super.onStop();}
 static int nextFrameIndex(int current,int count){return count<=0?0:(current+1)%count;}
 private Button button(LinearLayout row,String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(16);b.setTextColor(Color.WHITE);b.setOnClickListener(v->action.run());b.setOnFocusChangeListener((v,on)->{GradientDrawable bg=new GradientDrawable();bg.setColor(0xff163244);bg.setCornerRadius(dp(6));bg.setStroke(dp(on?3:1),on?WeatherCardView.CYAN:0xff426278);b.setBackground(bg);});LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1);p.setMargins(dp(3),dp(8),dp(3),0);row.addView(b,p);controls.add(b);return b;}
 private int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
}
