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

    def test_hud_is_only_progress_not_the_final_result(self):
        service=source("MonitorService.java")
        hud=source("VoiceStatusOverlay.java")
        self.assertIn('brent.setOnPresented(()->{voiceStatusGeneration++;voiceNotice.hide();})',service)
        self.assertIn('if(brent.showing()){voiceStatusGeneration++;voiceNotice.hide()',service)
        self.assertIn('long duration=pending?60000L:VoiceStatusOverlay.DURATION',service)
        self.assertIn('detail.startsWith("Fonte principal")',service)
        self.assertIn('show(String title,String body,long duration)',hud)
        self.assertIn('if(token==voiceStatusGeneration)voiceNotice.hide()',service)

    def test_source_fallback_progress_never_claims_fabricated_price(self):
        code=source("BrentMonitor.java")
        self.assertIn('Verificando diretamente no Yahoo Finance',code)
        self.assertIn('Brent consultado. Verificando a cotação do dólar',code)
        self.assertIn('boolean brentValid=BrentQuote.parse(result',code)
        self.assertIn('if(!externalReader&&(brentValid||manual&&closedSession))',code)
        self.assertIn('sem valor inventado',code)


if __name__=='__main__':
    unittest.main()
