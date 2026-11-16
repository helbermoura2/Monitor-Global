"""A voice Brent request must never end as a temporary query-status card only."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
JAVA=ROOT / "app/src/main/java/top/monitorglobal/tv"


def source(name):
    return (JAVA/name).read_text(encoding="utf-8")


class AlexaBrentNewsroomTest(unittest.TestCase):
    def test_manual_alexa_brent_always_renders_market_outcome(self):
        b=source("BrentMonitor.java")
        overlay=source("BrentOverlay.java")
        tv=source("TvBroadcastInfoView.java")
        assert 'overlay.showUnavailable(usd,brentState,dollarState)' in b
        assert 'showMarket(previous,usd,brentState,dollarState,false)' in b
        assert 'overlay.showMarket(valid,dollar,valid.session,dollarState,false)' in b
        assert 'banner.showMarket(null,dollar,' in overlay
        assert 'sem cotação confirmada' in b
        assert 'sem cotação confirmada' in tv
        assert 'manualDisplayUntil=SystemClock.elapsedRealtime()+BrentQuote.DISPLAY+800' in b
        assert 'if(onPresented!=null)onPresented.run()' in b

    def test_no_corner_hud_exists_even_during_network_lookup(self):
        service=source("MonitorService.java")
        banner=source("Banner.java")
        brent=source("BrentMonitor.java")
        overlay=source("BrentOverlay.java")
        tv=source("TvBroadcastInfoView.java")
        self.assertNotIn("voiceNotice",service)
        self.assertNotIn("VoiceStatusOverlay",service)
        self.assertIn("brent.setFeedback(message->Prefs.status(",service)
        self.assertIn("banner.showVoiceStatus(title,detail,duration,null)",service)
        self.assertIn("overlay.showPending()",brent)
        self.assertIn("banner.showMarketPending(65000L",overlay)
        self.assertIn("TvBroadcastInfoView.marketPending(context)",banner)
        self.assertIn("CONSULTANDO COTAÇÃO REAL",tv)
        self.assertNotIn('voiceInfo("Consulta do Brent"',service)

    def test_source_fallback_progress_never_claims_fabricated_price(self):
        code=source("BrentMonitor.java")
        self.assertIn('Verificando diretamente no Yahoo Finance',code)
        self.assertIn('Brent consultado. Verificando a cotação do dólar',code)
        self.assertIn('boolean brentValid=BrentQuote.parse(result',code)
        self.assertIn('if(!externalReader&&(brentValid||manual&&closedSession))',code)
        self.assertIn('sem valor inventado',code)


if __name__=='__main__':
    unittest.main()
