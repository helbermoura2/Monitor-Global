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
import top.monitorglobal.mobile.R;

/** First phone client: touch navigation and foreground-only updates. */
public class PhoneActivity extends Activity {
 static final int BACK=0xff071019,BODY=0xff10212d,CYAN=0xff8adbe7,TEXT=0xfff2f5f7,MUTED=0xffa8bac8,AMBER=0xffebc687;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final List<Bitmap> flagImages=new ArrayList<>();private final List<ImageView> flagViews=new ArrayList<>();
 private final LinkedHashMap<String,Integer> scrollPositions=new LinkedHashMap<>(16,.75f,true);private ScrollView visibleScroll;private String displayedRoute="";
 private LinearLayout root,header,navigation;private FrameLayout content;private TextView status;private String shownSection="";
 private SiteEventImage siteImage;
 private boolean hourlyRainExpanded,severeRequested;
 private android.app.AlertDialog quakeVolumeDialog;
 private DefesaCivilSp civilAlerts;
 private boolean civilLoading;
 private long civilNextCheck;
 private Typeface brand;private PhoneRepository repository;private PhoneRepository.Snapshot snapshot;
 private WeatherBriefingClient briefing;private PhoneMapView map,rainMap,brazilMap;private PhoneUpdater updater;private ExecutorService worker;private SharedPreferences cache;
 private String tab="home",returnTab="home",mapFilter="all",quakeRegion="all",settingsReturnTab="more",advancedReturnTab="more",mapReturnTab="sismos";private Alert selected,mappedEvent;
 private boolean active,destroyed,refreshing,forecastRequested,focusMappedEvent,detailLoading,dailyExpanded,mapFiltersExpanded;private long nextDetailAttempt,nextDailyAttempt;private int generation;
 private final Runnable pulse=new Runnable(){public void run(){if(!active||destroyed)return;refresh(false);if(tab.equals("notices")&&selected==null)refreshCivilAlerts(false);main.postDelayed(this,60000);}};

