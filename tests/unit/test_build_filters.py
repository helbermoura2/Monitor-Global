import importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('filters',Path(__file__).parents[2]/'tools/cloudflare-build-filters.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Client:
 account='a'*32
 def __init__(self):self.calls=[];self.policy={};self.triggers=[{'trigger_uuid':'b'*32,'build_command':'preserved','branch_includes':['main']}]
 def call(self,path,method='GET',body=None):
  self.calls.append((path,method,body))
  if method=='PATCH':self.policy=json.loads(body);return {}
  if path.endswith('/scripts'):return [{'id':'black-sky-9ba0','tag':'c'*32},{'id':'monitor','tag':'d'*32}]
  return [{**t,**self.policy} for t in self.triggers]
class Tests(unittest.TestCase):
 def test_inspect_never_writes(self):
  c=Client();self.assertFalse(m.apply(c)['applied']);self.assertTrue(all(x[1]=='GET' for x in c.calls))
 def test_apply_changes_only_path_filters_and_backend(self):
  c=Client();self.assertTrue(m.apply(c,True)['applied']);self.assertEqual(set(c.policy),{'path_includes','path_excludes'});self.assertTrue(all('d'*32 not in p for p,_,_ in c.calls));self.assertIn('js/**',c.policy['path_includes'])
 def test_ambiguous_trigger_refused(self):
  c=Client();c.triggers*=2
  with self.assertRaises(ValueError):m.apply(c,True)
  self.assertFalse(any(method=='PATCH' for _,method,_ in c.calls))
