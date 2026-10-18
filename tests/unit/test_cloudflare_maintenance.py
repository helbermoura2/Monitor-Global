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
        source=m.bundle(Path(__file__).resolve().parents[2]/'downloads/monitor-global-worker-otimizado.zip')
        body,content_type=m.multipart(m.metadata(self.settings()),source)
        self.assertIn('boundary=',content_type);self.assertIn(b'name="metadata"',body);self.assertIn(b'application/javascript+module',body);self.assertIn(source,body)
    def test_analytics_missing_account_is_not_zero(self):
        class Client:
            account='a'*32
            def call(self,*args):return {'data':{'viewer':{'accounts':[]}}}
        with self.assertRaises(m.MaintenanceError):m.analytics(Client())
    def test_public_propagation_can_be_verified_without_a_second_upload(self):
        values=iter([{'electionPolls':'old'},{'sourceEdgeBudget':m.SOURCE_EDGE_BUDGET,'durableRequestBudget':m.REQUEST_BUDGET,'workerModules':m.WORKER_MODULES,'electionPolls':m.MARKER,'kvOptimization':m.OPTIMIZATION,'kvUsageMetrics':True,'telegramStorage':'durable-history-v1','sharedSources':{'version':'shared-sources-v1','enabled':True}}]);waits=[]
        result=m.verify_public(check=lambda:next(values),wait=waits.append,attempts=2)
        self.assertEqual(result['electionPolls'],m.MARKER);self.assertEqual(waits,[5])
        with self.assertRaisesRegex(m.MaintenanceError,'without redeploying'):
            m.verify_public(check=lambda:{},wait=lambda seconds:None,attempts=1)
    def test_metrics_credential_is_scoped_and_never_the_parent_token(self):
        token=m.metrics_token('private','a'*32)
        self.assertEqual(len(token),64);self.assertNotIn('private',token)
        self.assertEqual(token,m.metrics_token('private','a'*32))
        self.assertNotEqual(token,m.metrics_token('private','b'*32))
        client=mock.Mock();client.worker.return_value='/worker/secrets'
        m.provision_metrics(client,token)
        args=client.call.call_args.args
        self.assertEqual(args[:2],('/worker/secrets','PUT'))
        self.assertEqual(json.loads(args[2]),{'name':'KV_METRICS_READ_TOKEN','type':'secret_text','text':token})
    def test_inspection_is_read_only_and_does_not_provision_a_secret(self):
        client=mock.Mock();client.worker.side_effect=lambda suffix='':'/worker'+suffix
        settings=self.settings()
        client.call.side_effect=lambda path,*args: settings if path=='/worker/settings' else []
        env={'CLOUDFLARE_API_TOKEN':'private','CLOUDFLARE_ACCOUNT_ID':'a'*32,'MAINTENANCE_MODE':'inspect'}
        with mock.patch.dict(m.os.environ,env,clear=True),mock.patch.object(m,'Client',return_value=client),mock.patch.object(m,'analytics',return_value={}),mock.patch.object(m,'read_usage',return_value={'available':False}),mock.patch.object(m,'provision_metrics') as provision,mock.patch('sys.stdout',new_callable=io.StringIO) as out:
            m.main()
        provision.assert_not_called();self.assertTrue(all(len(c.args)==1 for c in client.call.call_args_list))
        self.assertNotIn('private',out.getvalue())
    def test_deploy_preserves_valid_metrics_secret_when_newer_preview_exists(self):
        settings=self.settings();settings['bindings'].append({'name':'KV_METRICS_READ_TOKEN','type':'secret_text'})
        client=mock.Mock();client.worker.side_effect=lambda suffix='':'/worker'+suffix
        def call(path,*args):
            if path=='/worker/settings':return settings
            if path=='/worker/schedules':return []
            if path=='/worker/deployments':return {'deployments':[{'versions':[{'version_id':'old','percentage':100}]}]}
            if path.startswith('/worker?'):return {'deployment_id':'new'}
            raise AssertionError(path)
        client.call.side_effect=call
        env={'CLOUDFLARE_API_TOKEN':'private','CLOUDFLARE_ACCOUNT_ID':'a'*32,'MAINTENANCE_MODE':'deploy'}
        with mock.patch.dict(m.os.environ,env,clear=True),mock.patch.object(m,'Client',return_value=client),mock.patch.object(m,'analytics',return_value={}),mock.patch.object(m,'bundle',return_value=b'reviewed'),mock.patch.object(m,'read_usage',return_value={'available':True}),mock.patch.object(m,'verify_public',return_value={}),mock.patch.object(m,'provision_metrics') as provision,mock.patch('sys.stdout',new_callable=io.StringIO):
            m.main()
        provision.assert_not_called()
        self.assertEqual(sum(c.args[0].startswith('/worker?') for c in client.call.call_args_list),1)
    def test_public_source_probe_only_reads_public_feed_and_reports_cache_without_bodies(self):
        response=mock.MagicMock();response.status=200;response.headers={'X-Monitor-Source-State':'fresh','X-Monitor-Source-Edge':'memory'}
        response.__enter__.return_value=response
        with mock.patch.object(m.urllib.request,'urlopen',return_value=response) as call:
            result=m.public_source_probe()
        self.assertEqual(len(result['reads']),3);self.assertEqual(call.call_count,3)
        self.assertTrue(all(row['edge']=='memory' for row in result['reads']))
        self.assertTrue(all(c.args[0].get_method()=='GET' and '/?url=' in c.args[0].full_url for c in call.call_args_list))

    def test_health_client_identifies_the_application_to_the_public_endpoint(self):
        with mock.patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps({'electionPolls':m.MARKER}).encode())) as call:
            self.assertEqual(m.public_health()['electionPolls'],m.MARKER)
            request=call.call_args.args[0]
            self.assertEqual(request.get_header('User-agent'),'MonitorGlobal-maintenance/1.0')
if __name__=='__main__':unittest.main()
