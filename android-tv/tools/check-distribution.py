"""Check public artifacts without private signing material or production calls."""
import hashlib,json,pathlib,re,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
def check(build_tools):
 identity=json.loads((ROOT/'android-tv/signing/identity.json').read_text());config=json.loads((ROOT/'android-tv/distribution/stable.json').read_text());assert config['certificateSha256']==identity['certificateSha256'];assert hashlib.sha256((ROOT/'android-tv/signing/release-certificate.der').read_bytes()).hexdigest()==identity['certificateSha256']
 assert config['repository']=='helbermoura2/Monitor-Global' and config['packageName']==identity['packageName']
 r=config['release'];assert r['enabled'];assert re.fullmatch(r'\d+\.\d+\.\d+',r['versionName']);name=f"monitor-global-tv-{r['versionName']}.apk";assert r['url']=='https://monitorglobal.top/downloads/'+name
 apk=ROOT/'downloads'/name;assert hashlib.sha256(apk.read_bytes()).hexdigest()==r['sha256']
 for sdk in [28,30,34,35]:
  out=subprocess.run([str(pathlib.Path(build_tools)/'apksigner'),'verify','--print-certs','--min-sdk-version',str(sdk),'--max-sdk-version',str(sdk),str(apk)],capture_output=True,text=True,check=True).stdout
  assert 'Signer #1 certificate SHA-256 digest: '+identity['certificateSha256'] in out
 badging=subprocess.run([str(pathlib.Path(build_tools)/'aapt'),'dump','badging',str(apk)],capture_output=True,text=True,check=True).stdout
 assert "versionCode='"+str(r['versionCode'])+"'" in badging and 'application-debuggable' not in badging
 print('PASS: official manifest, APK digest, pinned signer, SDK28/30/34/35 and non-debug release')
if __name__=='__main__':check(sys.argv[1])
