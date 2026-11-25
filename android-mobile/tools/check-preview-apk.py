"""Check the concrete preview APK has phone identity and no TV background components."""
import pathlib, subprocess, sys, tempfile, zipfile
aapt, apk = sys.argv[1:3]
badging = subprocess.check_output([aapt, "dump", "badging", apk], text=True)
permissions = subprocess.check_output([aapt, "dump", "permissions", apk], text=True)
assert "package: name='top.monitorglobal.mobile.dev'" in badging, badging
assert "PhoneActivity" in badging, "Phone launcher missing"
assert "application-label:'Argos Orbis'" in badging, "Android launcher must use Argos Orbis"
source = (pathlib.Path(__file__).resolve().parents[1] / "app/src/main/java/top/monitorglobal/tv/PhoneActivity.java").read_text(encoding="utf-8")
for marker in ("argosorbis.com.br", "https://t.me/argosorbis", 'setTag("argos-logo")', "new RadarLogoView(this)"):
    assert marker in source, "Missing Argos branding: " + marker
assert "https://t.me/monitor_global" not in source
assert "https://monitorglobal.top/" not in source
# The launcher icon is opaque option 3; transparent backgrounds can turn white
# in some launchers (Samsung and Android TV).
import xml.etree.ElementTree as ET
resource_root=pathlib.Path(__file__).resolve().parents[1]/"app/src/main/res/drawable"
icon=ET.parse(resource_root/"ic_launcher_monitor.xml").getroot()
android="{http://schemas.android.com/apk/res/android}"
aapt="{http://schemas.android.com/aapt}"
background=icon.find("path")
assert background is not None and background.get(android+"pathData")=="M0,0H128V128H0Z"
gradient=background.find(aapt+"attr/gradient")
assert gradient is not None and gradient.get(android+"type")=="radial"
colors=[item.get(android+"color") for item in gradient.findall("item")]
assert "#010304" in colors and "#084746" in colors, "Missing black and teal colors from approved icon option 3"
print(next(line for line in badging.splitlines() if line.startswith("package:")))
for unwanted in ["SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "RECEIVE_BOOT_COMPLETED", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE_LOCATION"]:
    assert unwanted not in permissions, unwanted
# Foreground location is an explicitly requested weather-map feature.
for required in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
    assert "android.permission." + required in permissions, required
map_source = (pathlib.Path(__file__).resolve().parents[1] / "app/src/main/java/top/monitorglobal/tv/PhoneMapView.java").read_text(encoding="utf-8")
assert "setGeolocationEnabled(brazilPage)" in map_source
assert "onGeolocationPermissionsShowPrompt" in map_source
assert "requestPermissions" in map_source
assert "callback.invoke(origin,granted,false)" in map_source
assert "https://appassets.androidplatform.net" in map_source
assert "android.permission.INTERNET" in permissions
# Only the user-initiated verified updater may request installations.
assert "android.permission.REQUEST_INSTALL_PACKAGES" in permissions
with zipfile.ZipFile(apk) as packaged:
    manifest = packaged.read("AndroidManifest.xml")
    assert manifest, "Packaged AndroidManifest missing"
with tempfile.TemporaryDirectory(prefix="monitor-phone-assets-") as temporary:
    assets = pathlib.Path(temporary)
    with zipfile.ZipFile(apk) as packaged:
        for name in ["phone-map.html", "phone-map.js", "phone-map.css", "phone-boundaries.js", "phone-boundaries.css", "data/br-states.geojson", "data/br-municipalities-sp.geojson", "vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "brazil-satellite.js", "brazil-satellite-model.js", "brazil-satellite.css", "data/brazil-satellite-border.json"]:
            target = assets / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(packaged.read("assets/" + name))
    subprocess.run(["node", str(pathlib.Path(__file__).with_name("check-phone-map.cjs")), "--asset-root", str(assets)], check=True)
print("Phone preview package, launcher, permissions and packaged map startup verified.")
