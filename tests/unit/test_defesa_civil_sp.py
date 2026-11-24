import io
import runpy
import unittest
from pathlib import Path

from shapely.geometry import box

MODULE = runpy.run_path(Path(__file__).resolve().parents[2] / "tools/update-defesa-civil-sp.py")
EPOCH = MODULE["epoch"]
NOW = EPOCH("2026-11-22T19:00:00-03:00")
CITY = box(-46.8, -24.0, -46.4, -23.4)
INSIDE = "<polygon>-23.5,-46.6 -23.6,-46.6 -23.6,-46.5 -23.5,-46.6</polygon>"
OUTSIDE = "<polygon>-23.5,-47 -23.6,-47 -23.6,-47.1 -23.5,-47</polygon>"


def entry(identifier, area=INSIDE, severity="Severe", status="Actual", kind="Alert",
          expires="2026-11-22T20:00:00-03:00", references=""):
    return f"""
      <entry><content><alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>{identifier}</identifier><sender>CENAD-SEDEC</sender>
      <sent>2026-11-22T18:45:00-03:00</sent><scope>Public</scope>
      <status>{status}</status><msgType>{kind}</msgType><references>{references}</references>
      <info><language>pt-BR</language><severity>{severity}</severity><expires>{expires}</expires>
      <senderName>Defesa Civil Estadual De São Paulo</senderName><headline>Mensagem de teste</headline>
      <area><areaDesc>SÃO PAULO/SP</areaDesc>{area}</area></info></alert></content></entry>
    """


def parse(*entries):
    xml = '<feed xmlns="http://www.w3.org/2005/Atom"><updated>2026-11-22T21:58:00Z</updated>' + "".join(entries) + "</feed>"
    return MODULE["parse"](io.BytesIO(xml.encode()), CITY, NOW)


class DefesaCivilCapitalTest(unittest.TestCase):
    def test_public_actual_active_severe_or_extreme_and_capital_only(self):
        updated, alerts = parse(entry("valid"), entry("valid-extreme", severity="Extreme"),
                                entry("outside", OUTSIDE), entry("generic-area", ""),
                                entry("drill", status="Exercise"), entry("moderate", severity="Moderate"),
                                entry("expired", expires="2026-11-22T19:00:00-03:00"))
        self.assertEqual(updated, EPOCH("2026-11-22T21:58:00Z"))
        self.assertEqual([alert["id"] for alert in alerts], ["valid", "valid-extreme"])
        self.assertEqual(alerts[0]["message"], "Mensagem de teste")

    def test_national_preserves_cap_levels_and_official_area_without_expanding_tv(self):
        xml = '<feed xmlns="http://www.w3.org/2005/Atom"><updated>2026-11-22T21:58:00Z</updated>' \
            + entry("sp-severe", severity="Severe") \
            + entry("other-region", area=OUTSIDE, severity="Extreme") \
            + entry("no-area", area="", severity="Extreme") \
            + entry("exercise", status="Exercise", severity="Extreme") \
            + entry("moderate", severity="Moderate") + "</feed>"
        updated, local, national = MODULE["parse"](io.BytesIO(xml.encode()), CITY, NOW, include_national=True)
        self.assertEqual([a["id"] for a in local], ["sp-severe"])
        self.assertEqual({a["id"]: a["severity"] for a in national},
                         {"sp-severe": "Severe", "other-region": "Extreme"})
        self.assertTrue(all(a["area"] == "SÃO PAULO/SP" for a in national))
        self.assertEqual(updated, EPOCH("2026-11-22T21:58:00Z"))

    def test_national_cancellation_removes_expired_referenced_notice(self):
        xml = '<feed xmlns="http://www.w3.org/2005/Atom"><updated>2026-11-22T21:58:00Z</updated>' \
            + entry("original", severity="Extreme", area=OUTSIDE) \
            + entry("cancel", kind="Cancel",
                    references="CENAD-SEDEC,original,2026-11-22T18:45:00-03:00") \
            + "</feed>"
        _, _, national = MODULE["parse"](io.BytesIO(xml.encode()), CITY, NOW, include_national=True)
        self.assertEqual(national, [])

    def test_cancellation_retracts_predecessor_even_if_cancel_precedes_original(self):
        _, alerts = parse(entry("cancel", kind="Cancel", references="CENAD-SEDEC,original,2026-11-22T18:45:00-03:00"),
                          entry("original"))
        self.assertEqual(alerts, [])
