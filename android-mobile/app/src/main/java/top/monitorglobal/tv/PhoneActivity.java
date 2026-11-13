package top.monitorglobal.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.*;
import android.text.TextUtils;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;

/** First phone client: touch navigation and foreground-only updates. */
public class PhoneActivity extends Activity {
 static final int BACK=0xff04121e,BODY=0xff0b2635,CYAN=0xff24d9ed,TEXT=0xfff0f8ff,MUTED=0xffa6c3d3,AMBER=0xffffc04d;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final List<Bitmap> flagImages=new ArrayList<>();private final List<ImageView> flagViews=new ArrayList<>();
 private final LinkedHashMap<String,Integer> scrollPositions=new LinkedHashMap<>(16,.75f,true);private ScrollView visibleScroll;private String displayedRoute="";
 private LinearLayout root,header,navigation;private FrameLayout content;private TextView status;
 private Typeface brand;private PhoneRepository repository;private PhoneRepository.Snapshot snapshot;
 private WeatherBriefingClient briefing;private PhoneMapView map,rainMap,brazilMap;private PhoneUpdater updater;private ExecutorService worker;private SharedPreferences cache;
 private String tab="home",returnTab="home",mapFilter="all",noticeFilter="all",mapReturnTab="weather";private Alert selected;
 private boolean active,destroyed,refreshing,satelliteRequested,detailLoading,dailyExpanded;private long nextDetailAttempt,nextDailyAttempt;private int generation;
 private final Runnable pulse=new Runnable(){public void run(){if(!active||destroyed)return;refresh(false);main.postDelayed(this,60000);}};

