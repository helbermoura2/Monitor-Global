import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('durable_audit',Path(__file__).resolve().parents[2]/'tools/cloudflare-durable-audit.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AuditTests(unittest.TestCase):
    def test_history_chunk_detection_handles_bundled_numeric_notation(self):
        for code in ['Math.ceil(value.length / 400000)', 'Math.ceil(value.length / 400_000)', 'Math.ceil(value.length / 4e5)']:
            self.assertTrue(m.large_telegram_chunks(code))
        self.assertFalse(m.large_telegram_chunks('image-data=400000; Math.ceil(value.length / 24000)'))

    def test_complete_minutes_and_failed_requests_are_counted_without_assuming_quiet_means_zero(self):
        rows=[]
        for minute,count,name,kind,status in [('00:19',999,'population-exposure-v2:early','http','success'),('00:20',5,'population-exposure-v2:one','http','success'),('00:29',2,'shared-source-v1:feed','alarm','scriptThrewException'),('00:30',100,'metrics','http','success')]:
            rows.append({'sum':{'requests':count},'dimensions':{'datetimeMinute':'2026-10-18T'+minute+':00Z','name':name,'type':kind,'status':status}})
        report={'queriedAt':'2026-10-18T00:30:40+00:00','lastThirtyMinutes':{'since':'2026-10-18T00:00:40+00:00','rows':rows}}
        summary=m.consumption_summary(report)['recentCompleteMinutes']
        self.assertEqual(summary['minutes'],10);self.assertEqual(summary['requests'],7);self.assertEqual(summary['projectedRequestsPerDay'],1008)
        self.assertEqual(summary['types']['http'],5);self.assertEqual(summary['types']['alarm'],2);self.assertEqual(summary['families']['population'],5);self.assertEqual(summary['statuses']['scriptThrewException'],2)
        self.assertNotIn('recentCompleteMinutes',m.consumption_summary({'queriedAt':report['queriedAt']}))
    def test_daily_report_groups_population_keys_but_keeps_request_types(self):
        rows=[{'sum':{'requests':n},'dimensions':{'date':'2026-10-17','name':name,'type':kind,'status':'success'}} for n,name,kind in [(10,'population-exposure-v2:a','http'),(20,'population-exposure-v2:b','http'),(4,'shared-source-v1:feed','alarm')]]
        report={'results':{'durableObjectsInvocationsAdaptiveGroups':{'rows':rows}}}
        summary=m.consumption_summary(report)['daily']['2026-10-17']
        self.assertEqual(summary['requests'],34);self.assertEqual(summary['families']['population'],30);self.assertEqual(summary['types']['alarm'],4)
    def test_budget_requires_a_complete_day_after_rollout_and_not_a_quiet_sample(self):
        policy={'targetRequestsPerDay':35000,'ceilingRequestsPerDay':45000,'firstFullUtcDay':'2026-10-19','baseline':{}}
        report={'queriedAt':'2026-10-19T12:00:00+00:00','results':{'durableObjectsInvocationsAdaptiveGroups':{}},'consumptionSummary':{'daily':{'2026-10-18':{'requests':100,'families':{}},'2026-10-19':{'requests':200,'families':{}}}}}
        summary=m.budget_summary(report,policy);self.assertEqual(summary['confirmation'],'waiting-first-complete-day');self.assertFalse(summary['days'][-1]['complete'])
        report['queriedAt']='2026-10-20T00:15:00+00:00';summary=m.budget_summary(report,policy);self.assertEqual(summary['confirmation'],'within-target');self.assertEqual(summary['latestCompleteDay'],'2026-10-19')
        report['consumptionSummary']['daily']['2026-10-19']['requests']=40000;self.assertEqual(m.budget_summary(report,policy)['confirmation'],'above-target')
        report['consumptionSummary']['daily']['2026-10-19']['requests']=45001;self.assertEqual(m.budget_summary(report,policy)['confirmation'],'above-ceiling')
        del report['results']['durableObjectsInvocationsAdaptiveGroups'];self.assertEqual(m.budget_summary(report,policy)['confirmation'],'analytics-unavailable')
if __name__=='__main__':unittest.main()
