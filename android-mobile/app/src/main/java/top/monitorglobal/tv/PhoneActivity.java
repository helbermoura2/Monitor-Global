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
 private LinearLayout root,header,navigation;private FrameLayout content;private TextView status;private String shownSection="";
 private SiteEventImage siteImage;
 private Typeface brand;private PhoneRepository repository;private PhoneRepository.Snapshot snapshot;
 private WeatherBriefingClient briefing;private PhoneMapView map,rainMap,brazilMap;private PhoneUpdater updater;private ExecutorService worker;private SharedPreferences cache;
 private String tab="home",returnTab="home",mapFilter="all",quakeRegion="all",settingsReturnTab="more",advancedReturnTab="more",mapReturnTab="sismos";private Alert selected,mappedEvent;
 private boolean active,destroyed,refreshing,satelliteRequested,focusMappedEvent,detailLoading,dailyExpanded,mapFiltersExpanded;private long nextDetailAttempt,nextDailyAttempt;private int generation;
 private final Runnable pulse=new Runnable(){public void run(){if(!active||destroyed)return;refresh(false);main.postDelayed(this,60000);}};

 protected PhoneRepository createRepository(){return new PhoneRepository();}
 protected boolean automaticRefresh(){return true;}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);if(automaticRefresh())briefing=new WeatherBriefingClient(this,()->{if(active&&!destroyed)render();});brand=loadBrand();cache=getSharedPreferences("monitor-phone",MODE_PRIVATE);repository=createRepository();
  try{repository.importCache(cache.getString("snapshot",""),System.currentTimeMillis());}catch(RuntimeException ignored){}
  snapshot=repository.snapshot(System.currentTimeMillis());
  if(saved!=null){tab=saved.getString("tab","home");returnTab=saved.getString("returnTab","home");mapFilter=saved.getString("mapFilter","all");quakeRegion=saved.getString("quakeRegion","all");settingsReturnTab=saved.getString("settingsReturnTab","more");advancedReturnTab=saved.getString("advancedReturnTab","more");mapReturnTab=saved.getString("mapReturnTab","sismos");if(mapReturnTab.equals("map"))mapReturnTab="sismos";ArrayList<String> keys=saved.getStringArrayList("scrollKeys");ArrayList<Integer> positions=saved.getIntegerArrayList("scrollPositions");if(keys!=null&&positions!=null)for(int i=0;i<Math.min(64,Math.min(keys.size(),positions.size()));i++)scrollPositions.put(keys.get(i),Math.max(0,positions.get(i)));try{String record=saved.getString("selected","");if(!record.isEmpty())selected=AlertCodec.read(new org.json.JSONObject(record));String mapped=saved.getString("mappedEvent","");if(!mapped.isEmpty()){mappedEvent=AlertCodec.read(new org.json.JSONObject(mapped));focusMappedEvent=true;}}catch(org.json.JSONException ignored){}}
  getWindow().setStatusBarColor(BACK);getWindow().setNavigationBarColor(BACK);getWindow().getDecorView().setSystemUiVisibility(0);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BACK);
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(10),dp(5),dp(7),dp(5));header.setBackgroundColor(BODY);root.addView(header,new LinearLayout.LayoutParams(-1,dp(64)));
  // Reuse the native TV mark: a blinking eye and a rotating pointer
  // over stationary radar rings. Animation pauses off-screen automatically.
  RadarLogoView officialLogo=new RadarLogoView(this);
  officialLogo.setTag("argos-logo");
  header.addView(officialLogo,new LinearLayout.LayoutParams(dp(50),dp(50)));
  LinearLayout brandTitles=new LinearLayout(this);brandTitles.setOrientation(LinearLayout.VERTICAL);
  brandTitles.setGravity(Gravity.CENTER_VERTICAL);
  LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(0,-2,1);titleParams.setMarginStart(dp(5));
  header.addView(brandTitles,titleParams);
  TextView title=text("ARGOS ORBIS",20,TEXT,1);title.setTypeface(brand);title.setLetterSpacing(.05f);brandTitles.addView(title);
  TextView brandLink=text("argosorbis.com.br",11,CYAN,1);brandTitles.addView(brandLink);
  FrameLayout bell=new FrameLayout(this);bell.setContentDescription("Abrir avisos e notificações");bell.setBackground(ripple(BODY));bell.addView(new PhoneIcons(this,PhoneIcons.BELL,CYAN),new FrameLayout.LayoutParams(dp(22),dp(22),Gravity.CENTER));header.addView(bell,new LinearLayout.LayoutParams(dp(48),dp(48)));bell.setOnClickListener(v->{selected=null;tab="notices";render();});
  FrameLayout reload=new FrameLayout(this);reload.setTag("refresh");reload.setContentDescription("Atualizar dados");reload.setBackground(ripple(BODY));PhoneIcons refreshIcon=new PhoneIcons(this,PhoneIcons.REFRESH,CYAN);FrameLayout.LayoutParams iconParams=new FrameLayout.LayoutParams(dp(24),dp(24),Gravity.CENTER);reload.addView(refreshIcon,iconParams);header.addView(reload,new LinearLayout.LayoutParams(dp(48),dp(48)));reload.setOnClickListener(v->refresh(true));
  status=text("Aguardando consulta",12,MUTED,3);status.setPadding(dp(12),dp(3),dp(12),dp(3));root.addView(status,new LinearLayout.LayoutParams(-1,-2));
  content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  navigation=new LinearLayout(this);navigation.setGravity(Gravity.CENTER);navigation.setBackgroundColor(BODY);navigation.setMinimumHeight(dp(60));root.addView(navigation,new LinearLayout.LayoutParams(-1,-2));
  readPush(getIntent());setContentView(root);updater=new PhoneUpdater(this);render();
 }
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPush(intent);render();}
 private void readPush(Intent intent){String route=intent.getStringExtra(PhonePush.ROUTE);intent.removeExtra(PhonePush.ROUTE);if("rain".equals(route)||"weather".equals(route)||"daily".equals(route)){selected=null;tab=route.equals("daily")?"history":"weather";returnTab=tab;dailyExpanded=route.equals("daily");}String raw=intent.getStringExtra(PhonePush.EXTRA);intent.removeExtra(PhonePush.EXTRA);if(raw==null||raw.length()>3000)return;try{selected=AlertCodec.read(new org.json.JSONObject(raw));tab="notices";returnTab="notices";}catch(org.json.JSONException ignored){}}
 private void activatePush(){if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},77);return;}PhonePush.enable(this,()->{if(!destroyed)render();});}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==77){if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)PhonePush.enable(this,()->{if(!destroyed)render();});else{PhonePush.disable(this);render();}}}
 private Typeface loadBrand(){try{return Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf");}catch(RuntimeException ignored){return Typeface.DEFAULT_BOLD;}}
 @Override protected void onResume(){super.onResume();if(updater!=null)updater.resume();}
 @Override protected void onStart(){super.onStart();active=true;generation++;if(map!=null&&selected==null&&tab.equals("map"))map.resume();if(rainMap!=null&&selected==null&&tab.equals("rain"))rainMap.resume();if(brazilMap!=null&&selected==null&&tab.equals("brazil"))brazilMap.resume();if(automaticRefresh())main.post(pulse);}
 @Override protected void onStop(){rememberScroll();if(siteImage!=null){siteImage.cancel();siteImage=null;}active=false;generation++;refreshing=false;detailLoading=false;nextDetailAttempt=nextDailyAttempt=0;main.removeCallbacks(pulse);if(repository!=null)repository.cancel();if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(brazilMap!=null)brazilMap.pause();if(briefing!=null)briefing.pause();super.onStop();}
 @Override protected void onDestroy(){destroyed=true;active=false;if(updater!=null)updater.close();if(briefing!=null)briefing.close();generation++;main.removeCallbacksAndMessages(null);if(repository!=null)repository.close();if(worker!=null)worker.shutdownNow();if(map!=null){map.close();map=null;}if(rainMap!=null){rainMap.close();rainMap=null;}if(brazilMap!=null){brazilMap.close();brazilMap=null;}clearFlags();super.onDestroy();}
 @Override protected void onSaveInstanceState(Bundle out){rememberScroll();out.putString("tab",tab);out.putString("returnTab",returnTab);out.putString("mapFilter",mapFilter);out.putString("quakeRegion",quakeRegion);out.putString("mapReturnTab",mapReturnTab);out.putString("settingsReturnTab",settingsReturnTab);out.putString("advancedReturnTab",advancedReturnTab);if(mappedEvent!=null)try{out.putString("mappedEvent",AlertCodec.write(mappedEvent).toString());}catch(org.json.JSONException ignored){}out.putStringArrayList("scrollKeys",new ArrayList<>(scrollPositions.keySet()));out.putIntegerArrayList("scrollPositions",new ArrayList<>(scrollPositions.values()));if(selected!=null)try{out.putString("selected",AlertCodec.write(selected).toString());}catch(org.json.JSONException ignored){}super.onSaveInstanceState(out);}
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
  if(content==null||destroyed)return;rememberScroll();visibleScroll=null;String previousRoute=displayedRoute;displayedRoute=selected==null?"tab:"+tab:"event:"+selected.id;if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(brazilMap!=null)brazilMap.pause();content.removeAllViews();clearFlags();updateStatus();renderNavigation();
  if(!previousRoute.isEmpty()&&!previousRoute.equals(displayedRoute)&&!tab.equals("map")&&!tab.equals("rain")&&!tab.equals("brazil")&&android.animation.ValueAnimator.areAnimatorsEnabled()){content.animate().cancel();content.setAlpha(.65f);content.animate().alpha(1f).setDuration(150).start();}
  if(selected!=null){LinearLayout page=page();eventPage(page,selected);return;}
  if(tab.equals("map")){mapPage();return;}
  if(tab.equals("rain")){rainPage();return;}
  if(tab.equals("brazil")){brazilPage();return;}
  LinearLayout page=page();if(tab.equals("weather"))weatherPage(page);else if(tab.equals("notices"))noticesPage(page);else if(tab.equals("settings"))settingsPage(page);else if(tab.equals("advanced"))advancedPage(page);else if(tab.equals("history"))historyPage(page);else if(tab.equals("sismos"))sismosPage(page);else if(tab.equals("tsunamis"))tsunamisPage(page);else if(tab.equals("more"))morePage(page);else if(tab.equals("update"))updatePage(page);else homePage(page);
 }
 private void updateStatus(){status.setVisibility(selected==null&&(tab.equals("rain")||tab.equals("brazil"))?View.GONE:View.VISIBLE);if(snapshot==null){status.setText("Aguardando consulta");return;}String time=snapshot.refreshedAt>0?" · "+BrDates.dateTime(snapshot.refreshedAt):"";String label=snapshot.feedStatus+time;if(!label.contentEquals(status.getText())){status.setText(label);if(android.animation.ValueAnimator.areAnimatorsEnabled()){status.animate().cancel();status.setAlpha(.7f);status.animate().alpha(1).setDuration(130).start();}}}
 private String sectionFor(String route){
  switch(route){
   case "map":return "sismos";
   case "rain":case "brazil":return "weather";
   case "tsunamis":case "history":return "notices";
   case "settings":return settingsReturnTab;
   case "advanced":return advancedReturnTab.equals("settings")?settingsReturnTab:"more";
   case "update":return "more";
   default:return route;
  }
 }
 private void renderNavigation(){
  navigation.removeAllViews();
  String shown=sectionFor(selected==null?tab:returnTab);
  int previous=Arrays.asList("home","sismos","weather","notices","more").indexOf(shownSection);shownSection=shown;
  String[] ids={"home","sismos","weather","notices","more"};
  String[] labels={"Início","Sismos","Clima","Avisos","Mais"};
  int[] icons={PhoneIcons.HOME,PhoneIcons.SEISMIC,PhoneIcons.CLOUD,PhoneIcons.BELL,PhoneIcons.MORE};
  for(int i=0;i<ids.length;i++){
   String target=ids[i];boolean current=target.equals(shown);int color=current?CYAN:MUTED;
   LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setGravity(Gravity.CENTER);item.setMinimumHeight(dp(60));item.setPadding(0,dp(5),0,dp(5));
   item.setTag("tab-"+target);item.setContentDescription(labels[i]);item.setSelected(current);item.setFocusable(true);
   item.setBackground(ripple(BODY,false));
   FrameLayout indicator=new FrameLayout(this);
   if(current){
    indicator.setBackground(pill(0xff164455));
    if(previous>=0&&previous!=i&&android.animation.ValueAnimator.areAnimatorsEnabled()){
     indicator.setTranslationX(dp(previous<i?-10:10));indicator.setAlpha(.35f);
     indicator.animate().translationX(0).alpha(1f).setDuration(170).start();
    }
   }
   indicator.addView(new PhoneIcons(this,icons[i],color),new FrameLayout.LayoutParams(dp(21),dp(21),Gravity.CENTER));
   item.addView(indicator,new LinearLayout.LayoutParams(dp(44),dp(27)));
   TextView label=text(labels[i],12,color,1);label.setGravity(Gravity.CENTER);
   item.addView(label,new LinearLayout.LayoutParams(-1,-2));
   navigation.addView(item,new LinearLayout.LayoutParams(0,-2,1));item.setOnClickListener(v->go(target));
  }
 }
 private void go(String target){selected=null;tab=target;render();}
 private GradientDrawable pill(int color){GradientDrawable shape=new GradientDrawable();shape.setColor(color);shape.setCornerRadius(dp(14));return shape;}
 private LinearLayout page(){ScrollView scroll=new ScrollView(this);visibleScroll=scroll;scroll.setFillViewport(false);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(16),dp(12),dp(16),dp(20));scroll.addView(page,new ScrollView.LayoutParams(-1,-2));content.addView(scroll,new FrameLayout.LayoutParams(-1,-1));final int restored=scrollPositions.getOrDefault(displayedRoute,0);scroll.addOnLayoutChangeListener(new View.OnLayoutChangeListener(){public void onLayoutChange(View v,int l,int t,int r,int b,int ol,int ot,int or,int ob){if(scroll.getHeight()<=0)return;scroll.removeOnLayoutChangeListener(this);scroll.post(()->{if(visibleScroll==scroll)scroll.scrollTo(0,restored);});}});return page;}
 private void heading(LinearLayout page,String title){TextView t=text(title,24,TEXT,4);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);t.setAccessibilityHeading(true);page.addView(t,p);}
 private void copy(LinearLayout page,String value){TextView t=text(value,15,MUTED,60);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(t,p);}
 private android.graphics.drawable.Drawable glass(){GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff123b4e,0xff0a2231,0xff0b2938});g.setCornerRadius(dp(18));g.setStroke(dp(1),0xff245266);return g;}
 private LinearLayout card(LinearLayout page,String caption){Panel panel=new Panel(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackground(glass());LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(16);page.addView(panel,lp);TextView h=text(caption,13,CYAN,3);h.setLetterSpacing(.06f);h.setPadding(dp(16),dp(16),dp(16),0);panel.addView(h,new LinearLayout.LayoutParams(-1,-2));return panel;}
 private LinearLayout section(LinearLayout card){LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(16),dp(12),dp(16),dp(16));card.addView(body,new LinearLayout.LayoutParams(-1,-2));return body;}
 private void footer(LinearLayout card,String value){TextView t=text(value,13,MUTED,10);t.setBackgroundColor(0x25000000);t.setPadding(dp(16),dp(10),dp(16),dp(12));card.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 private void homePage(LinearLayout page){
  heading(page,"Monitoramento agora");
  alertStatus(page);
  heading(page,"Sismos recentes");eventList(page,1);
  space(page,button("Ver lista de sismos",()->go("sismos")),4);
  heading(page,"Clima na Liberdade");weatherCard(page,false);rainCard(page,false);
  space(page,button("Ver previsão e mapas",()->go("weather")),4);
 }
 private void sismosPage(LinearLayout page){
  heading(page,"Sismos");copy(page,"Brasil, regiões monitoradas e sismos globais de magnitude 6 ou mais, conforme as fontes disponíveis.");
  Button mapButton=button("Abrir mapa de sismos",()->{mappedEvent=null;mapReturnTab="sismos";mapFilter="earthquake";go("map");});
  mapButton.setTag("open-seismic-map");space(page,mapButton,0);
  LinearLayout filters=new LinearLayout(this);
  String[] regions={"all","BR","world"},labels={"Todos","Brasil","Outros países"};
  for(int i=0;i<regions.length;i++){
   String region=regions[i];Button filter=button(labels[i],()->{quakeRegion=region;render();});
   filter.setTag("quake-region-"+region);filter.setSelected(region.equals(quakeRegion));
   filter.setTextColor(region.equals(quakeRegion)?CYAN:MUTED);filter.setBackground(ripple(region.equals(quakeRegion)?0xff164455:BODY));filter.setTextSize(13);filter.setPadding(dp(4),dp(6),dp(4),dp(6));
   filters.addView(filter,new LinearLayout.LayoutParams(0,-2,1));
  }
  space(page,filters,8);
  List<Alert> quakes=new ArrayList<>();
  for(Alert a:events()){
   if(!a.kind.equals("earthquake"))continue;
   boolean brazil="BR".equalsIgnoreCase(a.countryCode);
   if(quakeRegion.equals("all")||(quakeRegion.equals("BR")&&brazil)||(quakeRegion.equals("world")&&!brazil&&!a.countryCode.isEmpty()))quakes.add(a);
  }
  heading(page,"Registros recentes");
  for(int i=0;i<Math.min(20,quakes.size());i++)eventCard(page,quakes.get(i));
  if(quakes.isEmpty())copy(page,"Nenhum registro sísmico disponível na consulta atual.");
 }
 private void weatherPage(LinearLayout page){
  requestDetails(false);heading(page,"Clima");
  copy(page,"Tempo na Liberdade · São Paulo");
  layerButtons(page,"weather");
  weatherCard(page,true);hourlyCard(page);rainCard(page,true);
  copy(page,"Previsão para um ponto da Liberdade. Em Satélite, consulte outros municípios e as fontes de cada camada.");
 }
 private void layerButtons(LinearLayout box,String current){
  LinearLayout row=new LinearLayout(this);row.setPadding(dp(8),0,dp(8),0);
  String[] ids={"weather","rain","brazil"},labels={"Previsão","Chuva","Satélite"};
  for(int i=0;i<ids.length;i++){
   String target=ids[i];Button b=button(labels[i],()->{
    if(tab.equals(target))return;
    if(target.equals("weather"))go("weather");else openLayer(target);
   });
   b.setTag(target.equals("weather")?"open-weather":target.equals("rain")?"open-rain":"open-brazil");
   b.setSelected(target.equals(current));b.setTextColor(target.equals(current)?CYAN:MUTED);b.setBackground(ripple(target.equals(current)?0xff164455:BODY));b.setTextSize(13);
   b.setPadding(dp(4),dp(6),dp(4),dp(6));
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMarginEnd(dp(i<2?4:0));row.addView(b,lp);
  }
  LinearLayout.LayoutParams rowLayout=new LinearLayout.LayoutParams(-1,-2);rowLayout.bottomMargin=dp(8);box.addView(row,rowLayout);
 }
 private void requestDetails(boolean daily){requestDetails(daily,false);}
 private void requestDetails(boolean daily,boolean force){
  if(!automaticRefresh()||!active||destroyed||detailLoading||(!force&&System.currentTimeMillis()<(daily?nextDailyAttempt:nextDetailAttempt)))return;detailLoading=true;if(daily)nextDailyAttempt=System.currentTimeMillis()+300000;else nextDetailAttempt=System.currentTimeMillis()+300000;int token=generation;if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{PhoneRepository.Snapshot next=repository.details(System.currentTimeMillis(),daily,force);main.post(()->{if(!active||destroyed||generation!=token)return;detailLoading=false;cache.edit().putString("snapshot",repository.exportCache()).apply();snapshot=next;render();});});
 }
 private void hourlyCard(LinearLayout page){
  if(snapshot==null||snapshot.hours.isEmpty()){LinearLayout card=card(page,"PREVISÃO POR HORA"),body=section(card);body.addView(text(detailLoading?"Consultando os próximos horários…":"Não foi possível carregar os próximos horários",16,MUTED,3));space(body,text("Isso não significa ausência de chuva. A estimativa por minuto está no quadro de chuva.",14,MUTED,4),7);Button retry=button("Consultar próximas horas",()->{requestDetails(false,true);render();});retry.setTag("retry-hourly");retry.setEnabled(!detailLoading);space(body,retry,8);return;}
  LinearLayout card=card(page,"PRÓXIMAS HORAS · MODELO HORÁRIO"),body=section(card);HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);LinearLayout row=new LinearLayout(this);scroller.addView(row,new HorizontalScrollView.LayoutParams(-2,-2));body.addView(scroller,new LinearLayout.LayoutParams(-1,-2));
  for(PhoneHourly.Hour h:snapshot.hours){if(h.start<System.currentTimeMillis())continue;LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setGravity(Gravity.CENTER);cell.setPadding(dp(8),0,dp(8),0);row.addView(cell,new LinearLayout.LayoutParams(dp(98),-2));String from=WeatherForecast.time(h.start).replace(" BRT",""),to=WeatherForecast.time(h.start+3600000).replace(" BRT","");cell.addView(text(from+"–"+to,13,MUTED,2));cell.addView(new PhoneIcons(this,PhoneIcons.condition(h.condition,h.start),TEXT),new LinearLayout.LayoutParams(dp(30),dp(38)));cell.addView(text(Math.round(h.temperature)+"°C",22,TEXT,1));cell.addView(text(RainForecast.number(h.amount)+" mm/1h",12,CYAN,1));}
  footer(card,"Rainbow Weather · horários em Brasília. Cada coluna é o intervalo indicado, diferente dos próximos 60 minutos contados a partir de agora.");
 }
 private void weatherCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"TEMPO · LIBERDADE, SP"),body=section(card);WeatherForecast.Summary w=snapshot==null?null:snapshot.weather;
  if(w==null){String state=snapshot==null?"Aguardando consulta":snapshot.weatherStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando previsão horária…":"Previsão horária indisponível",22,TEXT,4));footer(card,state);return;}
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LinearLayout.LayoutParams(-1,-2));
  long now=System.currentTimeMillis();
  PhoneSkyObservation observed=snapshot==null?null:snapshot.sky;
  if(observed!=null&&!observed.fresh(now))observed=null;
  PhoneWeatherArt art=new PhoneWeatherArt(this,observed==null?PhoneWeatherReading.skyArt(w):observed.key,now);hero.addView(art,new LinearLayout.LayoutParams(0,dp(126),1));
  LinearLayout readings=new LinearLayout(this);readings.setOrientation(LinearLayout.VERTICAL);hero.addView(readings,new LinearLayout.LayoutParams(0,-2,1));readings.addView(text(w.temperatureValue,48,TEXT,2));space(readings,text(observed==null?PhoneWeatherReading.skyLabel(w,now):observed.condition(observed.at),19,TEXT,4),3);space(readings,text(observed==null?"Céu: modelo horário":"Observado em Congonhas · "+WeatherForecast.time(observed.at),12,MUTED,3),4);space(readings,text("Sensação "+w.feelsValue,15,MUTED,3),5);
  LinearLayout metrics=metricRow(body);metric(metrics,PhoneIcons.DROP,w.humidityValue,"Umidade");metric(metrics,PhoneIcons.WIND,w.windValue,"Vento");metric(metrics,PhoneIcons.WIND,w.gustValue,"Rajadas");
  String provenance="Rainbow Weather · Modelo horário\n"+w.timing;
  if(detail)briefingCard(body,"hourly",w,snapshot==null?null:snapshot.rain);
  if(detail){provenance+="\nEstimativa para um ponto da Liberdade · sujeita a mudanças";footer(card,provenance);}else space(body,text(w.timing,12,MUTED,2),6);
 }
 private void rainCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"CHUVA · LIBERDADE, SP"),body=section(card);RainForecast.Summary r=snapshot==null?null:snapshot.rain;
  if(r==null&&snapshot!=null&&PhoneWeatherReading.hourlyPrecipitation(snapshot.weather)){
   body.addView(text("Pode haver precipitação · início incerto",22,TEXT,4));
   footer(card,snapshot.weather.timing);
   return;
  }
  if(r==null){String state=snapshot==null?"Aguardando consulta":snapshot.rainStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando chuva por minuto…":"Chuva por minuto: indisponível",22,TEXT,4));footer(card,state);return;}
  if(r.state.equals("evidence")){
   body.addView(text(r.title,22,TEXT,4));
   space(body,text(r.stopText,15,MUTED,4),7);
   footer(card,(r.level.equals("gauge")?"Medição · ":"Consulta · ")+WeatherForecast.time(r.at));
   return;
  }
  if(!detail){LinearLayout preview=new LinearLayout(this);preview.setGravity(Gravity.CENTER_VERTICAL);body.addView(preview,new LinearLayout.LayoutParams(-1,-2));preview.addView(new PhoneIcons(this,r.state.equals("dry")?PhoneIcons.CLOUD:PhoneIcons.RAIN,CYAN),new LinearLayout.LayoutParams(dp(26),dp(26)));TextView message=text(r.title,r.state.equals("dry")?19:22,TEXT,4);LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(0,-2,1);mp.setMarginStart(dp(10));preview.addView(message,mp);if(!r.state.equals("dry")){PhoneRainChart.Series interval=snapshot==null?null:snapshot.rainSeries;space(body,text("Próximos 60 min · "+RainForecast.number(interval==null?r.amount:interval.accumulated(60))+" mm previstos",15,MUTED,3),8);}space(body,text("Estimativa por minuto · "+WeatherForecast.time(r.at),12,MUTED,3),6);return;}
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
 private void eventList(LinearLayout page,int maximum){List<Alert> relevant=new ArrayList<>();for(Alert a:events())if(a.kind.equals("earthquake"))relevant.add(a);if(relevant.isEmpty()){copy(page,snapshot==null||snapshot.feedStatus.startsWith("Aguardando")?"Aguardando consulta dos eventos.":"Nenhum evento relevante disponível nesta consulta. Confira o histórico para boletins informativos.");return;}for(int i=0;i<Math.min(maximum,relevant.size());i++)eventCard(page,relevant.get(i));if(relevant.size()>maximum)copy(page,"Mostrando "+maximum+" de "+relevant.size()+" registros relevantes.");}
 private void eventCard(LinearLayout page,Alert a){
  boolean quake=a.kind.equals("earthquake");
  LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(12),dp(10),dp(12),dp(10));card.setBackground(ripple(BODY));card.setFocusable(true);
  card.setTag("event-"+a.id);card.setContentDescription((quake?magnitude(a)+". ":"")+a.title+". "+source(a)+". Abrir detalhes");
  LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(6);page.addView(card,p);
  LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);card.addView(row,new LinearLayout.LayoutParams(-1,-2));
  if(quake){
   TextView mag=text(magnitude(a),20,AMBER,2);mag.setFontFeatureSettings("tnum");mag.setMinimumWidth(dp(61));
   LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-2,-2);mp.setMarginEnd(dp(7));row.addView(mag,mp);addFlag(row,a,20);
  }
  TextView location=text(quake?location(a):tsunamiState(a.state),16,TEXT,4);
  location.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
  row.addView(location,new LinearLayout.LayoutParams(0,-2,1));
  String timestamp=BrDates.dateTime(eventTime(a));
  space(card,text(quake?timestamp+" · "+depth(a):a.title+" · "+timestamp,13,MUTED,4),5);
  card.setOnClickListener(v->showEvent(a));
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
   LinearLayout science=card(page,"ENTENDA O SISMO");
   LinearLayout analysisBody=section(science);
   copy(analysisBody,"O que o registro permite concluir sobre o tremor, o que ainda é incerto e quais evidências ajudam a esclarecer.");
   analysisBody.addView(button("Entenda este sismo · análise aprofundada",()->showSeismicContext(a)),new LinearLayout.LayoutParams(-1,-2));
  }
  Button mapButton=button("Ver localização no mapa",()->showMapEvent(a));mapButton.setEnabled(MapFrame.located(a.originLongitude,a.originLatitude));page.addView(mapButton,new LinearLayout.LayoutParams(-1,-2));if(!mapButton.isEnabled())copy(page,"Localização no mapa indisponível para este registro.");
  space(page,button("Compartilhar evento",()->share(a)),10);
  if(a.kind.equals("earthquake")&&Double.isFinite(a.magnitude)&&
    MapFrame.located(a.originLongitude,a.originLatitude)&&Math.abs(a.originLatitude)<85&&
    (a.magnitude>=6||"BR".equalsIgnoreCase(a.countryCode))){
   space(page,button("Compartilhar vídeo do sismo",()->prepareShare(a,true)),8);
  }
 }

 private void showSeismicContext(Alert a){
  LinearLayout body=new LinearLayout(this);
  body.setOrientation(LinearLayout.VERTICAL);
  body.setPadding(dp(20),dp(8),dp(20),dp(16));
  body.setBackgroundColor(BACK);
  LinearLayout sections=new LinearLayout(this);
  sections.setOrientation(LinearLayout.VERTICAL);
  space(body,text("Dados do catálogo",17,CYAN,2),6);
  space(body,text(source(a)+" · "+magnitude(a)+" · "+depth(a),15,TEXT,5),5);
  space(body,text("Seleção da IA",17,CYAN,2),16);
  TextView status=text("A IA escolhe os tópicos mais relevantes para este sismo.",14,MUTED,5);
  status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
  Button consult=button("Pedir seleção à IA",()->{});
  space(body,status,6);
  space(body,consult,8);
  body.addView(sections);
  renderSeismicContext(sections,a);
  ScrollView scroll=new ScrollView(this);
  scroll.addView(body);
  android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this).setTitle("Entenda este sismo")
   .setView(scroll).setPositiveButton("Fechar",null).create();
  Future<?>[] inquiry={null};
  consult.setOnClickListener(v->{
   consult.setEnabled(false);
   status.setText("A IA está selecionando os tópicos…");
   if(worker==null)worker=Executors.newSingleThreadExecutor();
   inquiry[0]=worker.submit(()->{
    PhoneSeismicInsight.Report report;
    try{report=PhoneSeismicInsight.focus(a);}
    catch(InterruptedException e){Thread.currentThread().interrupt();return;}
    catch(Exception e){report=new PhoneSeismicInsight.Report(List.of(),false);}
    PhoneSeismicInsight.Report result=report;
    main.post(()->{
     if(destroyed||!dialog.isShowing())return;
     List<String> selection=result.model?seismicSelection(a,result.topics):List.of();
     if(!selection.isEmpty()){
      status.setText("Tópicos selecionados pela IA\n• "+String.join("\n• ",selection));
      consult.setText("Seleção concluída");
     }else{
      status.setText("A seleção da IA está indisponível. As explicações do Argos Orbis estão abaixo.");
      consult.setEnabled(true);
     }
    });
   });
  });
  dialog.setOnDismissListener(d->{if(inquiry[0]!=null)inquiry[0].cancel(true);});
  dialog.show();
  if(dialog.getWindow()!=null)dialog.getWindow().setBackgroundDrawable(pill(BACK));
 }

 private List<String> seismicSelection(Alert a,List<String> focus){
  List<String> highlights=new ArrayList<>();
  for(String[] item:SeismicContext.sections(a)){
   String title=item[0];
   if((title.startsWith("Onde")&&(focus.contains("size")||focus.contains("shaking")))||
      (title.startsWith("Como a profundidade")&&focus.contains("depth"))||
      (title.startsWith("O que significa")&&focus.contains("revisions"))||
      (title.startsWith("Como verificar")&&(focus.contains("science")||focus.contains("revisions")))||
      (title.startsWith("Como interpretar")&&focus.contains("tsunami")))highlights.add(title);
  }
  return highlights;
 }

 private void renderSeismicContext(LinearLayout sections,Alert a){
  space(sections,text("Explicações científicas · Argos Orbis",17,CYAN,3),18);
  for(String[] item:SeismicContext.sections(a)){
   space(sections,text(item[0],18,TEXT,4),12);
   space(sections,text(item[1],16,MUTED,16),4);
  }
 }

 private void detail(LinearLayout parent,int kind,String value){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=dp(8);parent.addView(row,rp);row.addView(new PhoneIcons(this,kind,MUTED),new LinearLayout.LayoutParams(dp(24),dp(24)));TextView t=text(value,18,TEXT,5);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMarginStart(dp(10));row.addView(t,lp);}

 private static boolean informational(Alert a){
  return a.kind.equals("tsunami")&&(a.state.equals("noThreat")||a.state.equals("information")||a.state.equals("ended"));
 }
 private static boolean officialWarning(Alert a){
  return a.kind.equals("tsunami")&&(a.state.equals("warning")||a.state.equals("watch")||a.state.equals("advisory"));
 }
 private void alertStatus(LinearLayout page){
  LinearLayout summary=card(page,"CONSULTA OFICIAL"),body=section(summary);
  int urgent=0;for(Alert a:events())if(officialWarning(a))urgent++;
  boolean queried=snapshot!=null&&snapshot.refreshedAt>0&&!snapshot.saved&&snapshot.tsunamiOk;
  String message=queried
    ?(urgent>0?urgent+" aviso(s) oficial(is) de tsunami na consulta":"Nenhum aviso oficial urgente identificado na consulta")
    :(urgent>0?"Aviso de tsunami nos registros disponíveis · consulta atual não confirmada":"Consulta oficial ainda não confirmada");
  body.addView(text(message,17,urgent>0?AMBER:TEXT,5));
  footer(summary,snapshot==null?"Aguardando consulta":snapshot.feedStatus+(queried?" · "+BrDates.dateTime(snapshot.refreshedAt):""));
 }
 private void noticesPage(LinearLayout page){
  heading(page,"Central de Alertas");alertStatus(page);
  Button tsunamis=button("Avisos de tsunami",()->go("tsunamis"));tsunamis.setTag("open-tsunamis");space(page,tsunamis,0);
  Button history=button("Boletins e resumo diário",()->go("history"));history.setTag("open-history");space(page,history,8);
  space(page,button("Configurar notificações",()->openSettings("notices")),8);
  copy(page,"As fontes consultadas e o histórico de notificações do Android são independentes. A ausência de registros não garante ausência de perigo.");
 }
 private void tsunamisPage(LinearLayout page){
  space(page,button("‹ Voltar aos avisos",()->go("notices")),0);heading(page,"Tsunamis");alertStatus(page);
  int shown=0;
  for(Alert a:events())if(a.kind.equals("tsunami")&&!informational(a)){eventCard(page,a);if(++shown>=20)break;}
  if(shown==0)copy(page,snapshot==null||snapshot.refreshedAt<=0||snapshot.saved||!snapshot.tsunamiOk?"Dados oficiais indisponíveis ou consulta em andamento.":"Nenhum boletim de tsunami relevante disponível nesta consulta.");
  space(page,button("Ver boletins informativos",()->go("history")),8);
 }
 private void morePage(LinearLayout page){
  heading(page,"Mais");
  Button alerts=button("Notificações",()->openSettings("more"));alerts.setTag("open-settings");space(page,alerts,0);
  Button update=button("Atualização do aplicativo",()->go("update"));update.setTag("open-update");space(page,update,8);
  space(page,button("Sobre e diagnóstico",()->openAdvanced("more")),8);
  space(page,button("Canal oficial no Telegram",()->openUrl("https://t.me/argosorbis")),8);
 }
 private void openSettings(String origin){settingsReturnTab=origin;go("settings");}
 private void openAdvanced(String origin){advancedReturnTab=origin;go("advanced");}
 private void updatePage(LinearLayout page){
  space(page,button("‹ Voltar a Mais",()->go("more")),0);heading(page,"Atualização");
  copy(page,"Versão instalada · "+top.monitorglobal.mobile.BuildConfig.VERSION_NAME);
  space(page,button("Verificar atualização do aplicativo",()->{if(updater!=null)updater.check();}),0);
  copy(page,"Instalação do canal de testes: o Android pede sua confirmação para atualizar.");
 }
 private void historyPage(LinearLayout page){
  page.addView(button("‹ Voltar aos alertas",()->{tab="notices";render();}),new LinearLayout.LayoutParams(-1,-2));
  heading(page,"Boletins e histórico");
  copy(page,"Informações sem ameaça ativa ficam aqui, separadas dos alertas importantes.");
  int shown=0;
  for(Alert a:events())if(informational(a)){eventCard(page,a);if(++shown>=30)break;}
  if(shown==0)copy(page,snapshot==null?"Aguardando consulta dos boletins.":"Nenhum boletim informativo disponível nesta consulta.");
  Button summary=button(dailyExpanded?"Fechar resumo diário":"Ver resumo diário · dia anterior",()->{dailyExpanded=!dailyExpanded;if(dailyExpanded)requestDetails(true);render();});summary.setTag("daily-summary");space(page,summary,8);
  if(dailyExpanded){requestDetails(true);LinearLayout daily=card(page,"MAIORES SISMOS · DIA ANTERIOR"),body=section(daily);if(snapshot!=null&&snapshot.dailyAvailable){copy(body,"Dia "+snapshot.dailyDay+" · horário de Brasília");if(snapshot.daily.isEmpty())copy(body,"Nenhum registro disponível nas fontes para este período.");for(Alert a:snapshot.daily)eventCard(body,a);footer(daily,"Até cinco maiores registros disponíveis. Não corresponde à contagem global de sismos.");}else copy(body,detailLoading?"Consultando resumo diário…":"Resumo diário indisponível nesta consulta.");}
 }
 private void settingsPage(LinearLayout page){
  page.addView(button("‹ Voltar",()->go(settingsReturnTab)),new LinearLayout.LayoutParams(-1,-2));
  heading(page,"Notificações");
  copy(page,"Escolha quais avisos receber no telefone. Os alertas mostrados na Central vêm das fontes consultadas e não dependem de habilitar notificações.");
  pushSettings(page);
  space(page,button("Informações técnicas e atualização do aplicativo",()->openAdvanced("settings")),6);
  page.addView(button("Abrir canal oficial no Telegram",()->openUrl("https://t.me/argosorbis")),new LinearLayout.LayoutParams(-1,-2));
 }
 private void advancedPage(LinearLayout page){
  page.addView(button("‹ Voltar",()->go(advancedReturnTab)),new LinearLayout.LayoutParams(-1,-2));
  heading(page,"Sobre e diagnóstico");
  copy(page,"ARGOS ORBIS · argosorbis.com.br · @argosorbis\nVersão "+top.monitorglobal.mobile.BuildConfig.VERSION_NAME);
  page.addView(button("Verificar atualização do aplicativo",()->{if(updater!=null)updater.check();}),new LinearLayout.LayoutParams(-1,-2));
  copy(page,"Instalação do canal de testes: o Android pede sua confirmação para atualizar.");
  page.addView(button("Testar notificação neste aparelho",()->{boolean ok=PhonePush.testLocal(this);Toast.makeText(this,ok?"Teste local criado; não confirma entrega pelo Firebase.":"Ative a permissão do Android antes de testar.",Toast.LENGTH_LONG).show();}),new LinearLayout.LayoutParams(-1,-2));
  if(top.monitorglobal.mobile.BuildConfig.DEBUG&&PhonePush.configured())space(page,button("Copiar código para teste push",()->PhonePush.copyTestToken(this)),6);
  copy(page,"O recebimento de notificações depende da rede, das permissões e das restrições do Android. Não é garantido tempo real.");
  LinearLayout sources=card(page,"FONTES E COBERTURA"),body=section(sources);
  body.addView(text("M6+ globais, Brasil e áreas monitoradas",19,TEXT,4));
  space(body,text(snapshot==null?"Aguardando consulta":snapshot.feedStatus,15,MUTED,5),8);
  space(body,text(snapshot==null?"Meteorologia aguardando consulta":snapshot.weatherStatus,15,MUTED,5),5);
  space(body,text(snapshot==null?"Chuva aguardando consulta":snapshot.rainStatus,15,MUTED,5),5);
  footer(sources,"Ausência de dados não significa ausência de risco. Siga as orientações das autoridades responsáveis.");
  page.addView(button("Abrir Argos Orbis no navegador",()->openUrl("https://argosorbis.com.br/")),new LinearLayout.LayoutParams(-1,-2));
 }
 private void pushSettings(LinearLayout page){
  LinearLayout card=card(page,"AVISOS NO CELULAR"),body=section(card);
  body.addView(text(PhonePush.enabled(this)?"Notificações ativadas":"Notificações desativadas",19,PhonePush.enabled(this)?CYAN:MUTED,2));
  space(body,text(PhonePush.status(this),14,MUTED,6),7);
  if(PhonePush.enabled(this))body.addView(button("Desativar notificações",()->{PhonePush.disable(this);render();}),new LinearLayout.LayoutParams(-1,-2));
  else body.addView(button("Ativar avisos no celular",this::activatePush),new LinearLayout.LayoutParams(-1,-2));
  String[] names={"Sismos · Brasil, M6+ e áreas monitoradas","Avisos de tsunami","Chuva · chegada, volume e duração","Boletins do tempo · de hora em hora","Resumo diário · dia anterior"};
  for(int i=0;i<PhonePush.CATEGORIES.length;i++){final String category=PhonePush.CATEGORIES[i];android.widget.Switch toggle=new android.widget.Switch(this);toggle.setText(names[i]);toggle.setTextSize(16);toggle.setTextColor(TEXT);toggle.setTypeface(Typeface.DEFAULT);toggle.setPadding(0,dp(8),0,dp(8));toggle.setMinimumHeight(dp(52));toggle.setChecked(PhonePush.categoryEnabled(this,category));toggle.setTag("push-category-"+category);toggle.setOnCheckedChangeListener((v,on)->PhonePush.setCategory(this,category,on,()->{if(!destroyed)render();}));body.addView(toggle,new LinearLayout.LayoutParams(-1,-2));}
  footer(card,"Chuva e previsão: Liberdade, São Paulo. Os horários e a entrega dependem dos serviços e permissões do aparelho.");
 }
 private void openLayer(String target){satelliteRequested=target.equals("brazil")&&brazilMap==null;tab=target;selected=null;render();}
 private Button backButton(String label,Runnable action){Button b=button(label,action);b.setTextSize(14);return b;}
 private void mapPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));box.addView(backButton("‹ "+(mappedEvent==null?"Sismos":"Detalhes do evento"),this::closeSeismicMap));Button filterButton=button("Filtrar eventos · "+(mapFilter.equals("all")?"Todos":mapFilter.equals("earthquake")?"Sismos":"Tsunamis")+(mapFiltersExpanded?"  ▴":"  ▾"),()->{mapFiltersExpanded=!mapFiltersExpanded;render();});filterButton.setTag("map-show-filters");filterButton.setTextSize(14);filterButton.setMinHeight(dp(36));filterButton.setMinimumHeight(dp(36));box.addView(filterButton,new LinearLayout.LayoutParams(-1,-2));LinearLayout filters=new LinearLayout(this);filters.setPadding(dp(8),0,dp(8),dp(3));if(mapFiltersExpanded)box.addView(filters,new LinearLayout.LayoutParams(-1,-2));String[] names={"Todos","Sismos","Tsunami"},ids={"all","earthquake","tsunami"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{mapFilter=id;render();});b.setSelected(mapFilter.equals(id));b.setTextColor(mapFilter.equals(id)?CYAN:MUTED);b.setMinHeight(dp(38));b.setMinimumHeight(dp(38));b.setPadding(dp(4),dp(2),dp(4),dp(2));b.setTextSize(14);filters.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
  if(map==null)map=new PhoneMapView(this,this::showEvent);if(map.getParent()!=null)((ViewGroup)map.getParent()).removeView(map);box.addView(map,new LinearLayout.LayoutParams(-1,0,1));List<Alert> visible=new ArrayList<>();for(Alert a:events())if(mapFilter.equals("all")||mapFilter.equals(a.kind))visible.add(a);if(mappedEvent!=null&&visible.stream().noneMatch(a->a.id.equals(mappedEvent.id)))visible.add(0,mappedEvent);map.setEvents(visible);if(focusMappedEvent&&mappedEvent!=null){focusMappedEvent=false;map.focus(mappedEvent);}if(active)map.resume();else map.pause();
 }
 private void rainPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));layerButtons(box,"rain");
  if(snapshot!=null)briefingCard(box,"rain",snapshot.weather,snapshot.rain);
  if(rainMap==null)rainMap=new PhoneMapView(this,null,true);if(rainMap.getParent()!=null)((ViewGroup)rainMap.getParent()).removeView(rainMap);box.addView(rainMap,new LinearLayout.LayoutParams(-1,0,1));if(active)rainMap.resume();else rainMap.pause();
 }
 private void brazilPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));layerButtons(box,"brazil");
  if(brazilMap==null)brazilMap=new PhoneMapView(this,null,false,true);if(brazilMap.getParent()!=null)((ViewGroup)brazilMap.getParent()).removeView(brazilMap);box.addView(brazilMap,new LinearLayout.LayoutParams(-1,0,1));if(active)brazilMap.resume();else brazilMap.pause();if(satelliteRequested){satelliteRequested=false;brazilMap.showSatellite();}
 }
 private void showMapEvent(Alert a){
  if(!tab.equals("map")){mappedEvent=a.copy();mapReturnTab=returnTab;}
  mapFilter=a.kind;focusMappedEvent=mappedEvent!=null;
  go("map");
  if(mappedEvent==null&&map!=null)map.focus(a);
 }
 private void closeSeismicMap(){
  Alert focused=mappedEvent;mappedEvent=null;focusMappedEvent=false;tab=mapReturnTab;returnTab=tab;
  if(focused!=null){selected=focused;}render();
 }
 private void share(Alert a){
  if(siteImage!=null)return;
  shareSiteCard(a);
 }

 void shareSiteCard(Alert event){prepareShare(event,false);}

 private void prepareShare(Alert event,boolean video){
  if(siteImage!=null)return;
  Toast.makeText(this,video?"Preparando vídeo do sismo…":"Preparando o cartão com mapa…",Toast.LENGTH_SHORT).show();
  siteImage=new SiteEventImage(this,event,video,(uri,mime)->{
   siteImage=null;
   if(active&&!destroyed){
    if(uri!=null)sendEvent(event,uri,mime);
    else Toast.makeText(this,video?"Não foi possível gerar o vídeo com mapa. Tente novamente.":"Não foi possível preparar o cartão cartográfico. Tente novamente.",Toast.LENGTH_LONG).show();
   }
  });
 }

 void sendEvent(Alert a,Uri image){sendEvent(a,image,"image/png");}

 private void sendEvent(Alert a,Uri image,String mime){
  boolean quake=a.kind.equals("earthquake");
  String timestamp=eventTime(a)>0?BrDates.dateTime(eventTime(a)):"Horário indisponível";
  String[] facts=quake?new String[]{depth(a),timestamp,source(a)}:new String[]{timestamp,source(a)};
  String caption=a.title+"\n"+String.join("\n",facts);
  Intent send=new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_SUBJECT,"Argos Orbis · "+a.title);
  send.setType(mime).putExtra(Intent.EXTRA_STREAM,image).putExtra(Intent.EXTRA_TEXT,caption)
   .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
  send.setClipData(android.content.ClipData.newRawUri("Arquivo do evento",image));
  try{startActivity(Intent.createChooser(send,"Compartilhar evento"));}
  catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Nenhum aplicativo disponível para compartilhar.",Toast.LENGTH_LONG).show();}
 }
 private void openUrl(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Não foi possível abrir o navegador.",Toast.LENGTH_LONG).show();}}
 @Override public void onBackPressed(){
  if(selected!=null){go(returnTab);return;}
  switch(tab){
   case "map":closeSeismicMap();break;
   case "rain":case "brazil":go("weather");break;
   case "advanced":go(advancedReturnTab);break;
   case "settings":go(settingsReturnTab);break;
   case "history":case "tsunamis":go("notices");break;
   case "update":go("more");break;
   case "home":super.onBackPressed();break;
   default:go("home");
  }
 }
 static String magnitude(Alert a){return Double.isFinite(a.magnitude)?String.format(Locale.forLanguageTag("pt-BR"),"M%.1f",a.magnitude):"M—";}
 static String location(Alert a){return a.title.replaceFirst("^M[0-9]+[,.][0-9]+\\s*·\\s*","");}
 static String depth(Alert a){return Double.isFinite(a.depth)&&a.depth>=0?String.format(Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km",a.depth):"Profundidade não informada";}
 static String source(Alert a){return a.source.isEmpty()?"Fonte não informada":"Fonte: "+a.source;}
 static String tsunamiState(String state){switch(state){case "noThreat":return "Sem ameaça segundo o boletim";case "warning":return "Aviso de tsunami";case "watch":return "Vigilância de tsunami";case "advisory":return "Atenção para tsunami";case "ended":return "Aviso de tsunami encerrado";case "information":return "Boletim informativo de tsunami";default:return "Situação de tsunami não confirmada";}}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private TextView text(String value,int size,int color,int maxLines){TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);v.setTypeface(size>=17?Typeface.create("sans-serif-medium",Typeface.NORMAL):Typeface.DEFAULT);v.setFontFeatureSettings("tnum");v.setMaxLines(maxLines);v.setEllipsize(TextUtils.TruncateAt.END);v.setIncludeFontPadding(false);return v;}
 private Button button(String value,Runnable action){Button b=new Button(this);b.setText(value);b.setAllCaps(false);b.setTextSize(16);b.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));b.setTextColor(CYAN);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setPadding(dp(12),dp(8),dp(12),dp(8));b.setBackground(ripple(BODY));b.setOnClickListener(v->action.run());return b;}
 private android.graphics.drawable.Drawable ripple(int color){return ripple(color,true);}
 private android.graphics.drawable.Drawable ripple(int color,boolean outline){
  GradientDrawable shape=pill(color);if(outline)shape.setStroke(dp(1),0xff244a62);
  return new RippleDrawable(ColorStateList.valueOf(0x5038bdf8),shape,pill(Color.WHITE));
 }
 private void space(LinearLayout parent,View child,int margin){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(margin);parent.addView(child,p);}
 private final class Panel extends LinearLayout {private final Path clip=new Path();Panel(android.content.Context c){super(c);}@Override protected void onSizeChanged(int w,int h,int ow,int oh){super.onSizeChanged(w,h,ow,oh);clip.reset();float r=dp(18);clip.addRoundRect(0,0,w,h,r,r,Path.Direction.CW);}@Override public void draw(Canvas c){int save=c.save();c.clipPath(clip);super.draw(c);c.restoreToCount(save);}}
}



