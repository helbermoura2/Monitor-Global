"""Guard the approved Argos Orbis TV visual identity without touching the old update package IDs."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/"android-tv/app/src/main/java/top/monitorglobal/tv"

class ArgosOrbisIdentity(unittest.TestCase):
 def test_tv_header_uses_official_brand_and_destinations(self):
  main=(SRC/"MainActivity.java").read_text(encoding="utf-8")
  self.assertIn('display("ARGOS ORBIS"',main)
  self.assertIn('argosorbis.com.br  •  t.me/argosorbis',main)
  self.assertIn('new RadarLogoView(this)',main)
  self.assertNotIn('MONITOR GLOBAL TV',main)
  self.assertIn('setTitle("Vincular Argos Orbis à Alexa")',main)
 def test_all_lower_thirds_show_one_consistent_official_footer(self):
  for file in ("NewsBannerView.java","TvBroadcastInfoView.java"):
   s=(SRC/file).read_text(encoding="utf-8")
   self.assertIn('"argosorbis.com.br":"@argosorbis"',s)
   self.assertNotIn('"monitorglobal.top":"@monitor_global"',s)
   self.assertIn("BroadcastVisuals.radar(",s)
  radar=(SRC/"BroadcastVisuals.java").read_text(encoding="utf-8")
  self.assertIn("RadarLogoView.drawArtwork(c,paint,angle,open)",radar)
  self.assertIn("BRAND_RIGHT_INSET=35f",radar)
  self.assertIn("c.rotate(sweep,64,64)",(SRC/"RadarLogoView.java").read_text(encoding="utf-8"))
 def test_launcher_brand_preserves_official_eye_and_release_compatibility(self):
  banner=(ROOT/"android-tv/app/src/main/res/drawable/tv_banner.xml").read_text(encoding="utf-8")
  self.assertIn("ARGOS / ORBIS",banner)
  self.assertNotIn("MONITOR GLOBAL",banner)
  gradle=(ROOT/"android-tv/app/build.gradle").read_text(encoding="utf-8")
  self.assertIn("versionCode 10105",gradle)
  self.assertIn("applicationId 'top.monitorglobal.tv.preview'",gradle)
  self.assertIn("app_name', 'Argos Orbis TV'",gradle)
  self.assertIn("ΠΑΝΟΠΤΗΣ",(SRC/"RadarLogoView.java").read_text(encoding="utf-8"))
if __name__=="__main__":unittest.main()
