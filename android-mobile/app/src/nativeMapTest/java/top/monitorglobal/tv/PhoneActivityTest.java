package top.monitorglobal.tv;

import android.content.Intent;
import android.graphics.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.util.*;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;

/** Native phone layout and navigation, with local fixtures and no network. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w360dp-h800dp-port-mdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PhoneActivityTest {
 public static class LocalActivity extends PhoneActivity {@Override protected boolean automaticRefresh(){return false;} @Override void shareSiteCard(Alert event){
  Bitmap sample=Bitmap.createBitmap(1080,1920,Bitmap.Config.ARGB_8888);
  try(java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream()){
   sample.compress(Bitmap.CompressFormat.PNG,100,output);
   sendEvent(event,EventShareCard.fromSite(this,output.toByteArray()));
  }catch(java.io.IOException e){throw new AssertionError(e);}
  finally{sample.recycle();}
 }}
 private ActivityController<LocalActivity> controller;private LocalActivity activity;
 @Before public void setup(){controller=Robolectric.buildActivity(LocalActivity.class).create().start().resume().visible();activity=controller.get();}
 @After public void cleanup(){controller.pause().stop().destroy();}
 private Alert quake(){Alert a=new Alert("sample","earthquake","v","M5,4 · Região de Kathmandu, Nepal","Profundidade: 12 km · EXEMPLO","earthquake",1800000000000L,1800000000000L,true);a.countryCode="NP";a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";a.originLatitude=27.7;a.originLongitude=85.3;return a;}
 private PhoneRepository.Snapshot data(){long now=System.currentTimeMillis();WeatherForecast.Summary w=new WeatherForecast.Summary("18°C · sensação 19°C","Nublado","Vento 9 km/h · rajadas 19 km/h","Umidade 92%","Modelo horário · ref. 19:00 BRT · gerado 19:17 BRT",now+600000,false,"18°C","19°C","92%","9 km/h","19 km/h","Cloudy");RainForecast.Summary r=new RainForecast.Summary("soon","fraca","Chuva prevista em ~15 min",0,2.5,"Pode terminar em ~40 min a partir de agora",now,now+600000,false,15,40,25,6,"Duração estimada: ~25 min");return new PhoneRepository.Snapshot(List.of(quake()),w,r,now,"Eventos atualizados","Modelo horário · Liberdade, SP","Previsão por minuto · Liberdade, SP",false,true,true);}
 private View root(){return activity.getWindow().getDecorView();}
 private void layout(){View root=root();root.measure(View.MeasureSpec.makeMeasureSpec(360,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(800,View.MeasureSpec.EXACTLY));root.layout(0,0,360,800);}
 private String texts(View v){if(v instanceof TextView)return ((TextView)v).getText().toString();StringBuilder out=new StringBuilder();if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)out.append(texts(((ViewGroup)v).getChildAt(i))).append(" ");return out.toString();}
 private TextView named(View v,String value){if(v instanceof TextView&&((TextView)v).getText().toString().equals(value))return (TextView)v;if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){TextView match=named(((ViewGroup)v).getChildAt(i),value);if(match!=null)return match;}return null;}
 private ScrollView scroll(View v){if(v instanceof ScrollView)return (ScrollView)v;if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){ScrollView match=scroll(((ViewGroup)v).getChildAt(i));if(match!=null)return match;}return null;}
 private void export(String name)throws Exception{layout();Bitmap b=Bitmap.createBitmap(360,800,Bitmap.Config.ARGB_8888);try{root().draw(new Canvas(b));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-phone-"+name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}}finally{b.recycle();}}
 @Test public void homeAndWeatherUseRealModelFieldsAndKeepNavigationVisible()throws Exception{
  activity.applySnapshot(data());layout();String home=texts(root());assertTrue(home.contains("18°C"));assertTrue(home.contains("92%"));assertTrue(home.contains("Chuva prevista em ~15 min"));assertTrue(home.contains("M5,4"));
  for(String id:new String[]{"home","sismos","weather","notices","more"}){View nav=root().findViewWithTag("tab-"+id);assertNotNull(nav);assertTrue(nav.getHeight()>=48);assertTrue(nav.getBottom()<=800);}
  export("home");root().findViewWithTag("tab-weather").performClick();layout();String weather=texts(root());assertTrue(weather.contains("2,5 mm"));assertTrue(weather.contains("~25 min"));assertTrue(weather.contains("6,0 mm/h no início previsto"));assertTrue(weather.contains("~40 min a partir de agora"));assertTrue(weather.contains("Modelo horário"));export("weather");
 }
 @Test public void unknownValuesStayUnknownAndAvisosExplainTheForegroundScope(){
  layout();String empty=texts(root());assertTrue(empty.contains("Consultando previsão horária"));assertFalse(empty.contains("18°C"));root().findViewWithTag("tab-notices").performClick();layout();String notices=texts(root());assertTrue(notices.contains("Central de Alertas"));assertFalse(notices.contains("Copiar código para teste push"));assertNull(named(root(),"Abrir canal oficial no Telegram"));
  Alert unknown=new Alert("unknown","earthquake","v","M5,1 · Oceano Pacífico","","earthquake",1,0,false);unknown.magnitude=5.1;activity.applySnapshot(new PhoneRepository.Snapshot(List.of(unknown),null,null,0,"Sem atualização confirmada","Previsão indisponível","Chuva indisponível",true,true,false));root().findViewWithTag("tab-sismos").performClick();root().findViewWithTag("event-unknown").performClick();layout();assertTrue(texts(root()).contains("Profundidade não informada"));assertTrue(texts(root()).contains("Data indisponível"));assertTrue(texts(root()).contains("Fonte não informada"));assertFalse(named(root(),"Ver localização no mapa").isEnabled());assertFalse(texts(root()).contains("0 km"));
 }
 @Test public void notificationTapOpensItsEventAndPushSetupStateIsAccurate()throws Exception{
  root().findViewWithTag("tab-notices").performClick();layout();assertTrue(texts(root()).contains("Central de Alertas"));assertNull(named(root(),"Verificar atualização do aplicativo"));named(root(),"Configurar notificações").performClick();layout();assertTrue(texts(root()).contains("Notificações desativadas"));assertTrue(named(root(),"Ativar avisos no celular").isEnabled());named(root(),"Informações técnicas e atualização do aplicativo").performClick();layout();assertNotNull(named(root(),"Verificar atualização do aplicativo"));root().findViewWithTag("tab-notices").performClick();
  Intent push=new Intent(activity,PhoneActivity.class).putExtra(PhonePush.EXTRA,AlertCodec.write(quake()).toString());activity.onNewIntent(push);layout();assertTrue(texts(root()).contains("Detalhes do evento"));assertTrue(texts(root()).contains("Kathmandu"));assertFalse(push.hasExtra(PhonePush.EXTRA));activity.onBackPressed();assertTrue(texts(root()).contains("Central de Alertas"));
 }
 @Test public void headerUsesTheOfficialAnimatedArgosMarkAcrossTabs(){
  View logo=root().findViewWithTag("argos-logo");
  assertNotNull("Argos logo must remain visible in the mobile header",logo);
  assertTrue("The mark must be the same native animated vector as TV",logo instanceof RadarLogoView);
  RadarLogoView eye=(RadarLogoView)logo;
  assertTrue(eye.getContentDescription().toString().contains("radar em movimento"));
  eye.setSweepDegrees(135f);
  assertEquals(135f,eye.getSweepDegrees(),.001f);
  layout();
  assertTrue(eye.getWidth()>0&&eye.getHeight()>0);
  root().findViewWithTag("tab-weather").performClick();
  assertSame("Navigating must not recreate or restart the header logo",eye,root().findViewWithTag("argos-logo"));
  root().findViewWithTag("tab-notices").performClick();
  assertSame(eye,root().findViewWithTag("argos-logo"));
 }
 @Test public void notificationHeaderUsesArgosOrbisWithoutPreviewSuffix(){
  // Android shows the manifest app label above BOTH live weather and seismic notifications.
  // A preview build remains identifiable through its package and in-app version only.
  assertEquals("Argos Orbis",activity.getString(top.monitorglobal.mobile.R.string.app_name));
  assertEquals("Argos Orbis",activity.getApplicationInfo().loadLabel(activity.getPackageManager()).toString());
  assertTrue(top.monitorglobal.mobile.BuildConfig.DEBUG);
  assertTrue(top.monitorglobal.mobile.BuildConfig.VERSION_NAME.endsWith("-teste"));
  assertEquals("top.monitorglobal.mobile.dev",activity.getPackageName());
 }
 @Test public void localNotificationIsExplicitlyMarkedAsATest(){
  Shadows.shadowOf((android.app.Application)activity.getApplication()).grantPermissions("android.permission.POST_NOTIFICATIONS");assertTrue(PhonePush.testLocal(activity));android.app.NotificationManager manager=activity.getSystemService(android.app.NotificationManager.class);android.service.notification.StatusBarNotification[] posted=manager.getActiveNotifications();assertEquals(1,posted.length);android.app.Notification n=posted[0].getNotification();assertEquals("seismic",n.getChannelId());assertTrue(n.extras.getCharSequence(android.app.Notification.EXTRA_TITLE).toString().contains("TESTE LOCAL"));assertTrue(n.extras.getCharSequence(android.app.Notification.EXTRA_TEXT).toString().contains("não confirma entrega pelo Firebase"));assertNotNull(n.contentIntent);manager.cancelAll();
 }
 @Test public void eventDetailsShareTheSelectedRecordAndBackReturnsToThePreviousTab()throws Exception{
  activity.applySnapshot(data());root().findViewWithTag("event-sample").performClick();layout();String details=texts(root());assertTrue(details.contains("Detalhes do evento"));assertTrue(details.contains("Profundidade: 12 km"));assertTrue(details.contains("Fonte: EXEMPLO"));assertTrue(details.contains("Danos: sem informação"));export("event");
  named(root(),"Compartilhar evento").performClick();Intent chooser=Shadows.shadowOf(activity).getNextStartedActivity();assertEquals(Intent.ACTION_CHOOSER,chooser.getAction());Intent send=chooser.getParcelableExtra(Intent.EXTRA_INTENT);assertEquals(Intent.ACTION_SEND,send.getAction());assertTrue(send.getStringExtra(Intent.EXTRA_TEXT).contains("Kathmandu"));
  assertEquals("image/png",send.getType());
  android.net.Uri image=send.getParcelableExtra(Intent.EXTRA_STREAM);
  assertNotNull(image);
  assertEquals(image,send.getClipData().getItemAt(0).getUri());
  assertTrue((send.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0);
  try(java.io.InputStream input=activity.getContentResolver().openInputStream(image)){
   Bitmap card=BitmapFactory.decodeStream(input);
   assertNotNull(card);
   assertEquals(1080,card.getWidth());
   assertEquals(1920,card.getHeight());
   card.recycle();
  }
  activity.onBackPressed();assertTrue(texts(root()).contains("Monitoramento agora"));
 }
 @Test public void quakeVolumePanelCanChangeProjectionAndClose(){
  activity.applySnapshot(data());root().findViewWithTag("event-sample").performClick();
  named(root(),"Subsolo 3D").performClick();
  android.app.AlertDialog dialog=(android.app.AlertDialog)org.robolectric.shadows.ShadowDialog.getLatestDialog();
  View stage=dialog.getWindow().getDecorView();
  assertNotNull(named(stage,"Iniciar tour"));
  TextView top=named(stage,"Topo"),side=named(stage,"Corte");
  top.performClick();assertTrue(top.isSelected());assertFalse(side.isSelected());
  side.performClick();assertTrue(side.isSelected());assertFalse(top.isSelected());
  named(stage,"Fechar").performClick();
  org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
  assertFalse(dialog.isShowing());
 }
 @Test public void seismicContextExplainsZeroDepthAndMissingBulletin(){
  Alert a=new Alert("mg","earthquake","v","M2,7 · MINAS GERAIS, Brasil","","earthquake",1,1,false);
  a.source="EMSC";a.magnitude=2.7;a.depth=0;
  activity.applySnapshot(new PhoneRepository.Snapshot(List.of(a),null,null,0,"Eventos salvos","Sem previsão","Sem previsão",true,true,true));
  root().findViewWithTag("event-mg").performClick();
  named(root(),"Entenda este sismo · análise aprofundada").performClick();
  android.app.AlertDialog dialog=(android.app.AlertDialog)org.robolectric.shadows.ShadowDialog.getLatestDialog();
  assertNotNull(dialog);
  String context=texts(dialog.getWindow().getDecorView());
  assertTrue(context.contains("arredondamento"));
  assertTrue(context.contains("medições de intensidade"));
  assertTrue(context.contains("boletim de tsunami associado"));
  assertTrue(context.contains("Dados do catálogo"));
  assertTrue(context.contains("Fonte: EMSC"));
  assertTrue(context.contains("Seleção da IA"));
  assertTrue(context.contains("Explicações científicas · Argos Orbis"));
  assertTrue(context.indexOf("Fonte: EMSC")<context.indexOf("Seleção da IA"));
  assertTrue(context.indexOf("Seleção da IA")<context.indexOf("Explicações científicas · Argos Orbis"));
  dialog.dismiss();
 }
 @Test public void noThreatBulletinDoesNotTurnIntoAWarningAndSelectionSurvivesSavedState(){
  Alert bulletin=new Alert("info","tsunami","v","Sem ameaça segundo o boletim · Costa citada","Boletim informativo","noThreat",1800000000000L,1800000000000L,false);bulletin.source="EXEMPLO";activity.applySnapshot(new PhoneRepository.Snapshot(List.of(bulletin),null,null,0,"Eventos salvos","Sem previsão","Sem previsão",true,true,true));assertNull(root().findViewWithTag("event-info"));root().findViewWithTag("tab-notices").performClick();assertNull(root().findViewWithTag("event-info"));named(root(),"Boletins e resumo diário").performClick();assertNotNull(root().findViewWithTag("event-info"));root().findViewWithTag("event-info").performClick();assertTrue(texts(root()).contains("Sem ameaça segundo o boletim"));assertFalse(texts(root()).contains("Aviso de tsunami"));Bundle saved=new Bundle();controller.saveInstanceState(saved).pause().stop().destroy();controller=Robolectric.buildActivity(LocalActivity.class).create(saved).start().resume().visible();activity=controller.get();layout();assertTrue(texts(root()).contains("Sem ameaça segundo o boletim"));
 }
 @Test public void foregroundRefreshPreservesTheCurrentScrollPosition(){
  PhoneRepository.Snapshot fixture=data();List<Alert> list=new ArrayList<>();for(int i=0;i<8;i++){Alert a=new Alert("q"+i,"earthquake","v","M5,4 · Região de Kathmandu, Nepal","","earthquake",1800000000000L,1800000000000L,true);a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";list.add(a);}PhoneRepository.Snapshot longer=new PhoneRepository.Snapshot(list,fixture.weather,fixture.rain,fixture.refreshedAt,fixture.feedStatus,fixture.weatherStatus,fixture.rainStatus,false,true,true);
  activity.applySnapshot(longer);layout();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();ScrollView first=scroll(root());assertNotNull(first);assertTrue("visible phone content must be attached",first.isAttachedToWindow());first.scrollTo(0,150);int position=first.getScrollY();assertTrue(position>0);
  activity.applySnapshot(longer);layout();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(scroll(root()).isAttachedToWindow());assertEquals(position,scroll(root()).getScrollY());
 }
 @Test public void rainPreviewLivesUnderWeatherAndKeepsTheSameViewOnRefresh()throws Exception{
  activity.applySnapshot(data());root().findViewWithTag("tab-weather").performClick();root().findViewWithTag("open-rain").performClick();layout();assertTrue(root().findViewWithTag("tab-weather").isSelected());assertNotNull(root().findViewWithTag("open-weather"));
  java.lang.reflect.Field f=PhoneActivity.class.getDeclaredField("rainMap");f.setAccessible(true);PhoneMapView rain=(PhoneMapView)f.get(activity);assertNotNull(rain);assertTrue(rain.isAttachedToWindow());activity.applySnapshot(data());layout();assertSame(rain,f.get(activity));assertTrue(rain.isAttachedToWindow());
  activity.onBackPressed();layout();assertNotNull(root().findViewWithTag("open-rain"));assertFalse(rain.isAttachedToWindow());root().findViewWithTag("open-rain").performClick();layout();assertSame(rain,f.get(activity));
 }
 @Test public void brazilExplorationPreservesTheWeatherTabAndOriginalControls(){
  root().findViewWithTag("tab-weather").performClick();layout();assertNotNull(root().findViewWithTag("open-rain"));assertNotNull(root().findViewWithTag("open-brazil"));
  root().findViewWithTag("open-brazil").performClick();layout();assertTrue(root().findViewWithTag("tab-weather").isSelected());assertNotNull(root().findViewWithTag("open-weather"));
  activity.onBackPressed();layout();assertNotNull(root().findViewWithTag("open-rain"));assertNotNull(root().findViewWithTag("open-brazil"));
 }
 @Test public void verifiedOnlineBriefingAppearsOnPhoneWithoutChangingEventNavigation()throws Exception{
  PhoneRepository.Snapshot fixture=data();long now=System.currentTimeMillis(),generated=now-60000,reference=now-120000;WeatherForecast.Summary w=new WeatherForecast.Summary("18°C","Nublado","9 km/h","92%","Modelo horário",now+600000,false,"18°C","19°C","92%","9 km/h","19 km/h","Cloudy",generated,reference);
  org.json.JSONObject ai=new org.json.JSONObject().put("version","weather-briefing-v1").put("status","ready").put("area","liberdade").put("kind","hourly").put("model",WeatherBriefing.MODEL).put("generatedAt",now).put("expiresAt",now+600000).put("dataAt",generated).put("referenceAt",reference).put("text","Na Liberdade, a previsão horária é de 18 °C. O modelo horário indica céu nublado.");activity.getSharedPreferences("weather-ai",0).edit().putString("hourly",ai.toString()).commit();activity.applySnapshot(new PhoneRepository.Snapshot(fixture.events,w,fixture.rain,now,fixture.feedStatus,fixture.weatherStatus,fixture.rainStatus,false,true,true));root().findViewWithTag("tab-weather").performClick();layout();assertTrue(texts(root()).contains("RESUMO COM IA"));assertTrue(texts(root()).contains("previsão horária é de 18 °C"));export("weather-ai");root().findViewWithTag("tab-notices").performClick();assertTrue(texts(root()).contains("Central de Alertas"));
 }

 @Test public void seismicMapRetainsTheSismosTabAndReturnsToTheOriginatingDetail(){
  activity.applySnapshot(data());root().findViewWithTag("tab-sismos").performClick();layout();
  root().findViewWithTag("open-seismic-map").performClick();layout();
  assertTrue(root().findViewWithTag("tab-sismos").isSelected());assertNotNull(root().findViewWithTag("map-show-filters"));
  activity.onBackPressed();assertNotNull(root().findViewWithTag("event-sample"));
  root().findViewWithTag("event-sample").performClick();
  named(root(),"Ver localização no mapa").performClick();layout();
  assertTrue(root().findViewWithTag("tab-sismos").isSelected());activity.onBackPressed();
  assertTrue(texts(root()).contains("Detalhes do evento"));assertTrue(texts(root()).contains("Kathmandu"));
  activity.onBackPressed();assertNotNull(root().findViewWithTag("event-sample"));
 }
 @Test public void thematicTabsKeepRecordsAndConfigurationDiscoverable()throws Exception{
  activity.applySnapshot(data());root().findViewWithTag("tab-notices").performClick();layout();
  assertNotNull(root().findViewWithTag("open-history"));root().findViewWithTag("open-tsunamis").performClick();
  assertTrue(root().findViewWithTag("tab-notices").isSelected());assertNull(root().findViewWithTag("event-sample"));
  activity.onBackPressed();assertNotNull(root().findViewWithTag("open-tsunamis"));
  root().findViewWithTag("tab-more").performClick();root().findViewWithTag("open-settings").performClick();
  assertTrue(root().findViewWithTag("tab-more").isSelected());activity.onBackPressed();
  root().findViewWithTag("open-update").performClick();assertNotNull(named(root(),"Verificar atualização do aplicativo"));
  root().findViewWithTag("tab-sismos").performClick();root().findViewWithTag("quake-region-BR").performClick();
  assertNull(root().findViewWithTag("event-sample"));root().findViewWithTag("quake-region-world").performClick();
  assertNotNull(root().findViewWithTag("event-sample"));
  export("sismos-redesign");root().findViewWithTag("tab-more").performClick();export("more-redesign");
  root().findViewWithTag("tab-notices").performClick();export("notices-redesign");
  root().findViewWithTag("tab-home").performClick();export("home-redesign");
  root().findViewWithTag("tab-weather").performClick();export("weather-redesign");
 }
 @Test public void phoneNoticeTapOpensWeatherOrCompletedDayWithoutPretendingToBeAQuake(){
  activity.onNewIntent(new Intent().putExtra(PhonePush.ROUTE,"rain"));layout();assertTrue(texts(root()).contains("Tempo na Liberdade"));assertFalse(texts(root()).contains("Detalhes do evento"));
  activity.onNewIntent(new Intent().putExtra(PhonePush.ROUTE,"daily"));layout();assertTrue(texts(root()).contains("MAIORES SISMOS · DIA ANTERIOR"));assertTrue(root().findViewWithTag("tab-notices").isSelected());
 }
 @Test public void notificationCategoriesAreIndependentAndDoNotEnablePushWithoutConsent(){
  root().findViewWithTag("tab-notices").performClick();named(root(),"Configurar notificações").performClick();layout();android.widget.Switch rain=(android.widget.Switch)root().findViewWithTag("push-category-rain");assertNotNull(rain);assertTrue(rain.isChecked());rain.setChecked(false);assertFalse(PhonePush.categoryEnabled(activity,"rain"));assertTrue(PhonePush.categoryEnabled(activity,"weather"));assertFalse(PhonePush.enabled(activity));assertNotNull(root().findViewWithTag("push-category-daily"));
 }
 @Test public void dryForecastShowsCloudCoverOnBothHomeAndWeatherInsteadOfReplacingSky(){
  long now=System.currentTimeMillis();
  WeatherForecast.Summary cloudy=new WeatherForecast.Summary("23°C","Nublado","18 km/h","67%","Modelo horário",now+600000,false,"23°C","24°C","67%","18 km/h","18 km/h","Cloudy");
  RainForecast.Summary dry=new RainForecast.Summary("dry","","Sem chuva estimada · próxima hora",0,0,"",now,now+600000,false);
  PhoneRepository.Snapshot base=data();
  activity.applySnapshot(new PhoneRepository.Snapshot(base.events,cloudy,dry,now,"Eventos atualizados","Modelo horário","Chuva por minuto",false,true,true));
  layout();String home=texts(root());assertTrue(home.contains("Nublado"));assertTrue(home.contains("Sem chuva estimada"));
  root().findViewWithTag("tab-weather").performClick();layout();String weather=texts(root());assertTrue(weather.contains("Nublado"));assertTrue(weather.contains("Sem chuva estimada"));
 }
 @Test public void weatherUsesOneMinuteRainReadingAndDoesNotCallMissingHoursDry()throws Exception{
  long now=System.currentTimeMillis();org.json.JSONArray rows=new org.json.JSONArray();for(int i=0;i<120;i++){double rate=i<10?0:i<20?.1:i<30?.5:2.4;rows.put(new org.json.JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000).put("rate",rate).put("type",rate==0?"no_precipitation":"rain"));}
  org.json.JSONObject d=new org.json.JSONObject().put("ok",true).put("version","tv-rain-v1").put("area","liberdade").put("loc",new org.json.JSONObject().put("lat",-23.555).put("lng",-46.635)).put("at",now).put("expiresAt",now+600000).put("forecast",rows);
  WeatherForecast.Summary w=new WeatherForecast.Summary("25°C","Garoa","6 km/h","57%","Modelo horário",now+3600000,false,"25°C","27°C","57%","6 km/h","11 km/h","Drizzle");PhoneRepository.Snapshot fixture=new PhoneRepository.Snapshot(List.of(),w,RainForecast.summarize(d,now),now,"Eventos atualizados","Modelo horário","Chuva por minuto",false,true,true);fixture.rainSeries=PhoneRainChart.Series.parse(d,now);activity.applySnapshot(fixture);root().findViewWithTag("tab-weather").performClick();layout();String screen=texts(root());assertTrue(screen.contains("Chuva prevista em ~10 min"));assertFalse(screen.contains("Garoa"));assertTrue(screen.contains("0,1 mm"));assertTrue(screen.contains("1,3 mm"));assertTrue(screen.contains("próximos 30 min"));assertTrue(screen.contains("próximos 60 min"));assertTrue(screen.contains("2,4 mm/h"));assertTrue(screen.contains("não significa ausência de chuva"));assertNotNull(root().findViewWithTag("retry-hourly"));assertFalse(screen.contains("PROJEÇÃO · PRÓXIMOS 30 MIN"));export("weather-consistent-rain");
 }
}


