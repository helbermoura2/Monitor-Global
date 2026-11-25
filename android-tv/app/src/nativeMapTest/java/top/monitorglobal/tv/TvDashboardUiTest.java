package top.monitorglobal.tv;

import android.app.Activity;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ScrollView;
import android.widget.TextView;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
public class TvDashboardUiTest {
 @Before public void clear(){
  Context context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
 }
 private boolean contains(View view,String text){
  if(view instanceof TextView&&((TextView)view).getText().toString().contains(text))return true;
  if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)
   if(contains(((ViewGroup)view).getChildAt(i),text))return true;
  return false;
 }
 private int countLogo(View view){
  int n=view instanceof RadarLogoView?1:0;
  if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)n+=countLogo(((ViewGroup)view).getChildAt(i));
  return n;
 }
 @Test public void actualHomeUsesOriginalAnimatedLogoAndExplicitOverlayReplayControls(){
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  View root=app.getWindow().getDecorView();
  assertEquals("Radar Scope logo must not be replaced",1,countLogo(root));
  assertTrue(contains(root,"ARGOS ORBIS"));
  assertTrue(contains(root,"argosorbis.com.br"));
  assertTrue(contains(root,"t.me/argosorbis"));
  assertTrue(contains(root,"REPLAY E RESUMOS SÍSMICOS"));
  assertTrue(contains(root,"AVISOS REGIONAIS"));
  assertTrue(contains(root,"IA meteorológica · entender e consultar agora"));
  assertTrue(contains(root,"Replay · Último aviso regional"));
  assertTrue(contains(root,"Último replay regional"));
  assertTrue(contains(root,"SOBRE o vídeo"));
  assertTrue(contains(root,"PREFERÊNCIAS E ROTINA"));
  app.finish();
 }
 @Test public void storedValidRegionalAlertIsVisibleWithoutStartingReplay(){
  Context context=RuntimeEnvironment.getApplication();
  Alert quake=new Alert("id","earthquake","v","M5,3 · exemplo","","active",1762600000000L,
    1762600000000L,true);
  quake.compact=true;quake.magnitude=5.3;quake.depth=28;quake.targetArea="Costa do Pacífico Sul";
  Prefs.rememberTarget(context,quake);
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  assertTrue(contains(app.getWindow().getDecorView(),"Costa do Pacífico Sul"));
  app.finish();
 }
 @Test public void operationsCenterSeparatesRealReplayFromSimulationAndKeepsUpdater(){
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  View root=app.getWindow().getDecorView();
  View overview=root.findViewWithTag("page-Visão geral");
  View defense=root.findViewWithTag("page-Defesa Civil");
  View laboratory=root.findViewWithTag("page-Laboratório");
  View system=root.findViewWithTag("page-Sistema");
  assertEquals(View.VISIBLE,overview.getVisibility());
  assertEquals(View.GONE,defense.getVisibility());
  root.findViewWithTag("nav-Defesa Civil").performClick();
  assertEquals(View.VISIBLE,defense.getVisibility());
  assertEquals(View.GONE,overview.getVisibility());
  assertTrue(contains(defense,"Replay · último SEVERO recebido do celular"));
  assertTrue(contains(defense,"Replay · último EXTREMO recebido do celular"));
  assertFalse(contains(defense,"Testar aviso SEVERO"));
  root.findViewWithTag("nav-Laboratório").performClick();
  assertEquals(View.VISIBLE,laboratory.getVisibility());
  assertEquals(View.GONE,defense.getVisibility());
  assertTrue(contains(laboratory,"Testar aviso SEVERO"));
  assertTrue(contains(laboratory,"Diagnóstico · celular"));
  assertFalse(contains(laboratory,"Replay · último SEVERO recebido do celular"));
  root.findViewWithTag("nav-Sistema").performClick();
  assertEquals(View.VISIBLE,system.getVisibility());
  assertTrue(contains(system,"Verificar atualização oficial"));
  assertFalse(contains(overview,"Verificar atualização oficial"));
  app.finish();
 }
 @Test public void sidebarCanCollapseWithoutLosingCategoryAccess(){
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  View root=app.getWindow().getDecorView();
  View sidebar=root.findViewWithTag("operations-sidebar");
  int expanded=sidebar.getLayoutParams().width;
  root.findViewWithTag("sidebar-toggle").performClick();
  assertTrue(sidebar.getLayoutParams().width<expanded);
  root.findViewWithTag("nav-Meteorologia").performClick();
  assertEquals(View.VISIBLE,root.findViewWithTag("page-Meteorologia").getVisibility());
  root.findViewWithTag("sidebar-toggle").performClick();
  assertEquals(expanded,sidebar.getLayoutParams().width);
  assertEquals(View.VISIBLE,root.findViewWithTag("page-Meteorologia").getVisibility());
  app.finish();
 }
 @Test public void dashboardShowsActualStoredStatusAndVectorIcons(){
  Context context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().putString("weatherStatus","Liberdade: observação de teste 22 °C")
   .putString("brentStatus","Cotação de teste indisponível").commit();
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  View root=app.getWindow().getDecorView();
  Button weather=root.findViewWithTag("overview-Meteorologia");
  Button market=root.findViewWithTag("overview-Mercado");
  assertTrue(weather.getText().toString().contains("22 °C"));
  assertTrue(market.getText().toString().contains("indisponível"));
  assertNotNull(weather.getCompoundDrawables()[0]);
  Button system=root.findViewWithTag("nav-Sistema");
  assertNotNull(system.getCompoundDrawables()[0]);
  root.findViewWithTag("sidebar-toggle").performClick();
  assertNotNull(system.getCompoundDrawables()[1]);
  root.findViewWithTag("sidebar-toggle").performClick();
  assertNotNull(system.getCompoundDrawables()[0]);
  system.performClick();
  assertEquals(View.VISIBLE,root.findViewWithTag("page-Sistema").getVisibility());
  app.finish();
 }
 @Test public void marketCardKeepsBothQuotesAndFullSourceStatus(){
  String status="COTAÇÕES · Brent US$ 90,72 · Yahoo USD/BRL R$ 5,824 · 18:14 BRT · referência internacional";
  Prefs.get(RuntimeEnvironment.getApplication()).edit().putString("brentStatus",status).commit();
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  View root=app.getWindow().getDecorView();
  Button market=root.findViewWithTag("overview-Mercado");
  assertEquals("Mercado\nBrent US$ 90,72\nDólar (Yahoo) R$ 5,824",market.getText().toString());
  assertTrue(market.getContentDescription().toString().contains("18:14 BRT"));
  market.performClick();
  TextView detail=root.findViewWithTag("market-full-status");
  assertEquals(status,detail.getText().toString());
  assertEquals("Brent · FECHADO\nDólar · ABERTO",MainActivity.marketSummary("BRENT · FECHADO · DÓLAR · ABERTO · valores anteriores"));
  assertEquals("Brent sem preço confirmado\nUSD/BRL indisponível",MainActivity.marketSummary("COTAÇÕES · Brent sem preço confirmado · USD/BRL indisponível · referência internacional"));
  app.finish();
 }
 @Test public void collapseControlHasNoVerticalPaddingOrMinimumHeight(){
  MainActivity app=Robolectric.buildActivity(MainActivity.class).setup().get();
  Button toggle=app.getWindow().getDecorView().findViewWithTag("sidebar-toggle");
  assertEquals(0,toggle.getPaddingTop());
  assertEquals(0,toggle.getPaddingBottom());
  // TextView reports -1 when the minimum is expressed in lines rather than pixels.
  assertTrue(toggle.getMinHeight()<=0);
  assertEquals(0,toggle.getMinimumHeight());
  toggle.measure(View.MeasureSpec.makeMeasureSpec(180,View.MeasureSpec.EXACTLY),
   View.MeasureSpec.makeMeasureSpec(toggle.getLayoutParams().height,View.MeasureSpec.EXACTLY));
  assertTrue(toggle.getMeasuredHeight()>=toggle.getPaint().getFontSpacing());
  assertFalse(toggle.getIncludeFontPadding());
  toggle.performClick();
  assertEquals("›",toggle.getText().toString());
  toggle.performClick();
  assertTrue(toggle.getText().toString().contains("Recolher"));
  app.finish();
 }
}
