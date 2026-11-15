package top.monitorglobal.tv;

/**
 * Solar horizon at the fixed Liberdade, Sao Paulo forecast point.
 * Uses the observation instant (UTC epoch milliseconds), not the device clock's timezone.
 * The -0.833 degree threshold accounts approximately for atmospheric refraction at sunrise/sunset.
 * This affects only local weather artwork; it does not change the provider's forecast.
 */
final class PhoneDaylight {
 private static final double LATITUDE=Math.toRadians(-23.555);
 private static final double LONGITUDE=-46.635;
 private PhoneDaylight(){}
 static boolean isDay(long epochMillis) {
  // Low-cost solar coordinates derived from Julian days after J2000.
  double d=epochMillis/86400000.0+2440587.5-2451545.0;
  double meanLongitude=280.460+0.9856474*d;
  double anomaly=Math.toRadians(357.528+0.9856003*d);
  double eclipticLongitude=Math.toRadians(meanLongitude+1.915*Math.sin(anomaly)+0.020*Math.sin(2*anomaly));
  double obliquity=Math.toRadians(23.439-0.0000004*d);
  double rightAscension=Math.toDegrees(Math.atan2(
   Math.cos(obliquity)*Math.sin(eclipticLongitude),Math.cos(eclipticLongitude)));
  double declination=Math.asin(Math.sin(obliquity)*Math.sin(eclipticLongitude));
  double siderealLongitude=280.46061837+360.98564736629*d+LONGITUDE;
  double hourAngle=Math.toRadians(Math.IEEEremainder(siderealLongitude-rightAscension,360.0));
  double sinElevation=Math.sin(LATITUDE)*Math.sin(declination)+
   Math.cos(LATITUDE)*Math.cos(declination)*Math.cos(hourAngle);
  return sinElevation>=Math.sin(Math.toRadians(-0.833));
 }
}
