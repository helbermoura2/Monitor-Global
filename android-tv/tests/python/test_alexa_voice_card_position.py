"""All Alexa voice responses must use the official newsroom lower-third.

The original voice consultation corner card was removed after real-TV feedback.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[3]
JAVA=ROOT/"android-tv/app/src/main/java/top/monitorglobal/tv"


def source(name):
    return (JAVA/name).read_text(encoding="utf-8")


class AlexaVoiceBannerPlacementTest(unittest.TestCase):
    def test_old_corner_card_is_deleted_and_never_constructed(self):
        service=source("MonitorService.java")
        self.assertFalse((JAVA/"VoiceStatusOverlay.java").exists())
        self.assertNotIn("new VoiceStatusOverlay(",service)
        self.assertNotIn("voiceNotice.show(",service)
        self.assertNotIn('voiceInfo("Consulta do Brent"',service)
        self.assertIn("banner.showVoiceStatus(title,detail,duration,null)",service)
        self.assertIn("brent.setFeedback(message->Prefs.status(",service)

    def test_brent_immediately_uses_the_same_full_width_market_banner(self):
        market=source("BrentMonitor.java")
        overlay=source("BrentOverlay.java")
        banner=source("Banner.java")
        view=source("TvBroadcastInfoView.java")
        self.assertIn("overlay.showPending()",market)
        self.assertIn("banner.showMarketPending(65000L",overlay)
        self.assertIn("TvBroadcastInfoView.marketPending(context)",banner)
        self.assertIn("marketPending=true",view)
        self.assertIn("if(marketPending)",view)
        self.assertIn('label(c,"BREAKING NEWS"',view)
        self.assertIn("BroadcastVisuals.radar(c,p,elapsed,animate)",view)
        self.assertIn("BrentQuote.DISPLAY",overlay)
        self.assertNotIn('new VoiceStatusOverlay',overlay)

    def test_brazil_earthquake_replay_stays_on_full_seismic_banner_with_map(self):
        service=source("MonitorService.java")
        banner=source("NewsBannerView.java")
        self.assertIn("scheduleVoiceBrazil(result.alerts.get(0),fromButton?10000:1500)",service)
        self.assertIn("fetchLatestBrazil(true)",service)
        self.assertIn("fetchLatestBrazil(false)",service)
        self.assertIn("scheduleLocal(Collections.singletonList(alert),false,true,delayMs)",service)
        self.assertIn('centerText(c,"BREAKING NEWS"',banner)
        self.assertIn("drawMap(c,index,elapsed,fadeElapsed)",banner)
        self.assertIn('replay?"REPLAY"',banner)


if __name__=="__main__":
    unittest.main()
