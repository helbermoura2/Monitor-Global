package top.monitorglobal.tv;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
public class WeatherAiInfoTest {
 final long now=System.currentTimeMillis();

 @org.junit.Before public void clear(){
  org.robolectric.RuntimeEnvironment.getApplication()
   .getSharedPreferences("weather-ai",0).edit().clear().commit();
 }

 private String response(String kind,String status,String text)throws Exception{
  return new JSONObject().put("version","weather-briefing-v1")
   .put("area","liberdade").put("status",status).put("kind",kind)
   .put("model",WeatherBriefing.MODEL).put("generatedAt",now-1000)
   .put("expiresAt",now+240000).put("dataAt",now-10000)
   .put("referenceAt",now-30000).put("text",text).toString();
 }
 private boolean contains(View v,String needle){
  if(v instanceof TextView&&((TextView)v).getText().toString().contains(needle))return true;
  if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)
   if(contains(((ViewGroup)v).getChildAt(i),needle))return true;
  return false;
 }
 @Test public void recognizedStatusesExplainWhyAiDoesNotShow()throws Exception{
  assertTrue(WeatherAiStatus.describe(response("hourly","not_applicable",""),"hourly",now).contains("Não há nada"));
  assertTrue(WeatherAiStatus.describe(response("hourly","limited",""),"hourly",now).contains("franquia"));
  assertTrue(WeatherAiStatus.describe(response("rain","unavailable",""),"rain",now).contains("indisponível"));
  assertTrue(WeatherAiStatus.pending(response("rain","pending","")));
  assertFalse(WeatherAiStatus.pending("{}"));
 }
 @Test public void onlyValidatedReadyReportsAreShown()throws Exception{
  String good=response("hourly","ready","Previsão de ar muito úmido; isso não confirma chuva.");
  assertTrue(WeatherAiStatus.describe(good,"hourly",now).contains("Previsão de ar muito úmido"));
  assertFalse(WeatherAiStatus.describe(good,"rain",now).contains("Previsão de ar muito úmido"));
  // JSONObject may escape the slashes in @cf/meta/..., so mutating raw
  // JSON with String.replace can accidentally leave a VALID model behind.
  String unknownModel=new JSONObject(good).put("model","invented-model").toString();
  String injectedMarkup=new JSONObject(good).put("text","<b>Previsão de ar muito úmido").toString();
  assertFalse(WeatherAiStatus.describe(unknownModel,"hourly",now).contains("Previsão de ar muito úmido"));
  assertFalse(WeatherAiStatus.describe(injectedMarkup,"hourly",now).contains("<b>"));
  assertTrue(WeatherAiStatus.describe(good,"hourly",now+360000).contains("não está válida"));
  assertTrue(WeatherAiStatus.describe("<html>","hourly",now).contains("JSON válido"));
 }
 @Test public void remoteControlHasExplanationAndExplicitManualButtons(){
  WeatherAiInfoActivity a=Robolectric.buildActivity(WeatherAiInfoActivity.class).setup().get();
  View root=a.getWindow().getDecorView();
  assertTrue(contains(root,"O que a IA realmente faz"));
  assertTrue(contains(root,"Consultar análise de IA · tempo na Liberdade"));
  assertTrue(contains(root,"Consultar análise de IA · chuva na Liberdade"));
  assertTrue(contains(root,"Não é um chat"));
  assertTrue(contains(root,"Voltar às configurações"));
  assertTrue(contains(root,"Sem destaque recente válido"));
  assertNotNull(root.findFocus());
  a.finish();
 }
}
