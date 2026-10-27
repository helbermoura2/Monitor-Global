import importlib.util,json,pathlib,unittest
spec=importlib.util.spec_from_file_location('audit',pathlib.Path(__file__).resolve().parents[2]/'tools/cloudflare-account-audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class AuditTests(unittest.TestCase):
 def test_read_only_transport_refuses_policy_mutations_and_graphql_mutations(self):
  c=audit.ReadOnlyClient('fake','account')
  for path,method,body in [('/accounts/account/alerting/v3/policies','POST',b'{}'),('/accounts/account/subscriptions','PUT',b'{}'),('/graphql','POST',b'{"query":"mutation { change }"}')]:
   with self.assertRaises(ValueError):c.call(path,method,body)
 def test_no_recipient_or_webhook_in_policy_report(self):
  result=audit.policies([{'alert_type':'billing','name':'private@example.com','mechanisms':{'email':[{'id':'private@example.com'}],'webhooks':[{'url':'https://secret.invalid/token'}]},'enabled':True}]);text=json.dumps(result)
  self.assertNotIn('private',text);self.assertNotIn('secret',text);self.assertEqual(result[0]['destinationCounts'],{'email':1,'webhooks':1})
 def test_subscription_has_no_billing_identity(self):
  result=audit.subscriptions([{'rate_plan':{'public_name':'Workers Paid','currency':'USD'},'price':5,'address':'private address','customer':{'email':'private@example.com'}}]);self.assertNotIn('private',json.dumps(result));self.assertEqual(result[0]['reportedPrice'],5)
 def test_alert_options_ignore_destination_data(self):
  result=audit.alert_types({'billing':[{'type':'usage','display_name':'Usage','description':'Usage threshold','email':'private@example.com'}]});self.assertEqual(len(result),1);self.assertNotIn('private',json.dumps(result))
 def test_destinations_only_report_eligibility(self):
  self.assertEqual(audit.destinations({'email':{'eligible':True,'ready':True,'address':'private'}}),{'email':{'eligible':True,'ready':True}})
if __name__=='__main__':unittest.main()
