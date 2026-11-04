"""Check the concrete preview APK has phone identity and no TV background components."""
import pathlib, subprocess, sys, tempfile, zipfile
aapt, apk = sys.argv[1:3]
badging = subprocess.check_output([aapt, "dump", "badging", apk], text=True)
permissions = subprocess.check_output([aapt, "dump", "permissions", apk], text=True)
assert "package: name='top.monitorglobal.mobile.dev'" in badging, badging
assert "PhoneActivity" in badging, "Phone launcher missing"
print(next(line for line in badging.splitlines() if line.startswith("package:")))
for unwanted in ["SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "RECEIVE_BOOT_COMPLETED", "REQUEST_INSTALL_PACKAGES", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]:
    assert unwanted not in permissions, unwanted
assert "android.permission.INTERNET" in permissions
with tempfile.TemporaryDirectory(prefix="monitor-phone-assets-") as temporary:
    assets = pathlib.Path(temporary)
    with zipfile.ZipFile(apk) as packaged:
        for name in ["phone-map.html", "phone-map.js", "phone-map.css", "vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "brazil-satellite.js", "brazil-satellite-model.js", "brazil-satellite.css", "data/brazil-satellite-border.json"]:
            target = assets / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(packaged.read("assets/" + name))
    subprocess.run(["node", str(pathlib.Path(__file__).with_name("check-phone-map.cjs")), "--asset-root", str(assets)], check=True)
print("Phone preview package, launcher, permissions and packaged map startup verified.")
