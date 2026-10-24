import importlib.util,json,pathlib,tempfile,unittest,shutil,os
ROOT=pathlib.Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('distribution',ROOT/'android-tv/tools/check-distribution.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DistributionGuards(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.old=module.ROOT;module.ROOT=self.root
  for name in ['android-tv/signing/identity.json','android-tv/signing/release-certificate.der','android-tv/distribution/stable.json']:
   path=self.root/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,path)
  self.config=json.loads((self.root/'android-tv/distribution/stable.json').read_text());version=self.config['release']['versionName'];name=f'downloads/monitor-global-tv-{version}.apk';p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,p);self.apk=p
 def tearDown(self):module.ROOT=self.old;self.tmp.cleanup()
 def write(self):(self.root/'android-tv/distribution/stable.json').write_text(json.dumps(self.config))
 def test_rejects_foreign_host(self):
  self.config['release']['url']='https://evil.example/fake.apk';self.write()
  with self.assertRaises(AssertionError):module.check('/no-build-tools-needed')
 def test_rejects_tampered_apk(self):
  self.apk.write_bytes(self.apk.read_bytes()+b'corruption')
  with self.assertRaises(AssertionError):module.check('/no-build-tools-needed')
 def test_rejects_other_signing_identity(self):
  self.config['certificateSha256']='0'*64;self.write()
  with self.assertRaises(AssertionError):module.check('/no-build-tools-needed')
 def test_release_workflow_is_owner_main_and_dispatch_only(self):
  text=(ROOT/'.github/workflows/android-tv-release.yml').read_text()
  for guard in ["github.repository == 'helbermoura2/Monitor-Global'","github.ref == 'refs/heads/main'","github.actor == 'helbermoura2'",'environment: android-tv-release','workflow_dispatch:','inputs.mode == \'publish\'']:
   self.assertIn(guard,text)
  self.assertNotIn('pull_request:',text);self.assertNotIn('pull_request_target:',text);self.assertIn('Remove transient signing input',text)
 def test_no_private_material_in_signing_directory(self):
  self.assertEqual({p.name for p in (ROOT/'android-tv/signing').iterdir()},{'identity.json','lineage.bin','release-certificate.der'})
if __name__=='__main__':unittest.main()
