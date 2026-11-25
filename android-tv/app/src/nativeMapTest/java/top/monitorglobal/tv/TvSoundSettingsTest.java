package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.widget.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import org.robolectric.shadows.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class TvSoundSettingsTest {
 @Before public void clear(){Prefs.get(RuntimeEnvironment.getApplication()).edit().clear().commit();}
 @After public void stop(){TvSounds.stop();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();}
 @Test public void allCategoriesHaveSeparateSwitchesAndPreviewButtons(){
  try(org.robolectric.android.controller.ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity a=controller.get();TvSoundSettings.show(a);AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertTrue(d.isShowing());for(TvSoundPattern cue:TvSoundPattern.values()){Switch toggle=d.getWindow().getDecorView().findViewWithTag("sound-category-"+cue.name());assertNotNull(toggle);assertTrue(toggle.isChecked());assertNotNull(d.getWindow().getDecorView().findViewWithTag("sound-test-"+cue.name()));}
   Switch rain=d.getWindow().getDecorView().findViewWithTag("sound-category-RAIN");rain.setChecked(false);assertFalse(TvSounds.enabled(a,TvSoundPattern.RAIN));assertTrue(TvSounds.enabled(a,TvSoundPattern.EARTHQUAKE));d.dismiss();
  }
 }
 @Test public void masterMuteAndZeroIntensityAreRespected(){Context c=RuntimeEnvironment.getApplication();assertEquals(85,TvSounds.volume(c));Prefs.get(c).edit().putBoolean("sound",false).commit();assertFalse(TvSounds.enabled(c,TvSoundPattern.TSUNAMI));Prefs.get(c).edit().putBoolean("sound",true).putInt("soundVolume",0).commit();assertFalse(TvSounds.enabled(c,TvSoundPattern.TSUNAMI));Prefs.get(c).edit().putInt("soundVolume",200).commit();assertEquals(100,TvSounds.volume(c));}
 @Test public void civilControlsPersistIndependentlyAndResetOnlyIntensity(){
  try(org.robolectric.android.controller.ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity a=controller.get();Prefs.get(a).edit().putInt("soundVolume",15).commit();
   TvSoundSettings.show(a);AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();
   android.view.View root=d.getWindow().getDecorView();
   Switch severe=root.findViewWithTag("sound-category-CIVIL_SEVERE");
   Switch extreme=root.findViewWithTag("sound-category-CIVIL_EXTREME");
   assertTrue(severe.isChecked());assertTrue(extreme.isChecked());
   severe.setChecked(false);
   assertFalse(TvSounds.enabled(a,TvSoundPattern.CIVIL_SEVERE));
   assertTrue(TvSounds.enabled(a,TvSoundPattern.CIVIL_EXTREME));
   root.findViewWithTag("sound-reset").performClick();
   assertEquals(85,TvSounds.volume(a));
   assertEquals(85,((SeekBar)root.findViewWithTag("sound-volume")).getProgress());
   assertFalse(severe.isChecked());
   root.findViewWithTag("sound-done").performClick();assertFalse(d.isShowing());
   TvSoundSettings.show(a);AlertDialog reopened=ShadowAlertDialog.getLatestAlertDialog();
   assertFalse(((Switch)reopened.getWindow().getDecorView().findViewWithTag("sound-category-CIVIL_SEVERE")).isChecked());
   reopened.dismiss();
  }
 }
}