 protected PhoneRepository createRepository(){return new PhoneRepository();}
 protected boolean automaticRefresh(){return true;}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);if(automaticRefresh())briefing=new WeatherBriefingClient(this,()->{if(active&&!destroyed)render();});brand=loadBrand();cache=getSharedPreferences("monitor-phone",MODE_PRIVATE);repository=createRepository();
  try{repository.importCache(cache.getString("snapshot",""),System.currentTimeMillis());}catch(RuntimeException ignored){}
  snapshot=repository.snapshot(System.currentTimeMillis());
  if(saved!=null){hourlyRainExpanded=saved.getBoolean("hourlyRainExpanded");tab=saved.getString("tab","home");returnTab=saved.getString("returnTab","home");mapFilter=saved.getString("mapFilter","all");quakeRegion=saved.getString("quakeRegion","all");settingsReturnTab=saved.getString("settingsReturnTab","more");advancedReturnTab=saved.getString("advancedReturnTab","more");mapReturnTab=saved.getString("mapReturnTab","sismos");if(mapReturnTab.equals("map"))mapReturnTab="sismos";ArrayList<String> keys=saved.getStringArrayList("scrollKeys");ArrayList<Integer> positions=saved.getIntegerArrayList("scrollPositions");if(keys!=null&&positions!=null)for(int i=0;i<Math.min(64,Math.min(keys.size(),positions.size()));i++)scrollPositions.put(keys.get(i),Math.max(0,positions.get(i)));try{String record=saved.getString("selected","");if(!record.isEmpty())selected=AlertCodec.read(new org.json.JSONObject(record));String mapped=saved.getString("mappedEvent","");if(!mapped.isEmpty()){mappedEvent=AlertCodec.read(new org.json.JSONObject(mapped));focusMappedEvent=true;}}catch(org.json.JSONException ignored){}}
  getWindow().setStatusBarColor(BACK);getWindow().setNavigationBarColor(BACK);getWindow().getDecorView().setSystemUiVisibility(0);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BACK);
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(10),dp(5),dp(7),dp(5));header.setBackground(surface(0xff132733,BACK,0xff233744,0));root.addView(header,new LinearLayout.LayoutParams(-1,dp(64)));
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
  FrameLayout reload=new FrameLayout(this);reload.setTag("refresh");reload.setContentDescription("Atualizar dados");reload.setBackground(ripple(BODY));PhoneIcons refreshIcon=new PhoneIcons(this,PhoneIcons.REFRESH,CYAN);FrameLayout.LayoutParams iconParams=new FrameLayout.LayoutParams(dp(24),dp(24),Gravity.CENTER);reload.addView(refreshIcon,iconParams);header.addView(reload,new LinearLayout.LayoutParams(dp(48),dp(48)));reload.setOnClickListener(v->{refresh(true);if(tab.equals("notices")&&selected==null)refreshCivilAlerts(true);});
  status=text("Aguardando consulta",12,MUTED,3);status.setPadding(dp(12),dp(3),dp(12),dp(3));root.addView(status,new LinearLayout.LayoutParams(-1,-2));
  content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  navigation=new LinearLayout(this);navigation.setGravity(Gravity.CENTER);navigation.setBackground(surface(0xff11232f,BACK,0xff233744,0));navigation.setMinimumHeight(dp(60));root.addView(navigation,new LinearLayout.LayoutParams(-1,-2));
  readPush(getIntent());setContentView(root);updater=new PhoneUpdater(this);render();
 }
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPush(intent);render();}
 private void readPush(Intent intent){String route=intent.getStringExtra(PhonePush.ROUTE);intent.removeExtra(PhonePush.ROUTE);if("rain".equals(route)||"weather".equals(route)||"daily".equals(route)){selected=null;tab=route.equals("daily")?"history":"weather";returnTab=tab;dailyExpanded=route.equals("daily");}String raw=intent.getStringExtra(PhonePush.EXTRA);intent.removeExtra(PhonePush.EXTRA);if(raw==null||raw.length()>3000)return;try{selected=AlertCodec.read(new org.json.JSONObject(raw));tab="notices";returnTab="notices";}catch(org.json.JSONException ignored){}}
 private void activatePush(){if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},77);return;}PhonePush.enable(this,()->{if(!destroyed)render();});}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==77){if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)PhonePush.enable(this,()->{if(!destroyed)render();});else{PhonePush.disable(this);render();}}}
 private Typeface loadBrand(){try{return Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf");}catch(RuntimeException ignored){return Typeface.DEFAULT_BOLD;}}
 @Override protected void onResume(){super.onResume();if(updater!=null)updater.resume();}
 @Override protected void onStart(){super.onStart();PhonePlaceAlerts.sync(this);active=true;generation++;if(map!=null&&selected==null&&tab.equals("map"))map.resume();if(rainMap!=null&&selected==null&&tab.equals("rain"))rainMap.resume();if(brazilMap!=null&&selected==null&&tab.equals("brazil"))brazilMap.resume();if(automaticRefresh())main.post(pulse);}
 @Override protected void onStop(){if(quakeVolumeDialog!=null)quakeVolumeDialog.dismiss();rememberScroll();if(siteImage!=null){siteImage.cancel();siteImage=null;}active=false;generation++;refreshing=false;detailLoading=false;nextDetailAttempt=nextDailyAttempt=0;main.removeCallbacks(pulse);if(repository!=null)repository.cancel();if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(brazilMap!=null)brazilMap.pause();if(briefing!=null)briefing.pause();super.onStop();}
 @Override protected void onDestroy(){destroyed=true;active=false;if(updater!=null)updater.close();if(briefing!=null)briefing.close();generation++;main.removeCallbacksAndMessages(null);if(repository!=null)repository.close();if(worker!=null)worker.shutdownNow();if(map!=null){map.close();map=null;}if(rainMap!=null){rainMap.close();rainMap=null;}if(brazilMap!=null){brazilMap.close();brazilMap=null;}clearFlags();super.onDestroy();}
 @Override protected void onSaveInstanceState(Bundle out){rememberScroll();out.putBoolean("hourlyRainExpanded",hourlyRainExpanded);out.putString("tab",tab);out.putString("returnTab",returnTab);out.putString("mapFilter",mapFilter);out.putString("quakeRegion",quakeRegion);out.putString("mapReturnTab",mapReturnTab);out.putString("settingsReturnTab",settingsReturnTab);out.putString("advancedReturnTab",advancedReturnTab);if(mappedEvent!=null)try{out.putString("mappedEvent",AlertCodec.write(mappedEvent).toString());}catch(org.json.JSONException ignored){}out.putStringArrayList("scrollKeys",new ArrayList<>(scrollPositions.keySet()));out.putIntegerArrayList("scrollPositions",new ArrayList<>(scrollPositions.values()));if(selected!=null)try{out.putString("selected",AlertCodec.write(selected).toString());}catch(org.json.JSONException ignored){}super.onSaveInstanceState(out);}
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
   String target=ids[i];boolean current=target.equals(shown);int color=current?AMBER:MUTED;
   LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setGravity(Gravity.CENTER);item.setMinimumHeight(dp(60));item.setPadding(0,dp(5),0,dp(5));
   item.setTag("tab-"+target);item.setContentDescription(labels[i]);item.setSelected(current);item.setFocusable(true);
   item.setBackground(ripple(BODY,false));
   FrameLayout indicator=new FrameLayout(this);
   if(current){
    indicator.setBackground(surface(0xff34302a,0xff24252a,0xff5d4d38,14));
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
 private GradientDrawable surface(int top,int bottom,int edge,int radius){
  GradientDrawable shape=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{top,bottom});
  shape.setCornerRadius(dp(radius));if(edge!=0)shape.setStroke(dp(1),edge);
  return shape;
 }
 private android.graphics.drawable.Drawable glass(){return surface(0xff142936,0xff0c1a25,0xff293e49,18);}
 private LinearLayout card(LinearLayout page,String caption){Panel panel=new Panel(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackground(glass());LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(16);page.addView(panel,lp);TextView h=text(caption,12,AMBER,3);h.setLetterSpacing(.06f);h.setPadding(dp(16),dp(16),dp(16),0);panel.addView(h,new LinearLayout.LayoutParams(-1,-2));return panel;}
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
  space(page,primaryButton("Abrir mapa de previsão · 24 h",()->openLayer("brazil")),0);
  hourlyCard(page);weatherCard(page,true);rainCard(page,true);
  space(page,button("Abrir mapa de tempo severo",()->{severeRequested=true;go("brazil");}),0);
  copy(page,"Previsão para um ponto da Liberdade. No Mapa 24 h, consulte a previsão de outros municípios.");
 }
 private void layerButtons(LinearLayout box,String current){
  LinearLayout row=new LinearLayout(this);row.setPadding(dp(8),0,dp(8),0);
  String[] ids={"weather","rain","brazil"},labels={"Previsão","Chuva agora","Mapa 24 h"};
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
  long now=System.currentTimeMillis();
  List<PhoneHourly.Hour> visible=new ArrayList<>();
  for(PhoneHourly.Hour h:snapshot.hours)if(h.start>=now)visible.add(h);
  for(PhoneHourly.Hour h:visible){LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setGravity(Gravity.CENTER);cell.setPadding(dp(8),0,dp(8),0);row.addView(cell,new LinearLayout.LayoutParams(dp(98),-2));String from=WeatherForecast.time(h.start).replace(" BRT",""),to=WeatherForecast.time(h.start+3600000).replace(" BRT","");cell.addView(text(from+"–"+to,13,MUTED,2));cell.addView(new PhoneIcons(this,PhoneIcons.condition(h.condition,h.start),TEXT),new LinearLayout.LayoutParams(dp(30),dp(38)));cell.addView(text(Math.round(h.temperature)+"°C",22,TEXT,1));cell.addView(text(RainForecast.number(h.amount)+" mm/1h",12,CYAN,1));}
  if(visible.isEmpty())space(body,text("Nenhum intervalo completo disponível agora.",14,MUTED,2),8);
  else hourlyRainSummary(body,visible);
  footer(card,"Rainbow Weather · horários em Brasília. Cada coluna é o intervalo indicado, diferente dos próximos 60 minutos contados a partir de agora.");
 }
 private void hourlyRainSummary(LinearLayout body,List<PhoneHourly.Hour> hours){
  PhoneHourlyRain.Period rain=PhoneHourlyRain.mainPeriod(hours);
  if(rain==null){
   space(body,text("Sem chuva prevista nos horários exibidos.",15,MUTED,3),14);
   return;
  }
  String volume=PhoneHourlyRain.millimeters(rain.amount);
  String duration=rain.hours()==1?"1 hora":rain.hours()+" horas";
  TextView summary=text(volume+" mm em "+duration,21,AMBER,2);
  summary.setAccessibilityHeading(true);space(body,summary,14);
  String period=PhoneHourlyRain.interval(rain.start,rain.end);
  space(body,text("Sequência com maior acumulado · "+period+" BRT",13,MUTED,3),4);
  LinearLayout explanation=new LinearLayout(this);explanation.setOrientation(LinearLayout.VERTICAL);
  space(explanation,text("Maior volume da sequência · "+PhoneHourlyRain.interval(rain.peak.start,rain.peak.start+PhoneHourlyRain.HOUR)
   +" · "+PhoneHourlyRain.millimeters(rain.peak.amount)+" mm em 1 hora",14,TEXT,4),8);
  String liters=rain.amount<.05?"menos de 0,1":volume;
  space(explanation,text("Se a previsão se confirmar, são "+liters+
   " litros por m² no período. Cada 1 mm equivale a 1 litro por m².",14,TEXT,4),8);
  space(explanation,text(rain.impacts(),14,TEXT,8),8);
  space(explanation,text("Estimativa pontual do modelo. Os efeitos dependem da drenagem, do relevo e da chuva anterior. Consulte a aba Avisos para boletins oficiais.",13,MUTED,8),8);
  Button expand=button(hourlyRainExpanded?"Recolher explicação":"Entenda a chuva prevista",()->{});
  expand.setTag("hourly-rain-explanation");
  explanation.setVisibility(hourlyRainExpanded?View.VISIBLE:View.GONE);
  expand.setOnClickListener(v->{
   hourlyRainExpanded=!hourlyRainExpanded;
   explanation.setVisibility(hourlyRainExpanded?View.VISIBLE:View.GONE);
   expand.setText(hourlyRainExpanded?"Recolher explicação":"Entenda a chuva prevista");
  });
  space(body,expand,9);body.addView(explanation);
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
  Button back=button("‹ Voltar",()->{selected=null;tab=returnTab;render();});
  page.addView(back,new LinearLayout.LayoutParams(-2,-2));
  TextView detailHeading=text("Detalhes do evento",14,MUTED,1);
  detailHeading.setAccessibilityHeading(true);
  LinearLayout.LayoutParams headingSpace=new LinearLayout.LayoutParams(-1,-2);
  headingSpace.setMargins(0,dp(12),0,dp(9));page.addView(detailHeading,headingSpace);
  if(a.kind.equals("earthquake")){
   LinearLayout hero=section(card(page,"SISMO"));
   TextView mag=text(magnitude(a),56,AMBER,1);mag.setTypeface(brand);hero.addView(mag);
   LinearLayout locationRow=new LinearLayout(this);locationRow.setGravity(Gravity.CENTER_VERTICAL);
   addFlag(locationRow,a,30);
   TextView place=text(location(a),25,TEXT,5);place.setAccessibilityHeading(true);
   locationRow.addView(place,new LinearLayout.LayoutParams(0,-2,1));space(hero,locationRow,6);
  }
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
  LinearLayout explore=section(card(page,"MAPA E SUBSOLO"));
  Button mapButton=button("Ver localização no mapa",()->showMapEvent(a));
  mapButton.setEnabled(MapFrame.located(a.originLongitude,a.originLatitude));explore.addView(mapButton,new LinearLayout.LayoutParams(-1,-2));
  if(!mapButton.isEnabled())copy(explore,"Localização no mapa indisponível para este registro.");
  if(a.kind.equals("earthquake")&&mapButton.isEnabled()){
   seismicVolumeActions(explore,a);
   space(explore,button("Monitorar esta área",()->editSeismicPlace(-1,a)),8);
  }
  LinearLayout sharing=section(card(page,"COMPARTILHAR"));
  space(sharing,button("Compartilhar evento",()->share(a)),0);
  if(a.kind.equals("earthquake")&&Double.isFinite(a.magnitude)&&
    MapFrame.located(a.originLongitude,a.originLatitude)&&Math.abs(a.originLatitude)<85&&
    (a.magnitude>=6||"BR".equalsIgnoreCase(a.countryCode))){
   space(sharing,button("Compartilhar vídeo do sismo",()->prepareShare(a,true)),8);
  }
 }

 private void seismicVolumeActions(LinearLayout parent,Alert event){
  LinearLayout actions=new LinearLayout(this);space(parent,actions,8);
  addAction(actions,primaryButton("Subsolo 3D",()->openQuakeVolume(event,false)),1);
  addAction(actions,button("Tour",()->openQuakeVolume(event,true)),1);
 }
 private void addAction(LinearLayout row,View action,float weight){
  LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(0,-2,weight);
  if(row.getChildCount()>0)params.setMarginStart(dp(8));
  row.addView(action,params);
 }
 private void openQuakeVolume(Alert event,boolean startTour){
  if(quakeVolumeDialog!=null)quakeVolumeDialog.dismiss();
  LinearLayout body=dialogBody();
  dialogTitle(body,"Subsolo 3D");
  TextView location=text(location(event),17,TEXT,4);
  space(body,location,10);
  TextView metrics=text(magnitude(event)+"  ·  "+depth(event),14,AMBER,3);
  space(body,metrics,6);
  PhoneQuakeVolume volume=new PhoneQuakeVolume(this,event,events());
  volume.setTag("quake-volume");
  volume.setBackground(surface(0xff0e212d,0xff08151e,0xff304650,16));
  volume.setClipToOutline(true);
  LinearLayout.LayoutParams stage=new LinearLayout.LayoutParams(-1,Math.min(dp(350),getResources().getDisplayMetrics().heightPixels*36/100));
  stage.topMargin=dp(14);body.addView(volume,stage);
  LinearLayout controls=new LinearLayout(this);space(body,controls,10);
  Button tour=primaryButton("Iniciar tour",()->{});
  Button top=button("Topo",()->{}),side=button("Corte",()->{});
  addAction(controls,tour,1.6f);addAction(controls,top,1);addAction(controls,side,1);
  Runnable play=()->{volume.toggleTour();};
  volume.setTourListener(label->tour.setText(label));
  tour.setOnClickListener(v->{top.setSelected(false);side.setSelected(false);play.run();});
  top.setOnClickListener(v->{volume.view(true);top.setSelected(true);side.setSelected(false);});
  side.setOnClickListener(v->{volume.view(false);side.setSelected(true);top.setSelected(false);});
  LinearLayout tabs=new LinearLayout(this);space(body,tabs,8);
  TextView facts=text("",14,TEXT,60);facts.setPadding(0,dp(5),0,dp(5));
  TextView nearby=text("",14,MUTED,60);nearby.setPadding(0,dp(5),0,dp(5));
  FrameLayout data=new FrameLayout(this);data.addView(facts);data.addView(nearby);
  ScrollView list=new ScrollView(this){
   @Override public boolean dispatchTouchEvent(android.view.MotionEvent event){
    int type=event.getActionMasked();
    if(type==android.view.MotionEvent.ACTION_DOWN)getParent().requestDisallowInterceptTouchEvent(true);
    else if(type==android.view.MotionEvent.ACTION_UP||type==android.view.MotionEvent.ACTION_CANCEL)getParent().requestDisallowInterceptTouchEvent(false);
    return super.dispatchTouchEvent(event);
   }
  };
  list.addView(data);space(body,list,4);list.getLayoutParams().height=dp(80);
  Button detailsTab=button("Dados do sismo",()->{}),nearbyTab=button("Sismos próximos",()->{});
  addAction(tabs,detailsTab,1);addAction(tabs,nearbyTab,1);
  java.util.function.Consumer<Boolean> selectNearby=selected->{
   detailsTab.setSelected(!selected);nearbyTab.setSelected(selected);
   facts.setVisibility(selected?View.GONE:View.VISIBLE);nearby.setVisibility(selected?View.VISIBLE:View.GONE);
   list.scrollTo(0,0);
  };
  detailsTab.setOnClickListener(v->selectNearby.accept(false));
  nearbyTab.setOnClickListener(v->selectNearby.accept(true));
  selectNearby.accept(false);
  Button shareVolume=button("Compartilhar vista 3D",()->{});
  LinearLayout exportActions=new LinearLayout(this);space(body,exportActions,8);
  addAction(exportActions,shareVolume,1);
  Button shareTour=button("Compartilhar vídeo 3D",()->{});
  addAction(exportActions,shareTour,1);
  TextView reliefStatus=text("",12,MUTED,2);
  reliefStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
  reliefStatus.setVisibility(View.GONE);space(body,reliefStatus,4);
  Runnable refreshNearby=()->{
   facts.setText(BrDates.dateTime(eventTime(event))+" · "+source(event)+"\n"+PhoneVolumeShare.coordinates(event)
    +"\n"+(volume.hasRupture()?"Ruptura publicada · USGS":"Dourado: sismo selecionado. Azul: sismos próximos."));
   List<Alert> points=volume.nearby();
   List<String> labels=new ArrayList<>();
   for(Alert a:points)labels.add(magnitude(a)+" · "+depth(a)+" · "+BrDates.dateTime(a.eventTime));
   nearby.setText(points.isEmpty()?"Sem outros registros com profundidade nesta consulta.":
    "Catálogo · até 7 dias do evento\n"+String.join("\n",labels));
  };
  refreshNearby.run();
  ScrollView panelScroll=new ScrollView(this);panelScroll.addView(body);
  android.app.AlertDialog dialog=panelDialog(panelScroll);
  quakeVolumeDialog=dialog;
  shareVolume.setOnClickListener(v->shareQuakeVolume(dialog,shareVolume,volume,event));
  Future<?>[] recording={null};
  shareTour.setOnClickListener(v->{
   shareTour.setEnabled(false);shareVolume.setEnabled(false);shareTour.setText("Gerando vídeo…");
   if(worker==null)worker=Executors.newSingleThreadExecutor();
   PhoneVolumeShare frame=new PhoneVolumeShare(volume,event,brand,PhoneVolumeVideo.WIDTH,PhoneVolumeVideo.HEIGHT);
   recording[0]=worker.submit(()->{
    Uri result=null;
    try(PhoneVolumeShare card=frame){
     result=PhoneVolumeVideo.record(this,card,percent->main.post(()->{
      if(dialog.isShowing())shareTour.setText("Vídeo · "+percent+"%");
     }));
    }catch(java.io.IOException | RuntimeException ignored){}
    Uri ready=result;
    main.post(()->{
     if(destroyed||!dialog.isShowing())return;
     recording[0]=null;shareTour.setEnabled(true);shareVolume.setEnabled(true);shareTour.setText("Compartilhar vídeo 3D");
     if(ready!=null)sendEvent(event,ready,"video/mp4");
     else Toast.makeText(this,"Não foi possível gerar o vídeo 3D neste aparelho.",Toast.LENGTH_LONG).show();
    });
   });
  });
  ExecutorService loads=Executors.newFixedThreadPool(2);
  dialog.setOnDismissListener(d->{loads.shutdownNow();if(recording[0]!=null)recording[0].cancel(true);volume.stop();if(quakeVolumeDialog==dialog)quakeVolumeDialog=null;});
  showPanel(dialog);
  if(startTour)volume.post(()->{if(dialog.isShowing())play.run();});
  if(!automaticRefresh())return;
  java.util.function.Consumer<MapFrame> loadTerrain=frame->{
   shareVolume.setEnabled(false);shareTour.setEnabled(false);
   reliefStatus.setText("Carregando o relevo para compartilhar…");
   reliefStatus.setVisibility(View.VISIBLE);
   loads.execute(()->{
    Bitmap sampled=null;
    try{sampled=PhoneQuakeData.terrain(frame);}catch(Exception ignored){}
    Bitmap image=sampled;
    main.post(()->{
     if(!dialog.isShowing()||volume.frame()!=frame){if(image!=null)image.recycle();return;}
     volume.setTerrain(image);
     if(recording[0]==null){
      shareVolume.setEnabled(true);shareTour.setEnabled(true);
     }
     reliefStatus.setText("Relevo indisponível · a exportação usa a grade geográfica.");
     reliefStatus.setVisibility(image==null?View.VISIBLE:View.GONE);
    });
   });
  };
  loadTerrain.accept(volume.frame());
  double radius=Math.min(1000,volume.radius());
  loads.execute(()->{
   try{
    String url=PhoneQuakeData.USGS+"/fdsnws/event/1/query?format=geojson&eventtype=earthquake&minmagnitude=2.5&limit=80"
     +"&latitude="+event.originLatitude+"&longitude="+event.originLongitude+"&maxradiuskm="+radius
     +"&starttime="+java.time.Instant.ofEpochMilli(event.eventTime-7*86400000L)
     +"&endtime="+java.time.Instant.ofEpochMilli(Math.min(System.currentTimeMillis(),event.eventTime+7*86400000L));
    List<Alert> more=PhoneQuakeData.catalog(url);
    main.post(()->{if(dialog.isShowing()){volume.addNearby(more);refreshNearby.run();}});
    List<List<double[]>> rupture=PhoneQuakeData.rupture(event,more);
    if(!rupture.isEmpty())main.post(()->{
     if(dialog.isShowing()){volume.setRupture(rupture);volume.addNearby(more);refreshNearby.run();loadTerrain.accept(volume.frame());}
    });
   }catch(Exception ignored){}
  });
 }
 private void shareQuakeVolume(android.app.AlertDialog dialog,Button action,PhoneQuakeVolume volume,Alert event){
  Bitmap image=PhoneVolumeShare.render(volume,event,brand);
  if(image==null){Toast.makeText(this,"Aguarde a visualização carregar.",Toast.LENGTH_SHORT).show();return;}
  action.setEnabled(false);action.setText("Preparando imagem…");
  if(worker==null)worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{
   Uri imageUri=null;
   try(java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream()){
    if(image.compress(Bitmap.CompressFormat.PNG,100,bytes))imageUri=EventShareCard.fromSite(this,bytes.toByteArray());
   }catch(java.io.IOException | RuntimeException ignored){}
   finally{image.recycle();}
   Uri ready=imageUri;
   main.post(()->{
    if(destroyed||!dialog.isShowing())return;
    action.setText("Compartilhar vista 3D");action.setEnabled(true);
    if(ready!=null)sendEvent(event,ready);
    else Toast.makeText(this,"Não foi possível preparar a vista 3D.",Toast.LENGTH_SHORT).show();
   });
  });
 }
 private void savedSeismicPlaces(LinearLayout page){
  LinearLayout card=card(page,"LUGARES SALVOS"),body=section(card);
  copy(body,"Alertas de sismos próximos a partir de M5,0. O Android consulta o catálogo USGS em segundo plano, aproximadamente a cada 30 min.");
  List<PhonePlaceAlerts.Place> places=PhonePlaceAlerts.saved(this);
  for(int i=0;i<places.size();i++){
   int index=i;PhonePlaceAlerts.Place p=places.get(i);
   space(body,button(p.name+String.format(Locale.forLanguageTag("pt-BR")," · %.0f km · M%.1f+",p.km,p.min),()->editSeismicPlace(index,null)),4);
  }
  if(places.size()<10)space(body,button("Adicionar lugar",()->editSeismicPlace(-1,null)),4);
 }
 private void editSeismicPlace(int index,Alert event){
  List<PhonePlaceAlerts.Place> places=PhonePlaceAlerts.saved(this);
  if(index>=places.size()||index<0&&places.size()>=10){
   Toast.makeText(this,"Limite de 10 lugares salvos.",Toast.LENGTH_SHORT).show();return;
  }
  PhonePlaceAlerts.Place old=index>=0?places.get(index):null;
  LinearLayout fields=dialogBody();
  dialogTitle(fields,"Lugar monitorado");
  EditText name=placeField(fields,"Nome do lugar",old!=null?old.name:event!=null?location(event):"",false);
  EditText lat=placeField(fields,"Latitude",old!=null?Double.toString(old.lat):event!=null?Double.toString(event.originLatitude):"",true);
  EditText lon=placeField(fields,"Longitude",old!=null?Double.toString(old.lon):event!=null?Double.toString(event.originLongitude):"",true);
  EditText km=placeField(fields,"Raio (10 a 1.000 km)",old!=null?Double.toString(old.km):"150",true);
  EditText min=placeField(fields,"Magnitude mínima (5,0 a 9,0)",old!=null?Double.toString(old.min):"5,0",true);
  ScrollView scroll=new ScrollView(this);scroll.addView(fields);
  android.app.AlertDialog.Builder builder=new android.app.AlertDialog.Builder(this,R.style.ArgosPanelDialog).setView(scroll)
   .setPositiveButton("Salvar",null).setNegativeButton("Cancelar",null);
  if(old!=null)builder.setNeutralButton("Remover",(dialog,which)->{places.remove(index);PhonePlaceAlerts.save(this,places);render();});
  android.app.AlertDialog dialog=builder.create();
  dialog.setOnShowListener(ignored->dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   try{
    PhonePlaceAlerts.Place p=new PhonePlaceAlerts.Place(name.getText().toString().trim(),placeNumber(lat),placeNumber(lon),
     placeNumber(km),placeNumber(min),System.currentTimeMillis());
    if(!p.valid())throw new NumberFormatException();
    if(old==null)places.add(p);else places.set(index,p);
    PhonePlaceAlerts.save(this,places);dialog.dismiss();render();
    if(!PhonePush.enabled(this)||!PhonePush.allowed(this))Toast.makeText(this,"Ative as notificações para receber alertas do lugar salvo.",Toast.LENGTH_LONG).show();
   }catch(NumberFormatException e){Toast.makeText(this,"Confira nome, coordenadas, raio e magnitude mínima.",Toast.LENGTH_LONG).show();}
  }));
  showPanel(dialog);
  if(android.location.Geocoder.isPresent()){
   Button search=button("Buscar cidade pelo nome",()->{});
   LinearLayout.LayoutParams searchSpace=new LinearLayout.LayoutParams(-1,-2);
   searchSpace.topMargin=dp(8);fields.addView(search,3,searchSpace);
   search.setOnClickListener(v->{
    String query=name.getText().toString().trim();
    if(query.length()<2){name.setError("Informe uma cidade, estado ou país");return;}
    search.setEnabled(false);
    if(worker==null)worker=Executors.newSingleThreadExecutor();
    worker.execute(()->{
     List<android.location.Address> found=findSeismicPlaces(query);
     main.post(()->{
      if(!dialog.isShowing())return;
      search.setEnabled(true);
      if(found.isEmpty()){name.setError("Cidade indisponível. Você pode informar as coordenadas.");return;}
      String[] labels=found.stream().map(a->a.getMaxAddressLineIndex()>=0?a.getAddressLine(0):a.getLocality())
       .map(label->label==null?query:label).toArray(String[]::new);
      android.app.AlertDialog choices=new android.app.AlertDialog.Builder(this,R.style.ArgosPanelDialog).setTitle("Escolha o lugar").setItems(labels,(choice,which)->{
       android.location.Address address=found.get(which);
       String title=address.getLocality();
       name.setText(title==null?query:title);
       lat.setText(Double.toString(address.getLatitude()));lon.setText(Double.toString(address.getLongitude()));
      }).setNegativeButton("Cancelar",null).create();
      showPanel(choices);
     });
    });
   });
  }
 }
 @SuppressWarnings("deprecation")
 private List<android.location.Address> findSeismicPlaces(String query){
  try{
   List<android.location.Address> rows=new android.location.Geocoder(this).getFromLocationName(query,5);
   if(rows!=null){rows=new ArrayList<>(rows);rows.removeIf(address->!address.hasLatitude()||!address.hasLongitude());return rows;}
  }catch(Exception ignored){}
  return Collections.emptyList();
 }
 private EditText placeField(LinearLayout fields,String label,String value,boolean number){
  TextView caption=text(label,13,AMBER,3);space(fields,caption,12);
  EditText input=new EditText(this);input.setSingleLine(true);input.setContentDescription(label);
  input.setInputType(number?android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_SIGNED|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL:android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS);
  input.setText(value);input.setTextColor(TEXT);input.setTextSize(16);
  input.setBackground(surface(0xff162b37,0xff101e29,0xff40545f,10));
  input.setMinHeight(dp(48));input.setPadding(dp(12),dp(8),dp(12),dp(8));
  space(fields,input,5);return input;
 }
 private double placeNumber(EditText input){return Double.parseDouble(input.getText().toString().trim().replace(',','.')); }

 private void showSeismicContext(Alert a){
  LinearLayout body=dialogBody();
  dialogTitle(body,"Entenda este sismo");
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
  android.app.AlertDialog dialog=panelDialog(scroll);
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
  showPanel(dialog);
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
 private void refreshCivilAlerts(boolean force){
  long now=System.currentTimeMillis();
  if(!active||destroyed||!automaticRefresh()||civilLoading||!force&&now<civilNextCheck)return;
  civilLoading=true;civilNextCheck=now+60_000;
  if(worker==null)worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{
   DefesaCivilSp result;
   try{result=DefesaCivilSp.read();}catch(java.io.IOException|org.json.JSONException e){result=null;}
   final DefesaCivilSp checked=result;
   main.post(()->{
    civilLoading=false;
    if(destroyed)return;
    civilAlerts=checked;
    if(active&&tab.equals("notices")&&selected==null)render();
   });
  });
 }
 private void civilAlertsCard(LinearLayout page){
  LinearLayout card=card(page,"DEFESA CIVIL · SÃO PAULO CAPITAL"),body=section(card);
  long now=System.currentTimeMillis();
  if(civilAlerts==null||!civilAlerts.fresh(now)){
   body.addView(text(civilLoading?"Consultando avisos oficiais…":"Consulta de avisos oficiais indisponível.",15,MUTED,3));
  }else{
   int shown=0;
   for(DefesaCivilSp.Notice notice:civilAlerts.notices){
    if(notice.expires<=now)continue;
    if(++shown>5)break;
    body.addView(text(notice.level(),18,AMBER,2));
    body.addView(text(notice.message,16,TEXT,12));
    space(body,text(notice.issuer+" · "+BrDates.dateTime(notice.sent)+" · válido até "+BrDates.dateTime(notice.expires),12,MUTED,4),6);
   }
   if(shown==0)body.addView(text("Nenhum aviso severo ou extremo para a capital na consulta IDAP.",15,MUTED,3));
  }
  body.addView(button("Abrir painel da Defesa Civil",()->openUrl(DefesaCivilSp.PANEL)));
 }
 private void noticesPage(LinearLayout page){
  heading(page,"Central de Alertas");refreshCivilAlerts(false);civilAlertsCard(page);alertStatus(page);
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
  savedSeismicPlaces(page);
  space(page,button("Informações técnicas e atualização do aplicativo",()->openAdvanced("settings")),6);
  page.addView(button("Abrir canal oficial no Telegram",()->openUrl("https://t.me/argosorbis")),new LinearLayout.LayoutParams(-1,-2));
 }
 private void advancedPage(LinearLayout page){
  page.addView(button("‹ Voltar",()->go(advancedReturnTab)),new LinearLayout.LayoutParams(-1,-2));
  heading(page,"Sobre e diagnóstico");
  if(top.monitorglobal.mobile.BuildConfig.DEBUG)page.addView(button("Teste de alertas Severos/Extremos no Android",()->startActivity(new Intent().setClassName(this,"top.monitorglobal.tv.AlertProbeDiagnostics"))),new LinearLayout.LayoutParams(-1,-2));
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
 private void openLayer(String target){forecastRequested=target.equals("brazil");tab=target;selected=null;render();}
 private Button backButton(String label,Runnable action){Button b=button(label,action);b.setTextSize(14);return b;}
 private void mapPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));box.addView(backButton("‹ "+(mappedEvent==null?"Sismos":"Detalhes do evento"),this::closeSeismicMap));Button filterButton=button("Filtrar eventos · "+(mapFilter.equals("all")?"Todos":mapFilter.equals("earthquake")?"Sismos":"Tsunamis")+(mapFiltersExpanded?"  ▴":"  ▾"),()->{mapFiltersExpanded=!mapFiltersExpanded;render();});filterButton.setTag("map-show-filters");filterButton.setTextSize(14);filterButton.setMinHeight(dp(36));filterButton.setMinimumHeight(dp(36));box.addView(filterButton,new LinearLayout.LayoutParams(-1,-2));LinearLayout filters=new LinearLayout(this);filters.setPadding(dp(8),0,dp(8),dp(3));if(mapFiltersExpanded)box.addView(filters,new LinearLayout.LayoutParams(-1,-2));String[] names={"Todos","Sismos","Tsunami"},ids={"all","earthquake","tsunami"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{mapFilter=id;render();});b.setSelected(mapFilter.equals(id));b.setTextColor(mapFilter.equals(id)?CYAN:MUTED);b.setMinHeight(dp(38));b.setMinimumHeight(dp(38));b.setPadding(dp(4),dp(2),dp(4),dp(2));b.setTextSize(14);filters.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
  if(map==null)map=new PhoneMapView(this,this::showEvent);if(map.getParent()!=null)((ViewGroup)map.getParent()).removeView(map);box.addView(map,new LinearLayout.LayoutParams(-1,0,1));List<Alert> visible=new ArrayList<>();for(Alert a:events())if(mapFilter.equals("all")||mapFilter.equals(a.kind))visible.add(a);if(mappedEvent!=null&&visible.stream().noneMatch(a->a.id.equals(mappedEvent.id)))visible.add(0,mappedEvent);map.setEvents(visible);if(mappedEvent!=null&&"earthquake".equals(mappedEvent.kind)&&MapFrame.located(mappedEvent.originLongitude,mappedEvent.originLatitude))seismicVolumeActions(box,mappedEvent);if(focusMappedEvent&&mappedEvent!=null){focusMappedEvent=false;map.focus(mappedEvent);}if(active)map.resume();else map.pause();
 }
 private void rainPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));layerButtons(box,"rain");
  if(snapshot!=null)briefingCard(box,"rain",snapshot.weather,snapshot.rain);
  if(rainMap==null)rainMap=new PhoneMapView(this,null,true);if(rainMap.getParent()!=null)((ViewGroup)rainMap.getParent()).removeView(rainMap);box.addView(rainMap,new LinearLayout.LayoutParams(-1,0,1));if(active)rainMap.resume();else rainMap.pause();
 }
 private void brazilPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));layerButtons(box,"brazil");
  if(brazilMap==null)brazilMap=new PhoneMapView(this,null,false,true);if(brazilMap.getParent()!=null)((ViewGroup)brazilMap.getParent()).removeView(brazilMap);box.addView(brazilMap,new LinearLayout.LayoutParams(-1,0,1));if(active)brazilMap.resume();else brazilMap.pause();if(severeRequested){severeRequested=false;forecastRequested=false;brazilMap.showSevere();}else if(forecastRequested){forecastRequested=false;brazilMap.showForecast();}
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
 private Button button(String value,Runnable action){return actionButton(value,action,false);}
 private Button primaryButton(String value,Runnable action){return actionButton(value,action,true);}
 private Button actionButton(String value,Runnable action,boolean primary){
  Button button=new Button(this);
  button.setText(value);button.setAllCaps(false);button.setTextSize(15);
  button.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
  button.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},
   new int[]{0xffa6b2ba,primary?0xff21170c:TEXT}));
  button.setMinHeight(dp(48));button.setMinimumHeight(dp(48));
  button.setPadding(dp(10),dp(8),dp(10),dp(8));
  android.graphics.drawable.StateListDrawable states=new android.graphics.drawable.StateListDrawable();
  states.addState(new int[]{-android.R.attr.state_enabled},surface(0xff1b2731,0xff17222b,0xff32404b,12));
  states.addState(new int[]{android.R.attr.state_focused},primary?surface(0xffffe2a5,0xffddac60,Color.WHITE,12):surface(0xff264553,0xff132d3a,CYAN,12));
  states.addState(new int[]{android.R.attr.state_selected},surface(0xff32444b,0xff26343b,AMBER,12));
  states.addState(new int[]{},primary?surface(0xfff9d99e,0xffc89549,0xfff2d597,12):surface(0xff1a303e,0xff11232f,0xff344b58,12));
  button.setStateListAnimator(null);
  button.setBackground(new RippleDrawable(ColorStateList.valueOf(primary?0x44382510:0x3c9ed7e7),states,pill(Color.WHITE)));
  button.setOnClickListener(v->action.run());return button;
 }
 private LinearLayout dialogBody(){
  LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);
  body.setPadding(dp(16),dp(16),dp(16),dp(8));return body;
 }
 private TextView dialogTitle(LinearLayout body,String title){
  TextView header=text(title,26,TEXT,3);header.setAccessibilityHeading(true);body.addView(header);return header;
 }
 private android.app.AlertDialog panelDialog(View content){
  return new android.app.AlertDialog.Builder(this,R.style.ArgosPanelDialog)
   .setView(content).setPositiveButton("Fechar",null).create();
 }
 private void showPanel(android.app.AlertDialog dialog){
  dialog.show();
  Window window=dialog.getWindow();if(window==null)return;
  window.setBackgroundDrawable(surface(0xff152b38,0xff0b1722,0xff46525a,22));
  window.setDimAmount(.72f);
  window.setLayout(Math.min(dp(540),getResources().getDisplayMetrics().widthPixels-dp(24)),
   WindowManager.LayoutParams.WRAP_CONTENT);
  for(int which:new int[]{android.app.AlertDialog.BUTTON_POSITIVE,android.app.AlertDialog.BUTTON_NEGATIVE,android.app.AlertDialog.BUTTON_NEUTRAL}){
   Button action=dialog.getButton(which);
   if(action!=null){action.setAllCaps(false);action.setTextColor(which==android.app.AlertDialog.BUTTON_POSITIVE?AMBER:MUTED);}
  }
  if(android.animation.ValueAnimator.areAnimatorsEnabled()){
   View decor=window.getDecorView();
   decor.setAlpha(0f);decor.setTranslationY(dp(8));
   decor.animate().alpha(1).translationY(0).setDuration(180)
    .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
  }
 }
 private android.graphics.drawable.Drawable ripple(int color){return ripple(color,true);}
 private android.graphics.drawable.Drawable ripple(int color,boolean outline){
  GradientDrawable shape=pill(color);if(outline)shape.setStroke(dp(1),0xff244a62);
  return new RippleDrawable(ColorStateList.valueOf(0x5038bdf8),shape,pill(Color.WHITE));
 }
 private void space(LinearLayout parent,View child,int margin){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(margin);parent.addView(child,p);}
 private final class Panel extends LinearLayout {private final Path clip=new Path();Panel(android.content.Context c){super(c);}@Override protected void onSizeChanged(int w,int h,int ow,int oh){super.onSizeChanged(w,h,ow,oh);clip.reset();float r=dp(18);clip.addRoundRect(0,0,w,h,r,r,Path.Direction.CW);}@Override public void draw(Canvas c){int save=c.save();c.clipPath(clip);super.draw(c);c.restoreToCount(save);}}
}



