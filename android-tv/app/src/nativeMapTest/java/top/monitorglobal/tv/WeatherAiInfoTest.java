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
 @Test public void backendReasonExplainsTheActualProblemAndNeverLeaksMessages()throws Exception{
  String original=response("hourly","unavailable","");
  JSONObject json=new JSONObject(original);
  assertTrue(WeatherAiStatus.describe(json.put("reason","source-unavailable").toString(),"hourly",now).contains("previsão meteorológica não chegou"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","source-stale-or-invalid").toString(),"hourly",now).contains("vencida ou incompleta"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","model-unconfigured").toString(),"hourly",now).contains("não está configurado"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","model-timeout").toString(),"hourly",now).contains("limite de tempo"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","invalid-selection").toString(),"hourly",now).contains("rejeitado"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","storage-unavailable").toString(),"hourly",now).contains("armazenamento"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","service-unavailable").toString(),"hourly",now).contains("serviço interno"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","unknown-value").toString(),"hourly",now).contains("não informou a causa"));
  assertTrue(WeatherAiStatus.describe(json.put("reason","model-error").put("providerCode","3018").toString(),"hourly",now).contains("3018"));
  assertFalse(WeatherAiStatus.describe(json.put("providerCode","PRIVATE_SECRET").toString(),"hourly",now).contains("PRIVATE_SECRET"));
 }
 @Test public void reportsPrimaryGeminiAndCloudflareBackupOnlyForValidatedContent()throws Exception{
  String source=response("hourly","ready","O ar está muito úmido.");
  String gemini=new JSONObject(source).put("model",WeatherBriefing.GEMINI_MODEL).toString();
  String fallback=new JSONObject(source).put("model",WeatherBriefing.MODEL).toString();
  assertTrue(WeatherAiStatus.describe(gemini,"hourly",now).contains("Gemini Flash"));
  assertTrue(WeatherAiStatus.describe(fallback,"hourly",now).contains("Cloudflare Workers AI (reserva)"));
  String invented=new JSONObject(source).put("model","not-a-model").toString();
  assertFalse(WeatherAiStatus.describe(invented,"hourly",now).contains("O ar está muito úmido."));
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
  assertTrue(contains(root,"ARGOS ORBIS TV"));
  assertFalse(contains(root,"MONITOR GLOBAL TV"));
  assertTrue(contains(root,"SOBRE A ANÁLISE"));
  assertTrue(contains(root,"Tempo · Liberdade"));
  assertTrue(contains(root,"Chuva · Liberdade"));
  assertTrue(contains(root,"Não é um chat"));
  assertTrue(contains(root,"Voltar"));
  assertTrue(contains(root,"Sem destaque recente válido"));
  assertNotNull(root.findFocus());
  a.finish();
 }
 @Test @Config(sdk=35,qualifiers="w960dp-h540dp-land-mdpi")
 public void compactTvButtonsRemainInsideScreen(){
  org.robolectric.android.controller.ActivityController<WeatherAiInfoActivity> controller=Robolectric.buildActivity(WeatherAiInfoActivity.class).setup();
  WeatherAiInfoActivity a=controller.get();
  try{
   ViewGroup content=a.findViewById(android.R.id.content);
   int w=960,h=540;
   content.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));content.layout(0,0,w,h);
   java.util.List<Button> buttons=new java.util.ArrayList<>();collect(content,buttons);
   assertEquals(4,buttons.size());
   for(Button b:buttons){
    android.graphics.Rect r=new android.graphics.Rect();assertTrue(b.getGlobalVisibleRect(r));assertTrue(b.getText().toString(),r.height()>=b.getHeight()-1&&r.width()>=b.getWidth()-1);assertTrue(b.isFocusable());
   }
   assertEquals(buttons.get(1).getId(),buttons.get(0).getNextFocusRightId());
   assertEquals(buttons.get(3).getId(),buttons.get(2).getNextFocusRightId());
  }finally{controller.pause().stop().destroy();}
 }
 private void collect(View v,java.util.List<Button> out){if(v instanceof Button)out.add((Button)v);if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)collect(((ViewGroup)v).getChildAt(i),out);}
}