 protected PhoneRepository createRepository(){return new PhoneRepository();}
 protected boolean automaticRefresh(){return true;}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);if(automaticRefresh())briefing=new WeatherBriefingClient(this,()->{if(active&&!destroyed)render();});brand=loadBrand();cache=getSharedPreferences("monitor-phone",MODE_PRIVATE);repository=createRepository();
  try{repository.importCache(cache.getString("snapshot",""),System.currentTimeMillis());}catch(RuntimeException ignored){}
  snapshot=repository.snapshot(System.currentTimeMillis());
  if(saved!=null){tab=saved.getString("tab","home");returnTab=saved.getString("returnTab","home");mapFilter=saved.getString("mapFilter","all");noticeFilter=saved.getString("noticeFilter","all");mapReturnTab=saved.getString("mapReturnTab","weather");ArrayList<String> keys=saved.getStringArrayList("scrollKeys");ArrayList<Integer> positions=saved.getIntegerArrayList("scrollPositions");if(keys!=null&&positions!=null)for(int i=0;i<Math.min(64,Math.min(keys.size(),positions.size()));i++)scrollPositions.put(keys.get(i),Math.max(0,positions.get(i)));try{String record=saved.getString("selected","");if(!record.isEmpty())selected=AlertCodec.read(new org.json.JSONObject(record));}catch(org.json.JSONException ignored){}}
  getWindow().setStatusBarColor(BACK);getWindow().setNavigationBarColor(BACK);getWindow().getDecorView().setSystemUiVisibility(0);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BACK);
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(14),dp(7),dp(8),dp(7));header.setBackgroundColor(BODY);root.addView(header,new LinearLayout.LayoutParams(-1,dp(60)));
  header.addView(new PhoneIcons(this,PhoneIcons.RADAR,CYAN),new LinearLayout.LayoutParams(dp(26),dp(26)));
  TextView title=text("MONITOR GLOBAL",20,TEXT,1);LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(0,-2,1);titleParams.setMarginStart(dp(8));header.addView(title,titleParams);
  FrameLayout bell=new FrameLayout(this);bell.setContentDescription("Abrir avisos e notificações");bell.setBackground(ripple(BODY));bell.addView(new PhoneIcons(this,PhoneIcons.BELL,CYAN),new FrameLayout.LayoutParams(dp(22),dp(22),Gravity.CENTER));header.addView(bell,new LinearLayout.LayoutParams(dp(48),dp(48)));bell.setOnClickListener(v->{selected=null;tab="notices";render();});
  FrameLayout reload=new FrameLayout(this);reload.setTag("refresh");reload.setContentDescription("Atualizar dados");reload.setBackground(ripple(BODY));PhoneIcons refreshIcon=new PhoneIcons(this,PhoneIcons.REFRESH,CYAN);FrameLayout.LayoutParams iconParams=new FrameLayout.LayoutParams(dp(24),dp(24),Gravity.CENTER);reload.addView(refreshIcon,iconParams);header.addView(reload,new LinearLayout.LayoutParams(dp(48),dp(48)));reload.setOnClickListener(v->refresh(true));
  status=text("Aguardando consulta",12,MUTED,3);status.setPadding(dp(14),dp(6),dp(14),dp(6));root.addView(status,new LinearLayout.LayoutParams(-1,-2));
  content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  navigation=new LinearLayout(this);navigation.setGravity(Gravity.CENTER);navigation.setBackgroundColor(BODY);root.addView(navigation,new LinearLayout.LayoutParams(-1,dp(66)));
  readPush(getIntent());setContentView(root);updater=new PhoneUpdater(this);render();
 }
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPush(intent);render();}
 private void readPush(Intent intent){String route=intent.getStringExtra(PhonePush.ROUTE);intent.removeExtra(PhonePush.ROUTE);if("rain".equals(route)||"weather".equals(route)||"daily".equals(route)){selected=null;tab=route.equals("daily")?"notices":"weather";returnTab=tab;dailyExpanded=route.equals("daily");}String raw=intent.getStringExtra(PhonePush.EXTRA);intent.removeExtra(PhonePush.EXTRA);if(raw==null||raw.length()>3000)return;try{selected=AlertCodec.read(new org.json.JSONObject(raw));tab="notices";returnTab="notices";}catch(org.json.JSONException ignored){}}
 private void activatePush(){if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},77);return;}PhonePush.enable(this,()->{if(!destroyed)render();});}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==77){if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)PhonePush.enable(this,()->{if(!destroyed)render();});else{PhonePush.disable(this);render();}}}
 private Typeface loadBrand(){try{return Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf");}catch(RuntimeException ignored){return Typeface.DEFAULT_BOLD;}}
 @Override protected void onResume(){super.onResume();if(updater!=null)updater.resume();}
 @Override protected void onStart(){super.onStart();active=true;generation++;if(map!=null&&selected==null&&tab.equals("map"))map.resume();if(rainMap!=null&&selected==null&&tab.equals("rain"))rainMap.resume();if(brazilMap!=null&&selected==null&&tab.equals("brazil"))brazilMap.resume();if(automaticRefresh())main.post(pulse);}
 @Override protected void onStop(){rememberScroll();active=false;generation++;refreshing=false;detailLoading=false;nextDetailAttempt=nextDailyAttempt=0;main.removeCallbacks(pulse);if(repository!=null)repository.cancel();if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(brazilMap!=null)brazilMap.pause();if(briefing!=null)briefing.pause();super.onStop();}
 @Override protected void onDestroy(){destroyed=true;active=false;if(updater!=null)updater.close();if(briefing!=null)briefing.close();generation++;main.removeCallbacksAndMessages(null);if(repository!=null)repository.close();if(worker!=null)worker.shutdownNow();if(map!=null){map.close();map=null;}if(rainMap!=null){rainMap.close();rainMap=null;}if(brazilMap!=null){brazilMap.close();brazilMap=null;}clearFlags();super.onDestroy();}
 @Override protected void onSaveInstanceState(Bundle out){rememberScroll();out.putString("tab",tab);out.putString("returnTab",returnTab);out.putString("mapFilter",mapFilter);out.putString("noticeFilter",noticeFilter);out.putString("mapReturnTab",mapReturnTab);out.putStringArrayList("scrollKeys",new ArrayList<>(scrollPositions.keySet()));out.putIntegerArrayList("scrollPositions",new ArrayList<>(scrollPositions.values()));if(selected!=null)try{out.putString("selected",AlertCodec.write(selected).toString());}catch(org.json.JSONException ignored){}super.onSaveInstanceState(out);}
 private void refresh(boolean force){
  if(!active||destroyed||refreshing)return;refreshing=true;status.setText("Atualizando dados…");final int token=generation;
  if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{
   try{PhoneRepository.Snapshot next=force?repository.refresh(System.currentTimeMillis(),true):repository.refresh(System.currentTimeMillis());String raw=repository.exportCache();main.post(()->{if(!active||destroyed||generation!=token)return;refreshing=false;if(force)nextDetailAttempt=0;cache.edit().putString("snapshot",raw).apply();applySnapshot(next);});}
   catch(RuntimeException e){main.post(()->{if(!active||destroyed||generation!=token)return;refreshing=false;applySnapshot(repository.snapshot(System.currentTimeMillis()));status.setText("Não foi possível atualizar agora. Tente novamente.");});}
  });
 }
 void applySnapshot(PhoneRepository.Snapshot next){snapshot=next;if(briefing!=null&&active){briefing.prefetch("hourly",next.weather,null);}if(selected!=null)for(Alert latest:next.events)if(latest.id.equals(selected.id)){selected=latest.copy();break;}render();}
 private void rememberScroll(){if(visibleScroll==null||displayedRoute.isEmpty())return;scrollPositions.put(displayedRoute,visibleScroll.getScrollY());while(scrollPositions.size()>64)scrollPositions.remove(scrollPositions.keySet().iterator().next());}
 private void render(){
  if(content==null||destroyed)return;rememberScroll();visibleScroll=null;displayedRoute=selected==null?"tab:"+tab:"event:"+selected.id;if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(brazilMap!=null)brazilMap.pause();content.removeAllViews();clearFlags();updateStatus();renderNavigation();
  if(selected!=null){LinearLayout page=page();eventPage(page,selected);return;}
  if(tab.equals("map")){mapPage();return;}
  if(tab.equals("rain")){rainPage();return;}
  if(tab.equals("brazil")){brazilPage();return;}
  LinearLayout page=page();if(tab.equals("weather"))weatherPage(page);else if(tab.equals("notices"))noticesPage(page);else homePage(page);
 }
 private void updateStatus(){status.setVisibility(selected==null&&(tab.equals("rain")||tab.equals("brazil"))?View.GONE:View.VISIBLE);if(snapshot==null){status.setText("Aguardando consulta");return;}String time=snapshot.refreshedAt>0?" · "+BrDates.dateTime(snapshot.refreshedAt):"";status.setText(snapshot.feedStatus+time);}
 private void renderNavigation(){
  navigation.removeAllViews();String shown=selected==null?((tab.equals("rain")||tab.equals("brazil"))?mapReturnTab:tab):returnTab;String[] ids={"home","map","weather","notices"},labels={"Início","Mapa","Tempo","Avisos"};int[] icons={PhoneIcons.HOME,PhoneIcons.MAP,PhoneIcons.CLOUD,PhoneIcons.BELL};
  for(int i=0;i<ids.length;i++){final String target=ids[i];boolean current=target.equals(shown);int color=current?CYAN:MUTED;LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setGravity(Gravity.CENTER);item.setMinimumHeight(dp(56));item.setTag("tab-"+target);item.setContentDescription(labels[i]);item.setSelected(current);item.setBackground(ripple(current?0xff143c4d:BODY));item.addView(new PhoneIcons(this,icons[i],color),new LinearLayout.LayoutParams(dp(23),dp(23)));TextView label=text(labels[i],14,color,1);label.setGravity(Gravity.CENTER);item.addView(label,new LinearLayout.LayoutParams(-1,-2));navigation.addView(item,new LinearLayout.LayoutParams(0,-1,1));item.setOnClickListener(v->{selected=null;tab=target;render();});}
 }
 private LinearLayout page(){ScrollView scroll=new ScrollView(this);visibleScroll=scroll;scroll.setFillViewport(false);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(16),dp(12),dp(16),dp(20));scroll.addView(page,new ScrollView.LayoutParams(-1,-2));content.addView(scroll,new FrameLayout.LayoutParams(-1,-1));final int restored=scrollPositions.getOrDefault(displayedRoute,0);scroll.addOnLayoutChangeListener(new View.OnLayoutChangeListener(){public void onLayoutChange(View v,int l,int t,int r,int b,int ol,int ot,int or,int ob){if(scroll.getHeight()<=0)return;scroll.removeOnLayoutChangeListener(this);scroll.post(()->{if(visibleScroll==scroll)scroll.scrollTo(0,restored);});}});return page;}
 private void heading(LinearLayout page,String title){TextView t=text(title,27,TEXT,3);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(t,p);}
 private void copy(LinearLayout page,String value){TextView t=text(value,15,MUTED,60);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(t,p);}
 private android.graphics.drawable.Drawable glass(){GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff123b4e,0xff0a2231,0xff0b2938});g.setCornerRadius(dp(18));g.setStroke(dp(1),0xff245266);return g;}
 private LinearLayout card(LinearLayout page,String caption){Panel panel=new Panel(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackground(glass());LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(16);page.addView(panel,lp);TextView h=text(caption,13,CYAN,3);h.setLetterSpacing(.06f);h.setPadding(dp(16),dp(16),dp(16),0);panel.addView(h,new LinearLayout.LayoutParams(-1,-2));return panel;}
 private LinearLayout section(LinearLayout card){LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(16),dp(12),dp(16),dp(16));card.addView(body,new LinearLayout.LayoutParams(-1,-2));return body;}
 private void footer(LinearLayout card,String value){TextView t=text(value,13,MUTED,10);t.setBackgroundColor(0x25000000);t.setPadding(dp(16),dp(10),dp(16),dp(12));card.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 private void homePage(LinearLayout page){
  heading(page,"Seu monitor, em um só lugar");weatherCard(page,false);rainCard(page,false);
  heading(page,"Últimos eventos");copy(page,"M6+ globais, Brasil e áreas monitoradas. A lista depende da cobertura das fontes.");eventList(page,3);Button more=button("Ver avisos e fontes",()->{tab="notices";render();});page.addView(more,new LinearLayout.LayoutParams(-1,-2));
 }
 private void weatherPage(LinearLayout page){requestDetails(false);heading(page,"Tempo na Liberdade");weatherCard(page,true);rainCard(page,true);hourlyCard(page);Button explore=button("Explorar mapa de chuva · prévia",()->openLayer("rain","weather"));explore.setTag("open-rain");page.addView(explore,new LinearLayout.LayoutParams(-1,-2));Button brazil=button("Explorar meteorologia do Brasil · prévia",()->openLayer("brazil","weather"));brazil.setTag("open-brazil");space(page,brazil,8);copy(page,"Previsão para um ponto da Liberdade, São Paulo. No mapa, consulte outros municípios e as fontes de cada camada.");}
 private void requestDetails(boolean daily){requestDetails(daily,false);}
 private void requestDetails(boolean daily,boolean force){
  if(!automaticRefresh()||!active||destroyed||detailLoading||(!force&&System.currentTimeMillis()<(daily?nextDailyAttempt:nextDetailAttempt)))return;detailLoading=true;if(daily)nextDailyAttempt=System.currentTimeMillis()+300000;else nextDetailAttempt=System.currentTimeMillis()+300000;int token=generation;if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{PhoneRepository.Snapshot next=repository.details(System.currentTimeMillis(),daily,force);main.post(()->{if(!active||destroyed||generation!=token)return;detailLoading=false;cache.edit().putString("snapshot",repository.exportCache()).apply();snapshot=next;render();});});
 }
 private void hourlyCard(LinearLayout page){
  if(snapshot==null||snapshot.hours.isEmpty()){LinearLayout card=card(page,"PREVISÃO POR HORA"),body=section(card);body.addView(text(detailLoading?"Consultando os próximos horários…":"Não foi possível carregar os próximos horários",16,MUTED,3));space(body,text("Isso não significa ausência de chuva. A estimativa por minuto está no quadro acima.",14,MUTED,4),7);Button retry=button("Consultar próximas horas",()->{requestDetails(false,true);render();});retry.setTag("retry-hourly");retry.setEnabled(!detailLoading);space(body,retry,8);return;}
  LinearLayout card=card(page,"PRÓXIMAS HORAS · MODELO HORÁRIO"),body=section(card);HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);LinearLayout row=new LinearLayout(this);scroller.addView(row,new HorizontalScrollView.LayoutParams(-2,-2));body.addView(scroller,new LinearLayout.LayoutParams(-1,-2));
  for(PhoneHourly.Hour h:snapshot.hours){if(h.start<System.currentTimeMillis())continue;LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setGravity(Gravity.CENTER);cell.setPadding(dp(8),0,dp(8),0);row.addView(cell,new LinearLayout.LayoutParams(dp(98),-2));String from=WeatherForecast.time(h.start).replace(" BRT",""),to=WeatherForecast.time(h.start+3600000).replace(" BRT","");cell.addView(text(from+"–"+to,13,MUTED,2));cell.addView(new PhoneIcons(this,PhoneIcons.condition(h.condition),TEXT),new LinearLayout.LayoutParams(dp(30),dp(38)));cell.addView(text(Math.round(h.temperature)+"°C",22,TEXT,1));cell.addView(text(RainForecast.number(h.amount)+" mm/1h",12,CYAN,1));}
  footer(card,"Rainbow Weather · horários em Brasília. Cada coluna é o intervalo indicado, diferente dos próximos 60 minutos contados a partir de agora.");
 }
 private void weatherCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"TEMPO · LIBERDADE, SP"),body=section(card);WeatherForecast.Summary w=snapshot==null?null:snapshot.weather;
  if(w==null){String state=snapshot==null?"Aguardando consulta":snapshot.weatherStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando previsão horária…":"Previsão horária indisponível",22,TEXT,4));footer(card,state);return;}
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LinearLayout.LayoutParams(-1,-2));
  PhoneWeatherArt art=new PhoneWeatherArt(this,PhoneWeatherReading.illustration(w,snapshot==null?null:snapshot.rain));hero.addView(art,new LinearLayout.LayoutParams(0,dp(126),1));
  LinearLayout readings=new LinearLayout(this);readings.setOrientation(LinearLayout.VERTICAL);hero.addView(readings,new LinearLayout.LayoutParams(0,-2,1));readings.addView(text(w.temperatureValue,48,TEXT,2));space(readings,text(PhoneWeatherReading.condition(w,snapshot==null?null:snapshot.rain),19,TEXT,4),3);space(readings,text(PhoneWeatherReading.caption(w,snapshot==null?null:snapshot.rain),12,MUTED,3),4);space(readings,text("Sensação "+w.feelsValue,15,MUTED,3),5);
  LinearLayout metrics=metricRow(body);metric(metrics,PhoneIcons.DROP,w.humidityValue,"Umidade");metric(metrics,PhoneIcons.WIND,w.windValue,"Vento");metric(metrics,PhoneIcons.WIND,w.gustValue,"Rajadas");
  String provenance="Rainbow Weather · Modelo horário\n"+w.timing;
  if(detail)briefingCard(body,"hourly",w,snapshot==null?null:snapshot.rain);
  if(detail)provenance+="\nEstimativa para um ponto da Liberdade · sujeita a mudanças";footer(card,provenance);
 }
 private void rainCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"CHUVA · LIBERDADE, SP"),body=section(card);RainForecast.Summary r=snapshot==null?null:snapshot.rain;
  if(r==null){String state=snapshot==null?"Aguardando consulta":snapshot.rainStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando chuva por minuto…":"Chuva por minuto: indisponível",22,TEXT,4));footer(card,state);return;}
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LinearLayout.LayoutParams(-1,-2));hero.addView(new PhoneIcons(this,r.title.startsWith("Neve")?PhoneIcons.SNOW:r.state.equals("dry")?PhoneIcons.CLOUD:PhoneIcons.RAIN,TEXT),new LinearLayout.LayoutParams(dp(36),dp(36)));TextView title=text(r.title,25,TEXT,4);LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(0,-2,1);hp.setMarginStart(dp(10));hero.addView(title,hp);
  PhoneRainChart.Series series=snapshot==null?null:snapshot.rainSeries;LinearLayout totals=metricRow(body);if(series!=null)metric(totals,PhoneIcons.DROP,RainForecast.number(series.accumulated(30))+" mm","Previsto · próximos 30 min");metric(totals,PhoneIcons.DROP,RainForecast.number(series==null?r.amount:series.accumulated(60))+" mm","Previsto · próximos 60 min");
  space(body,text("Agora: "+(r.rate>0&&r.rate<.1?"<0,1 mm/h estimados":r.rateText),15,TEXT,3),12);
  if(!r.state.equals("dry")){if(r.durationMinutes>0)space(body,text(r.durationLabel+": ~"+r.durationMinutes+" min",16,MUTED,3),7);else space(body,text("Duração ainda indefinida",16,MUTED,3),7);if(detail){space(body,text(r.forecastRateText,16,MUTED,3),6);if(series!=null&&Double.isFinite(series.peakRate))space(body,text("Maior intensidade nos próximos 60 min: "+RainForecast.number(series.peakRate)+" mm/h",16,MUTED,3),5);space(body,text(r.stopText,16,MUTED,4),5);}}
  if(series!=null){if(detail)space(body,text(series.distribution(),16,TEXT,4),10);PhoneRainChart chart=new PhoneRainChart(this,series);LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(112));cp.topMargin=dp(14);body.addView(chart,cp);space(body,text("Volume por 5 min · mesma previsão dos acumulados acima",12,MUTED,3),4);}
  String timing=series==null?"":"\n"+series.timing();footer(card,"Rainbow Weather · chuva consultada "+WeatherForecast.time(r.at)+timing+(detail?"\nmm: volume acumulado · mm/h: intensidade. Estimativa para um ponto da Liberdade, sujeita a mudanças.":""));
 }
 private void briefingCard(LinearLayout page,String kind,WeatherForecast.Summary w,RainForecast.Summary r){
  if(!kind.equals("hourly"))return;String value=PhoneWeatherReading.complementaryAi(WeatherBriefingClient.text(this,kind,w,r),w,r);if(value.isEmpty())return;
  space(page,text("RESUMO COM IA · CONTEXTO DO MODELO HORÁRIO",12,CYAN,3),10);space(page,text(value,17,TEXT,8),4);
 }

 private LinearLayout metricRow(LinearLayout body){LinearLayout row=new LinearLayout(this);row.setBaselineAligned(false);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=dp(14);body.addView(row,rp);return row;}
 private void metric(LinearLayout row,int kind,String value,String caption){LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setPadding(0,0,dp(6),0);row.addView(cell,new LinearLayout.LayoutParams(0,-2,1));cell.addView(new PhoneIcons(this,kind,MUTED),new LinearLayout.LayoutParams(dp(20),dp(20)));cell.addView(text(value,20,TEXT,3),new LinearLayout.LayoutParams(-1,-2));cell.addView(text(caption,13,MUTED,4),new LinearLayout.LayoutParams(-1,-2));}
 private List<Alert> events(){List<Alert> out=new ArrayList<>();if(snapshot!=null)out.addAll(snapshot.events);out.sort((a,b)->Long.compare(eventTime(b),eventTime(a)));return out;}
 private static long eventTime(Alert a){return a.kind.equals("tsunami")?a.issuedAt:a.eventTime;}
 private void eventList(LinearLayout page,int maximum){List<Alert> events=events();if(events.isEmpty()){copy(page,snapshot==null||snapshot.feedStatus.startsWith("Aguardando")?"Aguardando consulta dos eventos.":"Nenhum evento disponível nesta consulta. Confira as fontes e tente atualizar.");return;}for(int i=0;i<Math.min(maximum,events.size());i++)eventCard(page,events.get(i));if(events.size()>maximum)copy(page,"Mostrando "+maximum+" de "+events.size()+" eventos da consulta.");}
 private void eventCard(LinearLayout page,Alert a){
  Panel card=new Panel(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(16),dp(16),dp(16),dp(16));card.setBackground(glass());card.setTag("event-"+a.id);card.setContentDescription(a.title+". "+source(a)+". Abrir detalhes");LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(card,p);
  LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);card.addView(row,new LinearLayout.LayoutParams(-1,-2));if(a.kind.equals("earthquake")){TextView magnitude=text(magnitude(a),30,AMBER,1);LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-2,-2);mp.setMarginEnd(dp(10));row.addView(magnitude,mp);addFlag(row,a,30);}
  TextView location=text(a.kind.equals("earthquake")?location(a):tsunamiState(a.state),21,TEXT,4);row.addView(location,new LinearLayout.LayoutParams(0,-2,1));space(card,text(a.kind.equals("earthquake")?depth(a):a.title,15,MUTED,4),7);space(card,text(BrDates.dateTime(eventTime(a)),13,MUTED,3),4);space(card,text(source(a),13,MUTED,3),3);card.setOnClickListener(v->showEvent(a));
 }
 private void addFlag(LinearLayout row,Alert a,int size){Bitmap flag=CountryFlag.load(this,a);if(flag==null)return;flagImages.add(flag);ImageView image=new ImageView(this);image.setImageBitmap(flag);flagViews.add(image);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(dp(size),dp(size));fp.setMarginEnd(dp(9));row.addView(image,fp);}
 private void clearFlags(){for(ImageView image:flagViews)image.setImageDrawable(null);flagViews.clear();for(Bitmap b:flagImages)if(!b.isRecycled())b.recycle();flagImages.clear();}
 private void showEvent(Alert a){if(destroyed)return;returnTab=tab;selected=a.copy();render();}
 private void eventPage(LinearLayout page,Alert a){
  page.addView(button("‹ Voltar",()->{selected=null;tab=returnTab;render();}),new LinearLayout.LayoutParams(-1,-2));heading(page,"Detalhes do evento");
  if(a.kind.equals("earthquake")){TextView mag=text(magnitude(a),54,AMBER,1);space(page,mag,6);LinearLayout locationRow=new LinearLayout(this);locationRow.setGravity(Gravity.CENTER_VERTICAL);addFlag(locationRow,a,42);locationRow.addView(text(location(a),28,TEXT,5),new LinearLayout.LayoutParams(0,-2,1));space(page,locationRow,6);}
  else{heading(page,tsunamiState(a.state));copy(page,a.title);}
  LinearLayout info=card(page,a.kind.equals("earthquake")?"REGISTRO SÍSMICO":"BOLETIM OFICIAL");LinearLayout body=section(info);if(a.kind.equals("earthquake"))detail(body,PhoneIcons.DEPTH,depth(a));detail(body,PhoneIcons.CLOCK,BrDates.dateTime(eventTime(a)));space(body,text(source(a),17,TEXT,5),8);if(!a.detail.isEmpty())space(body,text(a.detail,16,MUTED,60),8);footer(info,a.kind.equals("earthquake")?"Danos: sem informação":"Consulte o boletim e siga as orientações das autoridades locais.");
  if(!a.revision.isEmpty())copy(page,"Atualização: "+a.revision);
  if(!a.tsunamiSummary.isEmpty())copy(page,"Boletim de tsunami: "+a.tsunamiSummary);
  if(!a.populationSummary.isEmpty())copy(page,a.populationSummary);if(!a.nearbySummary.isEmpty())copy(page,a.nearbySummary);
  if(a.kind.equals("earthquake")){
   LinearLayout science=card(page,"ANÁLISE SÍSMICA · FONTE VERIFICADA");
   LinearLayout analysisBody=section(science);
   TextView response=text("Toque para examinar magnitude, profundidade, intensidade, boletins e limites científicos. A IA não envia alertas nem prevê terremotos.",16,MUTED,16);
   analysisBody.addView(response,new LinearLayout.LayoutParams(-1,-2));
   analysisBody.addView(button("Entenda este sismo · análise aprofundada",()->scientificExplain(a,response)),new LinearLayout.LayoutParams(-1,-2));
   footer(science,"Consulta opcional. Sempre compare com as autoridades e relatórios originais.");
  }
  Button mapButton=button("Ver localização no mapa",()->{tab="map";selected=null;showMapEvent(a);});mapButton.setEnabled(MapFrame.located(a.originLongitude,a.originLatitude));page.addView(mapButton,new LinearLayout.LayoutParams(-1,-2));if(!mapButton.isEnabled())copy(page,"Localização no mapa indisponível para este registro.");
  space(page,button("Compartilhar evento",()->share(a)),10);
 }

 private void scientificExplain(Alert a,TextView target){
  if(a==null||!a.kind.equals("earthquake")||a.id==null||a.id.isEmpty())return;
  final int token=generation;final String eventId=a.id;
  target.setText("Consultando apenas eventos identificados no feed. Não são emitidos novos alertas…");
  if(worker==null)worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{
   String output="Análise indisponível; o catálogo sísmico continua funcionando normalmente.";
   try{
    for(int attempt=0;attempt<6;attempt++){
     org.json.JSONObject data=scientificResponse(eventId);
     output=scientificText(data);
     if(!"pending".equals(data.optString("status")))break;
     Thread.sleep(2600);
    }
   }catch(InterruptedException e){Thread.currentThread().interrupt();return;}
    catch(Exception ignored){/* Never expose raw provider errors or keys. */}
   final String message=output;
   main.post(()->{
    if(!destroyed&&active&&generation==token&&selected!=null&&eventId.equals(selected.id)&&target.isAttachedToWindow())
     target.setText(message);
   });
  });
 }
 private static org.json.JSONObject scientificResponse(String id)throws Exception{
  java.net.HttpURLConnection con=(java.net.HttpURLConnection)new java.net.URL(
   "https://black-sky-9ba0.terrestre.workers.dev/seismic-insight?id="+
   java.net.URLEncoder.encode(id,"UTF-8")).openConnection();
  con.setConnectTimeout(5000);con.setReadTimeout(10000);con.setInstanceFollowRedirects(false);
  con.setRequestProperty("Accept","application/json");
  try{
   if(con.getResponseCode()!=200)throw new java.io.IOException("scientific status");
   java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
   try(java.io.InputStream in=con.getInputStream()){
    byte[] buffer=new byte[1024];int n;
    while((n=in.read(buffer))!=-1){if(bytes.size()+n>9000)throw new java.io.IOException("oversized");bytes.write(buffer,0,n);}
   }
   return new org.json.JSONObject(bytes.toString("UTF-8"));
  }finally{con.disconnect();}
 }
 private static String scientificText(org.json.JSONObject data){
  if(!"seismic-insight-v1".equals(data.optString("version")))return "Resposta científica não reconhecida.";
  String state=data.optString("status");
  if("pending".equals(state))return "A análise está em preparação. Os alertas continuam independentes.";
  if(!"ready".equals(state))return "Análise não disponível para este evento no catálogo atualizado. Nenhum dado será inventado.";
  org.json.JSONArray rows=data.optJSONArray("sections");
  if(rows==null||rows.length()!=6)return "Análise incompleta: não será exibida.";
  String title=data.optString("title");
  if(title.length()>190)return "Título de evento inválido.";
  StringBuilder out=new StringBuilder(title).append("\nFonte: ").append(data.optString("source","Fonte não informada")).append("\n");
  String provider=data.optString("model");
  out.append(provider.equals("gemini-3.8-flash")?"Destaques selecionados pela Gemini.":provider.startsWith("@cf/")?"Destaques selecionados pela Cloudflare.":"Explicação por regras científicas verificáveis.").append("\n");
  for(int i=0;i<rows.length();i++){
   org.json.JSONObject item=rows.optJSONObject(i);
   if(item==null)return "Seção de análise inválida.";
   String heading=item.optString("title"),description=item.optString("text");
   if(heading.length()>70||description.length()>550||description.isEmpty()||
      description.contains("<")||description.contains(">"))return "Texto de análise fora dos limites.";
   out.append("\n").append(heading).append("\n").append(description).append("\n");
  }
  out.append("\nAnálise informativa: não substitui autoridades oficiais ou previsões de perigo.");
  return out.toString();
 }

 private void detail(LinearLayout parent,int kind,String value){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=dp(8);parent.addView(row,rp);row.addView(new PhoneIcons(this,kind,MUTED),new LinearLayout.LayoutParams(dp(24),dp(24)));TextView t=text(value,18,TEXT,5);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMarginStart(dp(10));row.addView(t,lp);}
 private void noticesPage(LinearLayout page){
  heading(page,"Avisos e fontes");pushSettings(page);noticeCards(page);copy(page,"Monitor Global · versão "+top.monitorglobal.mobile.BuildConfig.VERSION_NAME);page.addView(button("Verificar atualização do aplicativo",()->{if(updater!=null)updater.check();}),new LinearLayout.LayoutParams(-1,-2));copy(page,"Atualização pelo canal Android de testes · o instalador do Android confirma cada versão.");page.addView(button("Testar notificação neste aparelho",()->{boolean ok=PhonePush.testLocal(this);Toast.makeText(this,ok?"Teste local criado; isso não confirma entrega pelo Firebase.":"Ative a permissão de notificações do Android primeiro.",Toast.LENGTH_LONG).show();}),new LinearLayout.LayoutParams(-1,-2));if(top.monitorglobal.mobile.BuildConfig.DEBUG&&PhonePush.configured())page.addView(button("Copiar código para teste push",()->PhonePush.copyTestToken(this)),new LinearLayout.LayoutParams(-1,-2));copy(page,"Push depende da conexão e das permissões do Android. O aplicativo não garante entrega instantânea; forçar a parada pode impedir avisos até abri-lo novamente.");page.addView(button("Abrir canal oficial no Telegram",()->openUrl("https://t.me/monitor_global")),new LinearLayout.LayoutParams(-1,-2));
  LinearLayout sources=card(page,"COBERTURA DA CONSULTA"),body=section(sources);body.addView(text("M6+ globais, Brasil e áreas monitoradas",20,TEXT,4));space(body,text(snapshot==null?"Aguardando consulta":snapshot.feedStatus,15,MUTED,5),8);space(body,text(snapshot==null?"Meteorologia aguardando consulta":snapshot.weatherStatus,15,MUTED,5),5);space(body,text(snapshot==null?"Chuva aguardando consulta":snapshot.rainStatus,15,MUTED,5),5);footer(sources,"Ausência de dados não significa ausência de risco. Para orientações de proteção, acompanhe as autoridades responsáveis.");
  page.addView(button("Abrir Monitor Global no navegador",()->openUrl("https://monitorglobal.top/")),new LinearLayout.LayoutParams(-1,-2));
 }
 private void pushSettings(LinearLayout page){LinearLayout card=card(page,"NOTIFICAÇÕES NO CELULAR"),body=section(card);copy(body,PhonePush.status(this));body.addView(button("Ativar avisos no celular",this::activatePush),new LinearLayout.LayoutParams(-1,-2));if(PhonePush.enabled(this))space(body,button("Desativar notificações",()->{PhonePush.disable(this);render();}),8);String[] names={"Sismos · Brasil, M6+ e áreas monitoradas","Avisos de tsunami","Chuva · chegada, volume e duração","Boletins do tempo · de hora em hora","Resumo diário · dia anterior"};for(int i=0;i<PhonePush.CATEGORIES.length;i++){final String category=PhonePush.CATEGORIES[i];android.widget.Switch toggle=new android.widget.Switch(this);toggle.setText(names[i]);toggle.setTextSize(16);toggle.setTextColor(TEXT);toggle.setTypeface(brand);toggle.setPadding(0,dp(8),0,dp(8));toggle.setMinimumHeight(dp(52));toggle.setChecked(PhonePush.categoryEnabled(this,category));toggle.setTag("push-category-"+category);toggle.setOnCheckedChangeListener((v,on)->PhonePush.setCategory(this,category,on,()->{if(!destroyed)render();}));body.addView(toggle,new LinearLayout.LayoutParams(-1,-2));}footer(card,"Chuva e tempo: ponto da Liberdade, São Paulo. Boletim horário, exceto à meia-noite; resumo diário após 00:05 BRT. Dados ausentes ou vencidos não geram previsão de tempo seco. A entrega depende do Firebase, da conexão e das permissões do Android.");}
 private void noticeCards(LinearLayout page){
  LinearLayout filters=new LinearLayout(this);filters.setTag("notice-filters");page.addView(filters,new LinearLayout.LayoutParams(-1,-2));String[] names={"Todos","Chuva","Sismos"},ids={"all","rain","earthquake"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{noticeFilter=id;render();});b.setTag("notice-filter-"+id);b.setTextColor(id.equals(noticeFilter)?CYAN:MUTED);b.setSelected(id.equals(noticeFilter));filters.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
  copy(page,"Previsões e eventos da consulta atual. As notificações recebidas são exibidas pelo Android.");
  if(!noticeFilter.equals("earthquake"))rainCard(page,false);
  if(!noticeFilter.equals("rain")){heading(page,"Eventos da consulta");List<Alert> shown=events();int count=0;for(Alert a:shown){if(noticeFilter.equals("earthquake")&&!a.kind.equals("earthquake"))continue;eventCard(page,a);if(++count>=40)break;}if(count==0)copy(page,"Nenhum evento disponível nesta consulta.");}
  Button summary=button(dailyExpanded?"Fechar resumo diário":"Ver resumo diário · dia anterior",()->{dailyExpanded=!dailyExpanded;if(dailyExpanded)requestDetails(true);render();});summary.setTag("daily-summary");space(page,summary,8);if(dailyExpanded){requestDetails(true);LinearLayout daily=card(page,"MAIORES SISMOS · DIA ANTERIOR"),body=section(daily);if(snapshot!=null&&snapshot.dailyAvailable){copy(body,"Dia "+snapshot.dailyDay+" · horário de Brasília");if(snapshot.daily.isEmpty())copy(body,"Nenhum registro disponível nas fontes para este período.");for(Alert a:snapshot.daily)eventCard(body,a);footer(daily,"Até cinco maiores eventos disponíveis nas fontes consultadas. Não é contagem de todos os sismos.");}else copy(body,detailLoading?"Consultando resumo diário…":"Resumo diário indisponível nesta consulta. Tente novamente mais tarde.");}
  heading(page,"Notificações e aplicativo");
 }
 private void openLayer(String target,String origin){mapReturnTab=origin;satelliteRequested=target.equals("brazil");tab=target;selected=null;render();}
 private void mapModes(LinearLayout box,String current){LinearLayout row=new LinearLayout(this);row.setPadding(dp(10),dp(8),dp(10),dp(8));String[] names={"Sismos","Satélite","Chuva"},ids={"map","brazil","rain"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{if(id.equals("map")){tab="map";render();}else openLayer(id,"map");});b.setTag("map-mode-"+id);b.setSelected(id.equals(current));b.setTextColor(id.equals(current)?CYAN:MUTED);row.addView(b,new LinearLayout.LayoutParams(0,-2,1));}box.addView(row,new LinearLayout.LayoutParams(-1,-2));}
 private void mapPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));mapModes(box,"map");TextView title=text("Mapa de eventos",25,TEXT,2);title.setPadding(dp(14),dp(10),dp(14),dp(8));box.addView(title,new LinearLayout.LayoutParams(-1,-2));LinearLayout filters=new LinearLayout(this);filters.setPadding(dp(10),0,dp(10),dp(8));box.addView(filters,new LinearLayout.LayoutParams(-1,-2));String[] names={"Todos","Sismos","Tsunami"},ids={"all","earthquake","tsunami"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{mapFilter=id;render();});b.setSelected(mapFilter.equals(id));b.setTextColor(mapFilter.equals(id)?CYAN:MUTED);filters.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
  if(map==null)map=new PhoneMapView(this,this::showEvent);if(map.getParent()!=null)((ViewGroup)map.getParent()).removeView(map);box.addView(map,new LinearLayout.LayoutParams(-1,0,1));List<Alert> visible=new ArrayList<>();for(Alert a:events())if(mapFilter.equals("all")||mapFilter.equals(a.kind))visible.add(a);map.setEvents(visible);if(active)map.resume();else map.pause();
 }
 private void rainPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));if(mapReturnTab.equals("map"))mapModes(box,"rain");Button back=button(mapReturnTab.equals("map")?"‹ Mapa de eventos":"‹ Tempo na Liberdade",()->{tab=mapReturnTab;render();});back.setTag("close-rain");box.addView(back,new LinearLayout.LayoutParams(-1,-2));
  if(snapshot!=null)briefingCard(box,"rain",snapshot.weather,snapshot.rain);
  if(rainMap==null)rainMap=new PhoneMapView(this,null,true);if(rainMap.getParent()!=null)((ViewGroup)rainMap.getParent()).removeView(rainMap);box.addView(rainMap,new LinearLayout.LayoutParams(-1,0,1));if(active)rainMap.resume();else rainMap.pause();
 }
 private void brazilPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));if(mapReturnTab.equals("map"))mapModes(box,"brazil");Button back=button(mapReturnTab.equals("map")?"‹ Mapa de eventos":"‹ Tempo na Liberdade",()->{tab=mapReturnTab;render();});back.setTag("close-brazil");box.addView(back,new LinearLayout.LayoutParams(-1,-2));
  if(brazilMap==null)brazilMap=new PhoneMapView(this,null,false,true);if(brazilMap.getParent()!=null)((ViewGroup)brazilMap.getParent()).removeView(brazilMap);box.addView(brazilMap,new LinearLayout.LayoutParams(-1,0,1));if(active)brazilMap.resume();else brazilMap.pause();if(satelliteRequested){satelliteRequested=false;brazilMap.showSatellite();}
 }
 private void showMapEvent(Alert a){tab="map";mapFilter="all";render();List<Alert> visible=events();if(visible.stream().noneMatch(v->v.id.equals(a.id)))visible.add(0,a);map.setEvents(visible);map.focus(a);}
 private void share(Alert a){String value=a.title+"\n"+(a.kind.equals("earthquake")?depth(a)+"\n":"")+BrDates.dateTime(eventTime(a))+"\n"+source(a)+"\nhttps://monitorglobal.top/";try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,value),"Compartilhar evento"));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Nenhum aplicativo disponível para compartilhar.",Toast.LENGTH_LONG).show();}}
 private void openUrl(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Não foi possível abrir o navegador.",Toast.LENGTH_LONG).show();}}
 @Override public void onBackPressed(){if(selected!=null){selected=null;tab=returnTab;render();}else if(tab.equals("rain")||tab.equals("brazil")){tab=mapReturnTab;render();}else if(!tab.equals("home")){tab="home";render();}else super.onBackPressed();}
 static String magnitude(Alert a){return Double.isFinite(a.magnitude)?String.format(Locale.forLanguageTag("pt-BR"),"M%.1f",a.magnitude):"M—";}
 static String location(Alert a){return a.title.replaceFirst("^M[0-9]+[,.][0-9]+\\s*·\\s*","");}
 static String depth(Alert a){return Double.isFinite(a.depth)&&a.depth>=0?String.format(Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km",a.depth):"Profundidade não informada";}
 static String source(Alert a){return a.source.isEmpty()?"Fonte não informada":"Fonte: "+a.source;}
 static String tsunamiState(String state){switch(state){case "noThreat":return "Sem ameaça segundo o boletim";case "warning":return "Aviso de tsunami";case "watch":return "Vigilância de tsunami";case "advisory":return "Atenção para tsunami";case "ended":return "Aviso de tsunami encerrado";case "information":return "Boletim informativo de tsunami";default:return "Situação de tsunami não confirmada";}}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private TextView text(String value,int size,int color,int maxLines){TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);v.setTypeface(brand);v.setMaxLines(maxLines);v.setEllipsize(TextUtils.TruncateAt.END);v.setIncludeFontPadding(false);return v;}
 private Button button(String value,Runnable action){Button b=new Button(this);b.setText(value);b.setAllCaps(false);b.setTextSize(16);b.setTypeface(brand);b.setTextColor(CYAN);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setPadding(dp(12),dp(8),dp(12),dp(8));b.setBackground(ripple(BODY));b.setOnClickListener(v->action.run());return b;}
 private android.graphics.drawable.Drawable ripple(int color){GradientDrawable shape=new GradientDrawable();shape.setColor(color);shape.setCornerRadius(dp(14));shape.setStroke(dp(1),0xff244a62);return new RippleDrawable(ColorStateList.valueOf(0x4038bdf8),shape,null);}
 private void space(LinearLayout parent,View child,int margin){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(margin);parent.addView(child,p);}
 private final class Panel extends LinearLayout {private final Path clip=new Path();Panel(android.content.Context c){super(c);}@Override protected void onSizeChanged(int w,int h,int ow,int oh){super.onSizeChanged(w,h,ow,oh);clip.reset();float r=dp(18);clip.addRoundRect(0,0,w,h,r,r,Path.Direction.CW);}@Override public void draw(Canvas c){int save=c.save();c.clipPath(clip);super.draw(c);c.restoreToCount(save);}}
}



