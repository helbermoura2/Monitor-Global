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
}
