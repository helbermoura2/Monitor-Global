package top.monitorglobal.tv;
import android.app.Activity;import android.os.*;import android.graphics.Color;import android.graphics.drawable.GradientDrawable;import android.view.*;import android.widget.*;import java.util.*;import java.util.concurrent.*;
/** Remote-control viewer: two geographic scopes, explicit bounded playback, no idle work. */
public final class WeatherSatelliteActivity extends Activity {
 java.util.function.Function<android.content.Context,WeatherSatelliteClient> sourceFactory=WeatherSatelliteClient::new;
 private final Handler main=new Handler(Looper.getMainLooper());private ExecutorService worker;private WeatherSatelliteClient client;private WeatherSatelliteClient.Frame frame;private WeatherSatelliteCard card;private FrameLayout image;private TextView status;private RadarLegend radarLegend;private RadarMapClient.Frame displayedRadar;private final Runnable ageTick=new Runnable(){public void run(){if(active&&radarMode&&radarLegend!=null){radarLegend.update(displayedRadar,System.currentTimeMillis());updateRegional();main.postDelayed(this,30000);}}};private Button animation,exit,layer,previous,next,newest,region;private LinearLayout radarControls;private TextView regional,timelineLabel;private final RadarTimeline timeline=new RadarTimeline();private int regionIndex;private final Runnable radarStep=()->advanceRadar();private boolean radarMode;private RadarMapClient radar;private android.graphics.Bitmap radarBitmap;private final List<Button> controls=new ArrayList<>();private InfraredPlan.Scope scope=InfraredPlan.BRAZIL;private boolean active,busy,playing;private int generation,index;private List<Long> times=new ArrayList<>();private final Runnable step=()->load(false);
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setBackgroundColor(WeatherCardView.BODY);page.setPadding(dp(24),dp(12),dp(24),dp(12));status=new TextView(this);status.setTextSize(17);status.setTextColor(Color.WHITE);status.setPadding(0,0,0,dp(6));page.addView(status,new LinearLayout.LayoutParams(-1,-2));image=new FrameLayout(this);page.addView(image,new LinearLayout.LayoutParams(-1,0,1));radarLegend=new RadarLegend(this);radarLegend.setVisibility(View.GONE);page.addView(radarLegend,new LinearLayout.LayoutParams(-1,-2));regional=new TextView(this);regional.setTextColor(Color.WHITE);regional.setTextSize(13);regional.setMaxLines(2);regional.setVisibility(View.GONE);page.addView(regional,new LinearLayout.LayoutParams(-1,-2));timelineLabel=new TextView(this);timelineLabel.setTextSize(13);timelineLabel.setTextColor(Color.WHITE);timelineLabel.setVisibility(View.GONE);page.addView(timelineLabel,new LinearLayout.LayoutParams(-1,-2));radarControls=new LinearLayout(this);radarControls.setVisibility(View.GONE);page.addView(radarControls,new LinearLayout.LayoutParams(-1,-2));previous=button(radarControls,"Anterior",()->seek(-1));next=button(radarControls,"Próximo",()->seek(1));newest=button(radarControls,"Mais recente",()->seek(0));region=button(radarControls,"Região",()->chooseRegion());LinearLayout buttons=new LinearLayout(this);page.addView(buttons,new LinearLayout.LayoutParams(-1,-2));button(buttons,"Brasil",()->select(InfraredPlan.BRAZIL));button(buttons,"Sudeste",()->select(InfraredPlan.SOUTHEAST));layer=button(buttons,"Radar",()->switchLayer());animation=button(buttons,"Animar",()->{if(radarMode){toggleRadarPlayback();return;}playing=!playing;animation.setText(playing?"Pausar":"Animar");main.removeCallbacks(step);if(playing){index=-1;if(!busy)load(false);}});button(buttons,"Atualizar",()->{if(!busy){stopPlayback();times.clear();load(true);}});exit=button(buttons,"Voltar",this::finish);setContentView(page);}
 private void clearDisplayed(){
  displayedRadar=null;image.removeAllViews();if(card!=null){card.clear();card=null;}if(frame!=null){frame.close();frame=null;}
  if(radarBitmap!=null){radarBitmap.recycle();radarBitmap=null;}
 }
 private void switchLayer(){
  if(busy||!active)return;radarMode=!radarMode;playing=false;times.clear();main.removeCallbacks(step);
  stopPlayback();timeline.clear();animation.setEnabled(true);layer.setText(radarMode?"Satélite":"Radar");
  main.removeCallbacks(ageTick);showRadarControls();if(radarMode){scope=InfraredPlan.SOUTHEAST;radarLegend.update(null,System.currentTimeMillis());}
  clearDisplayed();load(true);
 }
 private void showRadarControls(){int visibility=radarMode?View.VISIBLE:View.GONE;radarLegend.setVisibility(visibility);regional.setVisibility(visibility);timelineLabel.setVisibility(visibility);radarControls.setVisibility(visibility);}
 private void loadRadar(boolean latest){
  busy=true;for(Button b:controls)b.setEnabled(b==exit||(b==animation&&playing));
  int token=generation;InfraredPlan.Scope selected=scope;RadarMapClient source=radar;WeatherSatelliteClient geography=client;
  status.setText("Radar observado · consultando INPE / DECEA");final long target=latest?0:timeline.current();
  worker.execute(()->{
   RadarMapClient.Frame result=null;android.graphics.Bitmap bitmap=null;List<Long> available=null;
   try{long now=System.currentTimeMillis();if(latest){available=source.times(now);result=source.latest(now);}else result=source.frame(target,now);bitmap=RadarMapRender.render(this,geography,selected,result);}catch(Exception|OutOfMemoryError ignored){}
   final RadarMapClient.Frame ready=result;final android.graphics.Bitmap drawn=bitmap;final List<Long> published=available;
   main.post(()->{
    if(!active||token!=generation){if(drawn!=null)drawn.recycle();return;}
    busy=false;for(Button b:controls)b.setEnabled(true);
    if(published!=null)timeline.set(published,System.currentTimeMillis());
    clearDisplayed();
    if(drawn==null||ready==null){if(drawn!=null)drawn.recycle();status.setText("Radar indisponível · cobertura piloto");radarLegend.update(null,System.currentTimeMillis());updateRegional();updateTimeline();stopPlayback();return;}
    long now=System.currentTimeMillis();radarBitmap=drawn;displayedRadar=ready;
    ImageView map=new ImageView(this);map.setImageBitmap(drawn);map.setScaleType(ImageView.ScaleType.FIT_CENTER);map.setContentDescription("Radar observado em dBZ, áreas cinza sem dado confirmado");image.addView(map,new FrameLayout.LayoutParams(-1,-1));
    timeline.select(ready.at);status.setText("RADAR OBSERVADO · "+selected.name+" · COBERTURA PILOTO SP/RJ");updateTimeline();main.removeCallbacks(ageTick);ageTick.run();if(playing){if(timeline.atEnd())stopPlayback();else main.postDelayed(radarStep,1800);}
   });
  });
 }
 private void updateRegional(){if(regional!=null)regional.setText(RadarRegion.describe(displayedRadar,RadarRegion.POINTS[regionIndex],System.currentTimeMillis()));}
 private void chooseRegion(){
  if(busy||!radarMode)return;stopPlayback();String[] names=new String[RadarRegion.POINTS.length];
  for(int i=0;i<names.length;i++)names[i]=RadarRegion.POINTS[i].name;
  new android.app.AlertDialog.Builder(this).setTitle("Consultar região · célula de radar").setSingleChoiceItems(names,regionIndex,(dialog,which)->{regionIndex=which;updateRegional();dialog.dismiss();}).setNegativeButton("Voltar",null).show();
 }
 private void updateTimeline(){
  int n=timeline.size();timelineLabel.setText(n==0?"Sem quadros publicados":"OBSERVAÇÃO · "+(timeline.index()+1)+"/"+n+" · "+InfraredPlan.timing(timeline.current(),System.currentTimeMillis()));
  previous.setEnabled(!busy&&timeline.index()>0);next.setEnabled(!busy&&n>0&&!timeline.atEnd());newest.setEnabled(!busy&&n>0);animation.setEnabled(!busy&&n>1);
 }
 private void stopPlayback(){playing=false;main.removeCallbacks(step);main.removeCallbacks(radarStep);if(animation!=null)animation.setText("Animar");}
 private void toggleRadarPlayback(){
  if(playing){stopPlayback();return;}
  if(busy||timeline.size()<2)return;
  playing=true;animation.setText("Pausar");timeline.oldest();loadRadar(false);
 }
 private void advanceRadar(){if(active&&radarMode&&playing&&!busy){if(timeline.atEnd()){stopPlayback();return;}timeline.next();loadRadar(false);}}
 private void seek(int direction){if(busy||!radarMode||timeline.size()==0)return;stopPlayback();if(direction<0)timeline.previous();else if(direction>0)timeline.next();else timeline.newest();loadRadar(false);}
 private void select(InfraredPlan.Scope next){if(busy)return;scope=next;times.clear();stopPlayback();load(true);}
 @Override protected void onStart(){super.onStart();active=true;showRadarControls();animation.setText("Animar");client=sourceFactory.apply(this);radar=new RadarMapClient();worker=Executors.newSingleThreadExecutor();load(true);}
 private void load(boolean latest){if(!active||busy)return;if(radarMode){loadRadar(latest);return;}busy=true;for(Button b:controls)b.setEnabled(b==exit);animation.setEnabled(true);int token=generation;InfraredPlan.Scope selected=scope;status.setText(frame==null?"Consultando satélite · "+scope.name:"Atualizando satélite · a imagem anterior permanece visível");WeatherSatelliteClient source=client;long target=0;if(!latest&&!times.isEmpty()){index=nextFrameIndex(index,times.size());target=times.get(index);}final long at=target;
  worker.execute(()->{WeatherSatelliteClient.Frame result=null;try{if(latest)source.available(System.currentTimeMillis(),true);result=at>0?source.frame(selected,at,System.currentTimeMillis()):source.latest(selected,System.currentTimeMillis());}catch(Exception|OutOfMemoryError ignored){}WeatherSatelliteClient.Frame ready=result;main.post(()->{if(!active||token!=generation){if(ready!=null)ready.close();return;}busy=false;for(Button b:controls)b.setEnabled(true);if(ready!=null){WeatherSatelliteCard previous=card;WeatherSatelliteClient.Frame old=frame;image.removeAllViews();if(previous!=null)previous.clear();frame=ready;card=new WeatherSatelliteCard(this,ready,true);image.addView(card,new FrameLayout.LayoutParams(-1,-1));if(old!=null)old.close();times=ready.times;index=Math.max(0,times.indexOf(ready.at));status.setText("MONITOR GLOBAL · "+selected.name+" · QUADRO "+(index+1)+"/"+Math.max(1,times.size())+" · "+InfraredPlan.timing(ready.at,System.currentTimeMillis())+(playing?" · DO MAIS ANTIGO AO MAIS RECENTE":" · MAIS RECENTE"));}else status.setText(frame==null?"Satélite indisponível agora. Use Atualizar para tentar novamente.":"Quadro indisponível · mantendo a imagem com o horário indicado");if(playing&&active)main.postDelayed(step,2500);});});
 }
 @Override protected void onStop(){active=false;generation++;busy=false;playing=false;main.removeCallbacksAndMessages(null);if(client!=null)client.close();if(radar!=null)radar.close();if(worker!=null)worker.shutdownNow();clearDisplayed();times.clear();timeline.clear();super.onStop();}
 static int nextFrameIndex(int current,int count){return count<=0?0:(current+1)%count;}
 private Button button(LinearLayout row,String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(16);b.setTextColor(Color.WHITE);b.setOnClickListener(v->action.run());b.setOnFocusChangeListener((v,on)->{GradientDrawable bg=new GradientDrawable();bg.setColor(0xff163244);bg.setCornerRadius(dp(6));bg.setStroke(dp(on?3:1),on?WeatherCardView.CYAN:0xff426278);b.setBackground(bg);});LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1);p.setMargins(dp(3),dp(8),dp(3),0);row.addView(b,p);controls.add(b);return b;}
 private int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
}
