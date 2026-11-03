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
 public static class LocalActivity extends PhoneActivity {@Override protected boolean automaticRefresh(){return false;}}
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
  for(String id:new String[]{"home","map","weather","notices"}){View nav=root().findViewWithTag("tab-"+id);assertNotNull(nav);assertTrue(nav.getHeight()>=48);assertTrue(nav.getBottom()<=800);}
  export("home");root().findViewWithTag("tab-weather").performClick();layout();String weather=texts(root());assertTrue(weather.contains("2,5 mm"));assertTrue(weather.contains("~25 min"));assertTrue(weather.contains("6,0 mm/h no início previsto"));assertTrue(weather.contains("~40 min a partir de agora"));assertTrue(weather.contains("Modelo horário"));export("weather");
 }
 @Test public void unknownValuesStayUnknownAndAvisosExplainTheForegroundScope(){
  layout();String empty=texts(root());assertTrue(empty.contains("Consultando previsão horária"));assertFalse(empty.contains("18°C"));root().findViewWithTag("tab-notices").performClick();layout();String notices=texts(root());assertTrue(notices.contains("enquanto o aplicativo está aberto"));assertTrue(notices.contains("canal oficial"));assertNotNull(named(root(),"Abrir canal oficial no Telegram"));
  Alert unknown=new Alert("unknown","earthquake","v","M5,1 · Oceano Pacífico","","earthquake",1,0,false);unknown.magnitude=5.1;activity.applySnapshot(new PhoneRepository.Snapshot(List.of(unknown),null,null,0,"Sem atualização confirmada","Previsão indisponível","Chuva indisponível",true,true,false));root().findViewWithTag("event-unknown").performClick();layout();assertTrue(texts(root()).contains("Profundidade não informada"));assertTrue(texts(root()).contains("Data indisponível"));assertTrue(texts(root()).contains("Fonte não informada"));assertFalse(named(root(),"Ver localização no mapa").isEnabled());assertFalse(texts(root()).contains("0 km"));
 }
 @Test public void eventDetailsShareTheSelectedRecordAndBackReturnsToThePreviousTab()throws Exception{
  activity.applySnapshot(data());root().findViewWithTag("event-sample").performClick();layout();String details=texts(root());assertTrue(details.contains("Detalhes do evento"));assertTrue(details.contains("Profundidade: 12 km"));assertTrue(details.contains("Fonte: EXEMPLO"));assertTrue(details.contains("Danos: sem informação"));export("event");
  named(root(),"Compartilhar evento").performClick();Intent chooser=Shadows.shadowOf(activity).getNextStartedActivity();assertEquals(Intent.ACTION_CHOOSER,chooser.getAction());Intent send=chooser.getParcelableExtra(Intent.EXTRA_INTENT);assertEquals(Intent.ACTION_SEND,send.getAction());assertTrue(send.getStringExtra(Intent.EXTRA_TEXT).contains("Kathmandu"));activity.onBackPressed();assertTrue(texts(root()).contains("Seu monitor, em um só lugar"));
 }
 @Test public void noThreatBulletinDoesNotTurnIntoAWarningAndSelectionSurvivesSavedState(){
  Alert bulletin=new Alert("info","tsunami","v","Sem ameaça segundo o boletim · Costa citada","Boletim informativo","noThreat",1800000000000L,1800000000000L,false);bulletin.source="EXEMPLO";activity.applySnapshot(new PhoneRepository.Snapshot(List.of(bulletin),null,null,0,"Eventos salvos","Sem previsão","Sem previsão",true,true,true));root().findViewWithTag("event-info").performClick();assertTrue(texts(root()).contains("Sem ameaça segundo o boletim"));assertFalse(texts(root()).contains("Aviso de tsunami"));Bundle saved=new Bundle();controller.saveInstanceState(saved).pause().stop().destroy();controller=Robolectric.buildActivity(LocalActivity.class).create(saved).start().resume().visible();activity=controller.get();layout();assertTrue(texts(root()).contains("Sem ameaça segundo o boletim"));
 }
 @Test public void foregroundRefreshPreservesTheCurrentScrollPosition(){
  PhoneRepository.Snapshot fixture=data();List<Alert> list=new ArrayList<>();for(int i=0;i<8;i++){Alert a=new Alert("q"+i,"earthquake","v","M5,4 · Região de Kathmandu, Nepal","","earthquake",1800000000000L,1800000000000L,true);a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";list.add(a);}PhoneRepository.Snapshot longer=new PhoneRepository.Snapshot(list,fixture.weather,fixture.rain,fixture.refreshedAt,fixture.feedStatus,fixture.weatherStatus,fixture.rainStatus,false,true,true);
  activity.applySnapshot(longer);layout();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();ScrollView first=scroll(root());assertNotNull(first);assertTrue("visible phone content must be attached",first.isAttachedToWindow());first.scrollTo(0,150);int position=first.getScrollY();assertTrue(position>0);
  activity.applySnapshot(longer);layout();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(scroll(root()).isAttachedToWindow());assertEquals(position,scroll(root()).getScrollY());
 }
}
