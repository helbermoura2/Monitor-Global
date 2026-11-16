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
 static boolean isDay(long epochMillis){return WeatherForecast.isDay(epochMillis);}

}
