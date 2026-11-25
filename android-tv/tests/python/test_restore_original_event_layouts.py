"""Regression contract: all TV data columns retained in the approved OLED news layout.

Shortened top badges preserve real market/weather data, event map, footer
totals and shared official Argos artwork.
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
            'eventCategory(c,"TEMPO","LIBERDADE · SP")',
            'primary(c,weather==null?"—":weather.temperatureValue,124,39,',
            'categoryIcon(c,0,251,42,30,elapsed)',
            'label(c,sky,290,58,',
            'label(c,detail,290,84,',
            'metric(c,1,weather==null?"—":weather.humidityValue,"UMIDADE",492,elapsed)',
            'metric(c,2,weather==null?"—":weather.windValue,weather==null?"VENTO · N/D":"VENTO · "+weather.windDirection,603,elapsed)',
            'metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",712,elapsed)',
        ):
            self.assertIn(piece, WEATHER)

    def test_rain_restores_original_icons_and_three_metric_columns(self):
        for piece in (
            'eventCategory(c,facts.topic,"LIBERDADE · SP")',
            'categoryIcon(c,0,127,41,28,elapsed)',
            'label(c,facts.headline,165,60,23,',
            'label(c,facts.end,127,86,16,',
            'metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",430,elapsed)',
            'metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",558,elapsed)',
            'metric(c,3,facts.duration,',
        ):
            self.assertIn(piece, WEATHER)

    def test_market_retains_independent_quote_columns(self):
        for piece in (
            'fitted(c,"BRENT",20,71',
            'fitted(c,"DÓLAR USD/BRL",MARKET_DOLLAR_X,48',
            'brent==null?"US$ —":"US$ "+amount(brent.price)',
            'dollar==null?"R$ —":"R$ "+fxAmount(dollar.price)',
            'marketHeaderStatus(brentSession)',
            'marketHeaderStatus(dollarSession)',
            'BrentQuote.reference(brent.at)',
            'BrentQuote.reference(dollar.at)',
        ):
            self.assertIn(piece, WEATHER)

    def test_satellite_and_voice_restore_prior_display_order(self):
        for piece in (
            'eventCategory(c,"SATÉLITE","GOES-EAST")',
            'primary(c,frame==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,28,',
            'eventCategory(c,dailyWeatherText!=null?"PREVISÃO":"CONSULTA",dailyWeatherText!=null?"OPEN-METEO":"POR VOZ")',
            'primary(c,voiceTitle,170,27,',
            'label(c,voiceDetail,170,88,16,',
        ):
            self.assertIn(piece, WEATHER)

    def test_sismos_tsunami_replay_and_summary_have_original_caption_space(self):
        self.assertIn('c.clipRect(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP)', SEISMIC)
        self.assertIn('fitText(c,p.caption,HEADLINE_X,45,13,', SEISMIC)
        self.assertIn('drawHeadline(c,p,elapsed,width,size)', SEISMIC)
        self.assertIn('drawPage(c,pages[index],elapsed,255,0)', SEISMIC)
        self.assertIn('else if(a.kind.equals("tsunami"))', SEISMIC)
        self.assertIn('else centerText(c,p.magnitude,BroadcastVisuals.EVENT_CENTER_X,BroadcastVisuals.EVENT_MAGNITUDE_BASELINE,36,', SEISMIC)
        self.assertIn('OledNewsChrome.tab(c,paint,badgeLabel(),false)', SEISMIC)

    def test_shared_vertical_alignment_is_used_for_weather_rain_market_satellite_voice(self):
        self.assertIn("BroadcastVisuals.centeredBodyBaseline(p,brand,chosen)", WEATHER)
        self.assertIn("BODY_VISUAL_CENTER_Y=61f", CHROME)
        self.assertIn("EVENT_CENTER_X=68f,EVENT_MAGNITUDE_BASELINE=72f", CHROME)
        self.assertIn('BroadcastVisuals.eventCategory(c,p,brand,title,caption', WEATHER)
        self.assertIn('BroadcastVisuals.eventCategory(c,paint,brand,"TSUNAMI"', SEISMIC)
        for phrase in ('eventCategory(c,"TEMPO"', 'eventCategory(c,"SATÉLITE"', 'eventCategory(c,dailyWeatherText!=null?"PREVISÃO":"CONSULTA"', 'eventCategory(c,facts.topic,'):
            self.assertIn(phrase, WEATHER)
        self.assertIn("YAHOO · USD/BRL · CÂMBIO", WEATHER)
        self.assertNotIn("MarketDOLWidget", WEATHER)

    def test_header_footer_and_position_stay_as_pre_redesign(self):
        self.assertIn('BREAKING_WIDTH=190f,FOOTER_TOP=94f,FOOTER_HEIGHT=32f', CHROME)
        self.assertNotIn('newsroomBody(', CHROME)
        self.assertIn('OledNewsChrome.base(c,p)', WEATHER)
        skin=(ROOT / "OledNewsChrome.java").read_text(encoding="utf-8")
        self.assertIn('static final int OLED=Color.BLACK', skin)
        self.assertIn('static final float LEFT=8f', skin)
        self.assertIn('p.y=dp(32)-dp(TRAVEL_DP)', BANNER)
        self.assertIn('int bannerWidthPercent=requestedWidth==92?96:requestedWidth', BANNER)


if __name__ == "__main__":
    unittest.main()
