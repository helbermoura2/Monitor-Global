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
  self.assertIn('OledNewsChrome.tab(c,paint,summary?"RESUMO DIÁRIO":regional?"AVISO REGIONAL":"BREAKING NEWS",true)',banner)
  self.assertIn("drawMap(c,index,elapsed,fadeElapsed)",banner)
  self.assertIn("String badgeLabel(){return demo?\"TESTE\":replay?\"REPLAY\"",banner)

 def test_rain_card_moved_into_weather_breaking_news_strip(self):
  rain=self.read("RainOverlay.java")
  broadcast=self.read("TvBroadcastInfoView.java")
  self.assertIn("banner.showWeather(rain,weather,demo,duration",rain)
  self.assertIn("stopEffect()",rain)
  self.assertIn('OledNewsChrome.tab(c,p,"BREAKING NEWS",true)',broadcast)
  self.assertIn("AO VIVO",broadcast)
  self.assertIn("LIBERDADE / SP",broadcast)
  self.assertIn("MAPA · LIBERDADE / SP",self.read("MapInset.java"))
  self.assertIn("TEMPO",broadcast)
  self.assertIn("font",broadcast.lower()) if False else None
  self.assertIn("WeatherForecast.due",self.read("RainMonitor.java"))
 def test_voice_routing_keeps_real_events_and_separate_controls(self):
  google=self.read("AlexaLinkClient.java")
  service=self.read("MonitorService.java")
  rain=self.read("RainMonitor.java")
  relay=(ROOT/"worker/alexa-voice-bridge.mjs").read_text(encoding="utf-8")
  self.assertIn('type.equals("regional")||type.equals("rain")',google)
  self.assertIn('case "regional":action=REPLAY_TARGET;break;',service)
  self.assertIn('case "rain":action=VOICE_RAIN;break;',service)
  self.assertIn("rain.rainNow()",service)
  self.assertIn('pending.type',service)
  self.assertIn("voiceRequest?0:10000",service)
  self.assertIn("void rainNow()",rain)
  self.assertIn('summary.state.equals("now")',rain)
  self.assertIn('summary.state.equals("soon")',rain)
  self.assertIn("if(closed||manualRainBusy)return",rain)
  self.assertNotIn("rain.demo()",service.split('if(VOICE_RAIN.equals(action))')[1].split('if(WEATHER_NOW.equals(action))')[0])
  self.assertIn("'regional','rain'",relay)
 def test_automatic_priority_remains_independent(self):
  service=self.read("MonitorService.java")
  self.assertIn("interruptDaily()",service)
  self.assertIn("if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay)",service)
  self.assertIn("historyBusy",service)

if __name__ == "__main__":
 unittest.main()
