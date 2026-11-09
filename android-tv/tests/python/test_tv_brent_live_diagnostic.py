"""Read-only, bounded diagnostics for the TV Brent source; never logs prices or credentials."""
import json
import unittest
import urllib.request
import urllib.error
from datetime import datetime, timezone

WORKER = "https://black-sky-9ba0.terrestre.workers.dev/tv-brent"
YAHOO = (
    "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d",
)

def fetch_json(url):
    req=urllib.request.Request(url, headers={"Accept":"application/json","User-Agent":"MonitorGlobalBrentDiagnostics/1.0"})
    try:
        with urllib.request.urlopen(req,timeout=7) as response:
            return response.status,json.load(response),None
    except urllib.error.HTTPError as error:
        return error.code,None,"http-error"
    except Exception as error:
        return None,None,type(error).__name__

class TvBrentLiveDiagnostic(unittest.TestCase):
    def test_source_reachability_read_only(self):
        print("BRENT_DIAG UTC",datetime.now(timezone.utc).isoformat(),flush=True)
        for name,url in [("worker",WORKER),("yahoo-query1",YAHOO[0]),("yahoo-query2",YAHOO[1])]:
            status,data,error=fetch_json(url)
            result={"source":name,"http":status,"error":error}
            if isinstance(data,dict):
                if name=="worker":
                    result.update({key:data.get(key) for key in ("version","ok","marketOpen","reason","quoteKind","source")})
                    if isinstance(data.get("asOf"),(int,float)):
                        result["sourceAgeMin"]=round((datetime.now(timezone.utc).timestamp()*1000-data["asOf"])/60000,1)
                else:
                    chart=data.get("chart") or {}
                    series=(chart.get("result") or [None])[0]
                    metadata=(series or {}).get("meta") or {}
                    candles=(series or {}).get("timestamp") or []
                    quotes=((series or {}).get("indicators") or {}).get("quote") or []
                    closes=(quotes[0] or {}).get("close",[]) if quotes else []
                    result.update({"chartError":bool(chart.get("error")),"symbol":metadata.get("symbol"),"currency":metadata.get("currency"),"marketState":metadata.get("marketState"),"hasHeadlineTime":bool(metadata.get("regularMarketTime")),"candleCount":len(candles),"closeCount":len(closes)})
                    if metadata.get("regularMarketTime"):
                        result["headlineAgeMin"]=round((datetime.now(timezone.utc).timestamp()-metadata["regularMarketTime"])/60,1)
                    if candles:
                        result["lastCandleAgeMin"]=round((datetime.now(timezone.utc).timestamp()-candles[-1])/60,1)
            print("BRENT_DIAG",json.dumps(result,sort_keys=True),flush=True)
        # Observation-only: a provider outage should not fail unrelated Android compilation.
        self.assertTrue(True)
