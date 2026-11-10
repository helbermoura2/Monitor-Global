"""Protect the UX contract: Alexa query cards stay in the TV corner, not centered."""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
JAVA = ROOT / "android-tv/app/src/main/java/top/monitorglobal/tv"


class AlexaVoiceCardPlacementTest(unittest.TestCase):
    def test_empty_or_unavailable_result_uses_bottom_right(self):
        overlay = (JAVA / "VoiceStatusOverlay.java").read_text(encoding="utf-8")
        self.assertIn("params.gravity=Gravity.BOTTOM|Gravity.RIGHT", overlay)
        self.assertNotIn("params.gravity=Gravity.CENTER;", overlay)
        self.assertIn("params.x=dp(32)", overlay)
        self.assertIn("params.y=dp(32)", overlay)

    def test_real_brazil_quake_uses_compact_card_instead_of_emergency_banner(self):
        service = (JAVA / "MonitorService.java").read_text(encoding="utf-8")
        compact = (JAVA / "CompactNotice.java").read_text(encoding="utf-8")
        self.assertIn("scheduleVoiceBrazil(result.alerts.get(0),fromButton?10000:1500)", service)\n        self.assertIn("fetchLatestBrazil(true)", service)\n        self.assertIn("fetchLatestBrazil(false)", service)
        self.assertIn("showTargetCard(alert,false,true,true)", service)
        self.assertIn("compact.showVoiceBrazil(a)", service)
        self.assertIn("MONITOR GLOBAL · CONSULTA POR VOZ", compact)
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", compact)
        self.assertIn("TvCardStyle.brand(context)", compact)
        self.assertIn("TvCardStyle.CYAN", compact)

    def test_common_style_for_brent_weather_and_alexa(self):
        style = (JAVA / "TvCardStyle.java").read_text(encoding="utf-8")
        weather = (JAVA / "WeatherCardView.java").read_text(encoding="utf-8")
        brent = (JAVA / "BrentCardView.java").read_text(encoding="utf-8")
        voice = (JAVA / "VoiceStatusOverlay.java").read_text(encoding="utf-8")
        rain = (JAVA / "RainStripView.java").read_text(encoding="utf-8")
        self.assertIn("fonts/Rajdhani-Bold.ttf", style)
        self.assertIn("static final int BODY=0xff071724", style)
        self.assertIn("static final int CYAN=0xff38bdf8", style)
        for card in [weather, brent, voice, rain]:
            self.assertIn("TvCardStyle.brand(", card)
        self.assertIn("TvCardStyle.header(context)", voice)
        self.assertIn("TvCardStyle.body(context)", voice)
        self.assertIn("TvCardStyle.footer(context)", voice)
        self.assertIn("BODY=TvCardStyle.BODY", weather)
        self.assertIn("BODY=TvCardStyle.BODY", brent)


if __name__ == "__main__":
    unittest.main()
