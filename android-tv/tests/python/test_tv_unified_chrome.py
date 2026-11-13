"""Guard the November TV UI decision: seismic newsroom is the only template."""
import pathlib
import unittest

JAVA = pathlib.Path(__file__).resolve().parents[2] / "app/src/main/java/top/monitorglobal/tv"


def source(name):
    return (JAVA / name).read_text(encoding="utf-8")


class UnifiedChrome(unittest.TestCase):
    def test_shared_radar_and_scroll_rates(self):
        quake = source("NewsBannerView.java")
        other = source("TvBroadcastInfoView.java")
        shared = source("BroadcastVisuals.java")
        self.assertIn("BroadcastVisuals.radar(c,paint,elapsed,animate)", quake)
        self.assertIn("BroadcastVisuals.radar(c,p,elapsed,animate)", other)
        self.assertIn("BroadcastVisuals.tickerOffset(elapsed,length,animate)", quake)
        self.assertIn("BroadcastVisuals.tickerOffset(elapsed,length,animate)", other)
        self.assertIn("TICKER_PX_PER_SECOND=40f", shared)
        self.assertIn("RADAR_X=922f,RADAR_Y=61f", shared)
        self.assertIn("RADAR_PERIOD_MS=2400", shared)
        self.assertIn("postInvalidateOnAnimation()", other)
        self.assertIn("private void drawIdentity(Canvas c,long elapsed)", other)
        self.assertIn("BannerTimeline.page(elapsed,2)", other)

    def test_all_regional_notice_routes_use_the_original_seismic_banner(self):
        service = source("MonitorService.java")
        banner = source("Banner.java")
        quake = source("NewsBannerView.java")
        self.assertIn("banner.showRegional(a,demo,replay)", service)
        self.assertNotIn("compact.show(", service)
        self.assertNotIn("compact.showVoiceBrazil(", service)
        self.assertIn("new NewsBannerView(context,alert,demo,replay)", banner)
        self.assertIn("CompactNotice.DURATION_MS", banner)
        self.assertIn('a.compact?"SISMO REGIONAL · ÁREA MONITORADA"', quake)
        self.assertIn("drawMap(c,index,elapsed,fadeElapsed)", quake)
        self.assertIn("if(targetBannerActive){targetBannerActive=false;banner.hide();}", service)
        self.assertIn("a.originLongitude=85.324;a.originLatitude=27.717", service)
        self.assertIn("if(!demo&&!replay)", service)
        self.assertIn("if(!replay)TvSounds.play(this,TvSoundPattern.REGIONAL)", service)
        self.assertNotIn("ToneGenerator", service)

    def test_existing_scheduling_and_priorities_not_changed(self):
        weather = source("WeatherForecast.java")
        brent = source("BrentQuote.java")
        service = source("MonitorService.java")
        self.assertIn("static boolean due(long last,long now)", weather)
        self.assertIn("static boolean marketOpen", brent)
        self.assertIn("if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay)", service)
        self.assertIn("rain.hide();brent.hide();stopTarget()", service)
        self.assertNotIn("voiceNotice", service)


if __name__ == "__main__":
    unittest.main()
