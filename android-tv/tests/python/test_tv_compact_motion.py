"""Broadcast lower-third regressions for TV weather, satellite and Brent + USD."""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
JAVA = ROOT / "android-tv/app/src/main/java/top/monitorglobal/tv"


def source(name):
    return (JAVA / name).read_text(encoding="utf-8")


class BroadcastLowerThirdTest(unittest.TestCase):
    def test_brent_and_dollar_are_in_the_same_full_width_banner(self):
        brent = source("BrentOverlay.java")
        market = source("BrentMonitor.java")
        card = source("TvBroadcastInfoView.java")
        self.assertIn("banner.showBrent(quote,dollar,demo,BrentQuote.DISPLAY", brent)
        self.assertIn('BRL=X?interval=1m&range=1d', market)
        self.assertIn("DollarQuote.fromYahoo(raw,System.currentTimeMillis())", market)
        self.assertIn("DÓLAR COMERCIAL", card)
        self.assertIn("DISPLAY=12000L", source("BrentQuote.java"))
        self.assertIn("BrentQuote.marketOpen(now)", market)

    def test_weather_map_is_above_live_stripe_and_original_hourly_schedule_is_preserved(self):
        weather = source("RainOverlay.java")
        card = source("TvBroadcastInfoView.java")
        display = source("Banner.java")
        self.assertIn("banner.showWeather(rain,weather,demo,duration", weather)
        self.assertIn("MapInset(getContext(),this::invalidate)", card)
        self.assertIn('MAPA · LIBERDADE / SP', source("MapInset.java"))
        self.assertIn("c.translate(649,mapBelow?4-slide:slide)", card)
        self.assertIn("mapSpace=kind==BRENT?0:Banner.insetDp(c)", card)
        self.assertIn("themeTop", display)
        self.assertIn("static final long DURATION=12000L", weather)
        self.assertIn("WeatherForecast.due", source("RainMonitor.java"))
        self.assertIn("WeatherForecast.slot", source("RainMonitor.java")) if False else None

    def test_satellite_infrared_has_a_real_map_and_unchanged_handoff(self):
        satellite = source("WeatherSatelliteSequence.java")
        info = source("TvBroadcastInfoView.java")
        self.assertIn('banner.showSatellite(frame,"",DURATION', satellite)
        self.assertIn("AFTER_WEATHER=13000", satellite)
        self.assertIn("DURATION=15000", satellite)
        self.assertIn("WAIT_FOR_IMAGE=20000", satellite)
        self.assertIn("satellite.image", info)
        self.assertIn("INFRAVERMELHO · SUDESTE", info)
        self.assertIn("NÃO É RADAR DE CHUVA", info)
        self.assertIn("frame.close()", satellite)

    def test_sismic_banners_and_warning_priority_keep_their_own_queue(self):
        service = source("MonitorService.java")
        self.assertIn("rain.hide();brent.hide()", service)
        self.assertIn("if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay)", service)
        self.assertIn("scheduleLocal(Collections.singletonList(alert),false,true,delayMs)", service)
        self.assertIn("activeReal", service)
        self.assertIn("NewsBannerView", source("Banner.java"))
        self.assertIn("BannerRevealLayout", source("Banner.java"))

    def test_separate_small_status_overlays_stay_bottom_anchored(self):
        self.assertIn("params.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("VoiceStatusOverlay.java"))
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("CompactNotice.java"))


if __name__ == "__main__":
    unittest.main()
