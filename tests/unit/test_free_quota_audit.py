import datetime as dt,importlib.util,json,pathlib,unittest
from unittest.mock import patch
root=pathlib.Path(__file__).resolve().parents[2];spec=importlib.util.spec_from_file_location('freeaudit',root/'tools/cloudflare-free-quota-audit.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q);policy=json.loads((root/'tools/free-quota-policy.json').read_text())
def data(name,metrics,kind='sum',extra=None):return {'aggregate':kind,'rows':[{'dimensions':{'date':'2026-10-26',**(extra or {})},kind:metrics}]}
class FreeQuotaTests(unittest.TestCase):
 def report(self,analytics):return {'queriedAt':'2026-10-27T06:00:00+00:00','analytics':analytics}
 def test_daily_worker_percent_and_partial_are_independent(self):
  v=data('',{'requests':38524});v['rows'].append({'dimensions':{'date':'2026-10-27'},'sum':{'requests':1000}});r=q.quota_summary(self.report({'workersInvocationsAdaptive':v}),policy);self.assertTrue(r['days'][0]['complete']);self.assertEqual(r['days'][0]['quotas']['workerRequests']['percent'],38.524);self.assertFalse(r['days'][1]['complete']);self.assertEqual(r['days'][1]['quotas']['workerRequests']['value'],1000)
 def test_storage_max_is_not_summed_and_operation_bytes_are_not_storage(self):
  v=data('',{'storedBytes':100},'max');v['rows'].append({'dimensions':{'date':'2026-10-26'},'max':{'storedBytes':120}});r=q.quota_summary(self.report({'durableObjectsSqlStorageGroups':v,'kvOperationsAdaptiveGroups':data('',{'requests':47,'objectBytes':999999},extra={'actionType':'read'})}),policy)['days'][0]['quotas'];self.assertEqual(r['sqlStoredBytes']['value'],120);self.assertFalse(r['kvStoredBytes']['available']);self.assertEqual(r['kvRead']['value'],47);self.assertFalse(r['kvWrite']['available'])
 def test_duration_requires_confirmed_unit(self):
  v=data('',{'duration':1158.3});r=q.quota_summary(self.report({'durableObjectsPeriodicGroups':v}),policy);self.assertFalse(r['days'][0]['quotas']['durableDuration']['available']);v['metricDescriptions']={'duration':'Sum of Duration - GB*s'};r=q.quota_summary(self.report({'durableObjectsPeriodicGroups':v}),policy);self.assertAlmostEqual(r['days'][0]['quotas']['durableDuration']['percent'],8.91,places=2)
 def test_unavailable_data_does_not_become_a_zero_day(self):
  r=q.quota_summary(self.report({}),policy);self.assertEqual(r['days'],[]);self.assertIsNone(r['latestCompleteDay']);self.assertEqual(r['nonDaily']['workerBuildMinutes']['level'],'unknown')
 def test_levels_cover_each_threshold(self):
  self.assertEqual([q.level(v,policy) for v in [0,69.9,70,85,95,100,101]],['normal','normal','watch','high','critical','exceeded','exceeded'])
 def test_family_share_is_share_of_do_not_worker_total(self):
  v=data('',{'requests':60},extra={'name':'population-exposure-v2:key'});v['rows'].append({'dimensions':{'date':'2026-10-26','name':'earthquake-alerts'},'sum':{'requests':40}});r=q.hot_families(v)['2026-10-26'];self.assertEqual(r[0]['family'],'population');self.assertEqual(r[0]['percentOfMeasuredDORequests'],60)
 def test_singular_byte_count_is_collected_from_storage_max(self):
  field={'name':'kvStorageAdaptiveGroups','type':{'name':'Storage'},'args':[{'name':'filter','type':{'name':'Filter'}}]}
  shapes={'Storage':{'fields':[{'name':'max','type':{'name':'Maximum'}},{'name':'dimensions','type':{'name':'Dimensions'}}]},'Dimensions':{'fields':[{'name':'date'}]},'Filter':{'inputFields':[{'name':'date_geq'}]}}
  def graphql(client,query):
   if '__type' in query:return {'__type':{'fields':[{'name':'byteCount','description':'Stored bytes','type':{'kind':'NON_NULL','ofType':{'kind':'SCALAR','name':'uint64'}}}]}}
   self.assertIn('max{byteCount}',query);return {'viewer':{'accounts':[{'kvStorageAdaptiveGroups':[{'dimensions':{'date':'2026-10-26'},'max':{'byteCount':123}}]}]}}
  with patch.object(q.d,'schema',side_effect=lambda c,n:shapes[n]),patch.object(q.d,'graphql',side_effect=graphql):
   r=q.a.dataset(type('Client',(),{'account':'account'})(),field,dt.datetime(2026,10,27,tzinfo=dt.timezone.utc));self.assertEqual(r['metrics'],['byteCount']);self.assertEqual(r['aggregate'],'max');self.assertEqual(r['rows'][0]['max']['byteCount'],123)
 def test_transport_rejects_financial_endpoints_and_mutations(self):
  c=q.FreeClient('fake','account')
  for p,m,b in [('/accounts/account/subscriptions','GET',None),('/accounts/account/alerting/v3/policies','POST',b'{}'),('/accounts/account/workers/scripts/black-sky-9ba0/settings','PUT',b'{}'),('/graphql','POST',b'{"query":"mutation { change }"}')]:
   with self.assertRaises(ValueError):c.call(p,m,b)
if __name__=='__main__':unittest.main()
