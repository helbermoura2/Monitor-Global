"""Check the concrete preview APK has phone identity and no TV background components."""
import pathlib, subprocess, sys
aapt, apk = sys.argv[1:3]
badging = subprocess.check_output([aapt, "dump", "badging", apk], text=True)
permissions = subprocess.check_output([aapt, "dump", "permissions", apk], text=True)
assert "package: name='top.monitorglobal.mobile.dev'" in badging, badging
assert "PhoneActivity" in badging, "Phone launcher missing"
for unwanted in ["SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "RECEIVE_BOOT_COMPLETED", "REQUEST_INSTALL_PACKAGES", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]:
    assert unwanted not in permissions, unwanted
assert "android.permission.INTERNET" in permissions
print("Phone preview package, launcher and permissions verified.")
