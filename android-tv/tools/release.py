"""Sign and validate official TV APKs; secrets are file inputs and are never logged."""
import argparse,hashlib,json,os,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
def run(args):
 p=subprocess.run([str(x) for x in args],capture_output=True,text=True)
 if p.returncode:raise SystemExit('Signing/verification failed; check protected key, public identity and build tools.')
 return p.stdout

def release(unsigned,output,keystore,password,build_tools):
 identity=json.loads((ROOT/'android-tv/signing/identity.json').read_text());tools=pathlib.Path(build_tools)
 badging=run([tools/'aapt','dump','badging',unsigned]);match=re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",badging)
 if not match:raise SystemExit('APK metadata missing')
 package,code,version=match.groups();code=int(code)
 if package!=identity['packageName'] or 'application-debuggable' in badging or not re.fullmatch(r'\d+\.\d+\.\d+',version):raise SystemExit('Not an official release build')
 sdk=re.search(r"sdkVersion:'(\d+)'",badging)
 if not sdk or int(sdk[1])<28:raise SystemExit('Signing rotation requires Android 9/API 28+')
 out=pathlib.Path(output);out.mkdir(parents=True,exist_ok=True);apk=out/f'monitor-global-tv-{version}.apk'
 run([tools/'apksigner','sign','--ks',keystore,'--ks-key-alias',identity['keyAlias'],'--ks-pass','file:'+str(password),'--lineage',ROOT/'android-tv/signing/lineage.bin','--rotation-min-sdk-version','28','--min-sdk-version','28','--v1-signing-enabled','false','--v2-signing-enabled','false','--v3-signing-enabled','true','--v4-signing-enabled','false','--out',apk,unsigned])
 for sdk in [28,30,34,35]:
  verified=run([tools/'apksigner','verify','--print-certs','--min-sdk-version',sdk,'--max-sdk-version',sdk,apk])
  digest=re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]+)',verified)
  if not digest or digest[1]!=identity['certificateSha256']:raise SystemExit('Unexpected signing certificate; publication refused')
 checksum=hashlib.sha256(apk.read_bytes()).hexdigest();(out/(apk.name+'.sha256')).write_text(checksum+'  '+apk.name+'\n')
 config=json.loads((ROOT/'android-tv/distribution/stable.json').read_text())
 config['release']={'enabled':True,'versionCode':code,'versionName':version,'url':'https://monitorglobal.top/downloads/'+apk.name,'sha256':checksum}
 (out/'stable.json').write_text(json.dumps(config,indent=2)+'\n');print(json.dumps({'apk':apk.name,'version':version,'versionCode':code,'sha256':checksum,'certificateSha256':identity['certificateSha256']}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--unsigned',required=True,type=pathlib.Path);p.add_argument('--output',required=True);p.add_argument('--keystore',required=True);p.add_argument('--password-file',required=True);p.add_argument('--build-tools',required=True);a=p.parse_args();release(a.unsigned,a.output,a.keystore,a.password_file,a.build_tools)
