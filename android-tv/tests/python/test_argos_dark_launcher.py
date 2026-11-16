"""Check the two launchers use the same dark Argos Orbis option-3 artwork."""
from pathlib import Path
import unittest
import re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[3]
A="{http://schemas.android.com/apk/res/android}"
APT="{http://schemas.android.com/aapt}"

class DarkArgosLauncher(unittest.TestCase):
 def read_icon(self,app):
  file=ROOT/app/"app/src/main/res/drawable/ic_launcher_monitor.xml"
  return file.read_bytes(),ET.parse(file).getroot()

 def test_tv_and_phone_have_identical_opaque_dark_launcher(self):
  tv_content,tv=self.read_icon("android-tv")
  mobile_content,mobile=self.read_icon("android-mobile")
  self.assertEqual(tv_content,mobile_content,"Both apps must share one approved option-3 icon")
  self.assertTrue(tv.tag.endswith("vector"))
  background=tv.find("path")
  self.assertIsNotNone(background)
  self.assertEqual(background.get(A+"pathData"),"M0,0H128V128H0Z")
  fill=background.find(APT+"attr")
  self.assertIsNotNone(fill)
  gradient=fill.find("gradient")
  self.assertIsNotNone(gradient)
  self.assertEqual(gradient.get(A+"type"),"radial")
  colors=[c.get(A+"color") for c in gradient.findall("item")]
  self.assertIn("#010304",colors,"Launcher background must be near black")
  self.assertIn("#084746",colors,"Preserve the subtle teal spotlight")
  self.assertEqual(len(colors),4)
  xml=tv_content.decode()
  self.assertIn("#EDC782",xml,"Gold outer eye must be visible")
  self.assertIn("#14E9E0",xml,"Cyan radar must be visible")
  self.assertNotIn("#FFFFFF",xml,"No white launcher background")

 def test_tv_banner_matches_new_icon_background(self):
  banner=(ROOT/"android-tv/app/src/main/res/drawable/tv_banner.xml")
  content=banner.read_text()
  root=ET.parse(banner).getroot()
  self.assertIsNotNone(root.find("path/"+APT+"attr/gradient"))
  self.assertIn("#010304",content)
  self.assertIn("ARGOS / ORBIS",content)

 def test_versions_increment_but_package_id_and_animated_header_stay(self):
  tv=(ROOT/"android-tv/app/build.gradle").read_text()
  mobile=(ROOT/"android-mobile/app/build.gradle").read_text()
  self.assertIn("versionCode 10105",tv)
  mobile_version=re.search(r"versionCode\s+(\d+)",mobile)
  self.assertIsNotNone(mobile_version)
  self.assertGreaterEqual(int(mobile_version.group(1)),24,"Phone releases must not be pinned to a stale TV test")
  self.assertIn("applicationId 'top.monitorglobal.tv.preview'",tv)
  self.assertIn("applicationId 'top.monitorglobal.mobile'",mobile)
  activity=(ROOT/"android-mobile/app/src/main/java/top/monitorglobal/tv/PhoneActivity.java").read_text()
  self.assertIn("new RadarLogoView(this)",activity,"In-app animated logo must be kept")
if __name__=="__main__":unittest.main()
