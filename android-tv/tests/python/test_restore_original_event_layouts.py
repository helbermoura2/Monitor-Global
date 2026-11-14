"""Regression contract: 1.0.91 restores the approved 1.0.88 event internals.

The newsroom experiment changed the internal presentation of every event and
made the seismic subtitle collide with its header. The extended red tabs and
the 32-unit footer predate that experiment and must remain.
"""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2] / "app" / "src" / "main" / "java" / "top" / "monitorglobal" / "tv"
WEATHER = (ROOT / "TvBroadcastInfoView.java").read_text(encoding="utf-8")
SEISMIC = (ROOT / "NewsBannerView.java").read_text(encoding="utf-8")
CHROME = (ROOT / "BroadcastVisuals.java").read_text(encoding="utf-8")
BANNER = (ROOT / "Banner.java").read_text(encoding="utf-8")


class OriginalEventLayoutsTest(unittest.TestCase):
    def test_temperature_has_four_separate_information_columns(self):
        for piece in (
            'label(c,"TEMPO",11,70,30,',
            'label(c,weather==null?"—":weather.temperatureValue,124,65,39,',
            'icon(c,0,251,42,30)',
            'label(c,sky,290,58,',
            'label(c,detail,290,84,',
            'metric(c,1,weather==null?"—":weather.humidityValue,"UMIDADE",493)',
            'metric(c,2,weather==null?"—":weather.windValue,"VENTO",626)',
            'metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",759)',
        ):
            self.assertIn(piece, WEATHER)

    def test_rain_restores_original_icons_and_three_metric_columns(self):
        for piece in (
            'label(c,facts.topic,11,70,29,',
            'icon(c,0,127,41,28)',
            'label(c,facts.headline,165,60,23,',
            'label(c,facts.end,127,86,16,',
            'metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",412)',
            'metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",570)',
            'metric(c,3,facts.duration,',
        ):
            self.assertIn(piece, WEATHER)

    def test_brent_dollar_restore_their_prior_placement(self):
        for piece in (
            'label(c,"BRENT",12,44,19,',
            'label(c,brent==null?"US$ —":"US$ "+amount(brent.price),138,68,37,',
            'label(c,variation,402,66,25,',
            'fill(c,575,41,1,43,',
            'label(c,"DÓLAR USD/BRL",593,44,16,',
            'label(c,dollar==null?"R$ —":"R$ "+amount(dollar.price),593,75,29,',
            'label(c,"CONSULTA POR VOZ",12,83,13,',
        ):
            self.assertIn(piece, WEATHER)

    def test_satellite_and_voice_restore_prior_display_order(self):
        for piece in (
            'label(c,"SATÉLITE",12,70,32,',
            'label(c,satellite==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,62,28,',
            'label(c,"CONSULTA",12,66,31,',
            'label(c,voiceTitle,170,62,27,',
            'label(c,voiceDetail,170,88,16,',
        ):
            self.assertIn(piece, WEATHER)

    def test_sismos_tsunami_replay_and_summary_have_original_caption_space(self):
        self.assertIn('c.clipRect(0,24,844,BroadcastVisuals.FOOTER_TOP)', SEISMIC)
        self.assertIn('fitText(c,p.caption,HEADLINE_X,36,11,', SEISMIC)
        self.assertIn('drawHeadline(c,p,elapsed,width,size)', SEISMIC)
        self.assertIn('drawPage(c,pages[index],elapsed,255,0)', SEISMIC)
        self.assertIn('else if(a.kind.equals("tsunami"))', SEISMIC)
        self.assertIn('else centerText(c,p.magnitude,56f,72,36,', SEISMIC)
        self.assertIn('c.clipRect(0,0,960,24)', SEISMIC)

    def test_header_footer_and_position_stay_as_pre_redesign(self):
        self.assertIn('BREAKING_WIDTH=260f,FOOTER_TOP=94f,FOOTER_HEIGHT=32f', CHROME)
        self.assertNotIn('newsroomBody(', CHROME)
        self.assertIn('c.clipPath(outline);fill(c,0,24,960,102,background)', WEATHER)
        self.assertIn('p.y=dp(32)-dp(TRAVEL_DP)', BANNER)
        self.assertIn('int bannerWidthPercent=requestedWidth==92?96:requestedWidth', BANNER)


if __name__ == "__main__":
    unittest.main()
