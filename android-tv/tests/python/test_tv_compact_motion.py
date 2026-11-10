"""Native TV HUD motion/position guardrails for the 1.0.67 rollout."""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
JAVA = ROOT / "android-tv/app/src/main/java/top/monitorglobal/tv"


def source(name):
    return (JAVA / name).read_text(encoding="utf-8")


class CompactTvMotionTest(unittest.TestCase):
    def test_brent_variation_is_right_aligned_and_price_is_left_aligned(self):
        card = source("BrentCardView.java")
        overlay = source("BrentOverlay.java")
        self.assertIn("priceBox.setMarginEnd(dp(10))", card)
        self.assertIn("values.addView(main,priceBox)", card)
        self.assertIn("values.addView(new View(c),new LayoutParams(0,dp(1),1f))", card)
        self.assertIn("values.addView(delta,new LayoutParams(-2,-2))", card)
        self.assertIn("Math.min(dp(385)", overlay)
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", overlay)

    def test_all_non_emergency_cards_are_bottom_anchored(self):
        self.assertIn("int edge=Gravity.BOTTOM", source("RainOverlay.java"))
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("WeatherSatelliteSequence.java"))
        self.assertIn("params.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("VoiceStatusOverlay.java"))
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("CompactNotice.java"))
        self.assertIn("p.gravity=Gravity.BOTTOM|Gravity.RIGHT", source("BrentOverlay.java"))
        # Large seismic alerts retain the independently configured broadcast banner.
        self.assertIn("themeTop", source("Banner.java"))

    def test_enter_and_exit_slide_from_and_to_bottom(self):
        motion = source("CardMotion.java")
        self.assertIn("ValueAnimator.areAnimatorsEnabled()", motion)
        self.assertIn("setTranslationY(dp(c,48))", motion)
        self.assertIn(".translationY(dp(c,60))", motion)
        for name in ["BrentOverlay.java", "RainOverlay.java",
                     "VoiceStatusOverlay.java", "CompactNotice.java",
                     "WeatherSatelliteSequence.java"]:
            self.assertIn("CardMotion.", source(name), name)

    def test_real_satellite_only_flip_and_no_extra_bitmap(self):
        motion = source("CardMotion.java")
        sequence = source("WeatherSatelliteSequence.java")
        rain = source("RainOverlay.java")
        monitor = source("RainMonitor.java")
        self.assertIn(".rotationY(90f)", motion)
        self.assertIn("v.setRotationY(-90f)", motion)
        self.assertIn("readyForFlip()", sequence)
        self.assertIn("frame!=null", sequence)
        self.assertIn("!failed", sequence)
        self.assertIn("if(firstFace&&flipExpected)CardMotion.flipIn(card,context)", sequence)
        self.assertIn("flipWhenSatelliteReady.getAsBoolean()", rain)
        self.assertIn("satellite::readyForFlip", monitor)
        self.assertIn("satelliteEnabled()?satellite::readyForFlip:null", monitor)
        self.assertIn("if(!enabled())", motion)
        self.assertIn("card.clear()", sequence)
        self.assertIn("frame.close()", sequence)

    def test_shared_theme_maintained_for_satellite_card(self):
        card = source("WeatherSatelliteCard.java")
        self.assertIn("TvCardStyle.header", card)
        self.assertIn("TvCardStyle.body", card)
        self.assertIn("TvCardStyle.footer", card)
        self.assertIn("TvCardStyle.brand", card)
        self.assertIn("frame.credit()", card)
        self.assertIn("InfraredPlan.timing", card)


if __name__ == "__main__":
    unittest.main()
