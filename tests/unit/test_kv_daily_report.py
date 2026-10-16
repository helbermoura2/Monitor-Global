import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('report',Path(__file__).resolve().parents[2]/'tools/cloudflare-kv-daily-report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReportTests(unittest.TestCase):
    def test_thresholds_and_namespace_aggregation(self):
        day='2026-10-17'
        for count,level in [(0,'normal'),(700,'watch'),(850,'high'),(950,'critical'),(1000,'exceeded')]:
            rows=[{'dimensions':{'date':day,'actionType':'write'},'sum':{'requests':count}}]
            self.assertEqual(m.budget(rows,day)['write']['level'],level)
        rows=[{'dimensions':{'date':day,'actionType':'write','namespaceId':k},'sum':{'requests':10}} for k in ['a','b']]
        self.assertEqual(m.budget(rows,day)['write']['operations'],20)
    def test_partial_day_and_missing_observation_are_not_complete(self):
        now=dt.datetime(2026,10,18,3,tzinfo=dt.timezone.utc)
        began=dt.datetime(2026,10,16,19,tzinfo=dt.timezone.utc).timestamp()*1000
        data={'available':True,'coverageStartedAt':began}
        self.assertTrue(m.coverage(data,'2026-10-17',now)['observationWindowComplete'])
        self.assertFalse(m.coverage(data,'2026-10-16',now)['observationWindowComplete'])
        self.assertFalse(m.coverage(data,'2026-10-18',now)['observationWindowComplete'])
        self.assertFalse(m.coverage({'available':False},'2026-10-17',now)['observationWindowComplete'])
if __name__=='__main__':unittest.main()
