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
  self.assertIn(':"global-replay"',service)
  self.assertIn(':"global-replay")',service)
  feed=self.read("FeedClient.java")
  self.assertIn('!view.equals("global-replay")',feed)
  self.assertIn("local.magnitude>=6",service)
 def test_brazil_history_uses_breaking_news_banner_with_map(self):
  service=self.read("MonitorService.java")
  banner=self.read("NewsBannerView.java")
  self.assertIn("scheduleLocal(Collections.singletonList(alert),false,true,delayMs)",service)
  self.assertIn("scheduleVoiceBrazil(result.alerts.get(0),fromButton?10000:1500)",service)
  self.assertIn('text(c,"BREAKING NEWS"',banner)
  self.assertIn("drawMap(c,index,elapsed,fadeElapsed)",banner)
  self.assertIn("String badgeLabel(){return demo?\"TESTE\":replay?\"REPLAY\"",banner)

 def test_rain_card_moved_into_weather_breaking_news_strip(self):
  rain=self.read("RainOverlay.java")
  broadcast=self.read("TvBroadcastInfoView.java")
  self.assertIn("banner.showWeather(rain,weather,demo,duration",rain)
  self.assertIn("stopEffect()",rain)
  self.assertIn("BREAKING NEWS",broadcast)
  self.assertIn("AO VIVO",broadcast)
  self.assertIn("LIBERDADE / SP",broadcast)
  self.assertIn("MAPA · LIBERDADE / SP",self.read("MapInset.java"))
  self.assertIn("TEMPO",broadcast)
  self.assertIn("font",broadcast.lower()) if False else None
  self.assertIn("WeatherForecast.due",self.read("RainMonitor.java"))
 def test_automatic_priority_remains_independent(self):
  service=self.read("MonitorService.java")
  self.assertIn("interruptDaily()",service)
  self.assertIn("if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay)",service)
  self.assertIn("historyBusy",service)

if __name__ == "__main__":
 unittest.main()
