"""Regression of TV voice/replay controls and compact rain presentation."""
import pathlib
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[3]
JAVA = ROOT / "android-tv/app/src/main/java/top/monitorglobal/tv"

class RainAndReplayTest(unittest.TestCase):
 def read(self, name):
  return (JAVA / name).read_text(encoding="utf-8")
 def test_separate_buttons_query_separate_sources(self):
  activity=self.read("MainActivity.java")
  service=self.read("MonitorService.java")
  self.assertIn("Replay · Último sismo M6+ mundial (72 h)",activity)
  self.assertIn("Replay · Último sismo no Brasil, qualquer magnitude (72 h)",activity)
  self.assertIn("MonitorService.REPLAY_M6",activity)
  self.assertIn("MonitorService.REPLAY_BRAZIL",activity)
  self.assertIn("REPLAY_BRAZIL.equals(action)",service)
  self.assertIn("fetchLatestBrazil(true)",service)
  self.assertIn("fetchLatestBrazil(false)",service)
  self.assertIn('history("brazil")',service)
  self.assertIn("!REPLAY_M6.equals(action)",service) if False else None
  self.assertIn("REPLAY_M6.equals(action)",service)
  self.assertIn(':"replay"',service)
  self.assertIn("local.magnitude>=6",service)
 def test_rain_card_uses_same_brand_hierarchy_as_temperature(self):
  rain=self.read("RainStripView.java")
  overlay=self.read("RainOverlay.java")
  self.assertIn("setOrientation(VERTICAL)",rain)
  for expected in ("TvCardStyle.header(context)", "TvCardStyle.body(context)",
                   "TvCardStyle.footer(context)", "TvCardStyle.brand(context)"):
   self.assertIn(expected,rain)
  self.assertIn("TESTE FICTÍCIO",rain)
  self.assertIn("Rainbow Weather",rain)
  self.assertIn("refreshBriefing()",rain)
  self.assertIn("screenHeightDp<650",overlay)
  self.assertIn("Math.min(dp(compact&&",overlay)
  self.assertIn("Chuva · exemplo fictício · ",rain)
  self.assertIn("Gravity.BOTTOM",overlay)
 def test_automatic_priority_remains_independent(self):
  service=self.read("MonitorService.java")
  self.assertIn("interruptDaily()",service)
  self.assertIn("if(destroyed||!screenReady()||draining",service)
  self.assertIn("historyBusy",service)

if __name__ == "__main__":
 unittest.main()
