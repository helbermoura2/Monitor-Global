import importlib.util
from pathlib import Path
import json
import unittest
from unittest import mock
import io
spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).resolve().parents[2]/'tools/cloudflare-worker-maintenance.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MaintenanceTests(unittest.TestCase):
    def settings(self):
        return {'compatibility_date':'2024-09-01','compatibility_flags':['nodejs_compat'],'bindings':[{'name':'TTS_USAGE','type':'kv_namespace','namespace_id':'old-kv'},{'name':'DAILY_SUMMARY','type':'durable_object_namespace','namespace_id':'old-summary'},{'name':'EARTHQUAKE_ALERTS','type':'durable_object_namespace','namespace_id':'old-alerts'},{'name':'ADMIN_TOKEN','type':'secret_text'},{'name':'CONFIG','type':'plain_text','text':'keep-existing-value'},{'name':'AI','type':'ai'}],'limits':{'cpu_ms':10},'observability':{'enabled':True}}
    def test_credentials_reject_missing_or_url_without_echoing_values(self):
        with self.assertRaises(m.MaintenanceError):m.credentials({})
        with self.assertRaises(m.MaintenanceError) as e:m.credentials({'CLOUDFLARE_API_TOKEN':'private','CLOUDFLARE_ACCOUNT_ID':'https://dash.cloudflare.com/private'})
        self.assertNotIn('private',str(e.exception))
    def test_deploy_preserves_all_existing_types_and_runtime_without_new_resources(self):
        settings=self.settings();meta=m.metadata(settings)
        self.assertEqual(meta['keep_bindings'],['ai','durable_object_namespace','kv_namespace','plain_text','secret_text'])
        self.assertEqual(meta['compatibility_date'],settings['compatibility_date']);self.assertEqual(meta['limits'],settings['limits']);self.assertEqual(meta['observability'],settings['observability'])
        for key in ['bindings','migrations','exports','usage_model']:self.assertNotIn(key,meta)
        self.assertNotIn('keep-existing-value',json.dumps(meta))
        del settings['compatibility_date']
        with self.assertRaises(m.MaintenanceError):m.metadata(settings)
        settings=self.settings();settings['bindings'].pop(0)
        with self.assertRaises(m.MaintenanceError):m.metadata(settings)
    def test_reviewed_bundle_and_multipart_preserve_module(self):
        source=m.bundle(Path(__file__).resolve().parents[2]/'downloads/monitor-global-worker-sem-pesquisas.zip')
        body,content_type=m.multipart(m.metadata(self.settings()),source)
        self.assertIn('boundary=',content_type);self.assertIn(b'name="metadata"',body);self.assertIn(b'application/javascript+module',body);self.assertIn(source,body)
    def test_analytics_missing_account_is_not_zero(self):
        class Client:
            account='a'*32
            def call(self,*args):return {'data':{'viewer':{'accounts':[]}}}
        with self.assertRaises(m.MaintenanceError):m.analytics(Client())
    def test_public_propagation_can_be_verified_without_a_second_upload(self):
        values=iter([{'electionPolls':'old'},{'electionPolls':m.MARKER}]);waits=[]
        result=m.verify_public(check=lambda:next(values),wait=waits.append,attempts=2)
        self.assertEqual(result['electionPolls'],m.MARKER);self.assertEqual(waits,[5])
        with self.assertRaisesRegex(m.MaintenanceError,'without redeploying'):
            m.verify_public(check=lambda:{},wait=lambda seconds:None,attempts=1)
    def test_health_client_identifies_the_application_to_the_public_endpoint(self):
        with mock.patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps({'electionPolls':m.MARKER}).encode())) as call:
            self.assertEqual(m.public_health()['electionPolls'],m.MARKER)
            request=call.call_args.args[0]
            self.assertEqual(request.get_header('User-agent'),'MonitorGlobal-maintenance/1.0')
if __name__=='__main__':unittest.main()
