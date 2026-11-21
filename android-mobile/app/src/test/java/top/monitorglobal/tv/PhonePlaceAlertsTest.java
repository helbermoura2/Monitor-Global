package top.monitorglobal.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class PhonePlaceAlertsTest {
 @Test public void savedPlaceRespectsMagnitudeRadiusAndActivation(){
  PhonePlaceAlerts.Place place=new PhonePlaceAlerts.Place("São Paulo",-23.55,-46.63,150,5,1000);
  Alert quake=new Alert("us123","earthquake","1","Sismo","","earthquake",1000,1000,true);
  quake.magnitude=5;
  assertTrue(place.valid());
  assertTrue(place.matches(quake,150));
  assertFalse(place.matches(quake,150.01));
  quake.magnitude=4.99;
  assertFalse(place.matches(quake,30));
  quake.magnitude=5.5;
  assertFalse(new PhonePlaceAlerts.Place("SP",-23.55,-46.63,150,5,1001).matches(quake,30));
 }
 @Test public void proximityWrapsAcrossDateLine(){
  assertEquals(22.24,PhoneQuakeData.distance(0,179.9,0,-179.9),.1);
 }
}
