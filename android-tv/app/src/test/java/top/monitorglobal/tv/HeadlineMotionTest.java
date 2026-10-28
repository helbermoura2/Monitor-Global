package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
public class HeadlineMotionTest {
 @Test public void entireCountryBecomesVisibleAndReturnsWithinEachPage(){for(long duration:new long[]{6000,8000}){
  assertEquals(0,HeadlineMotion.offset(200,0,duration),.01);
  assertEquals(200,HeadlineMotion.offset(200,duration/2,duration),.01);
  assertEquals(0,HeadlineMotion.offset(200,duration,duration),.01);
  for(int i=0;i<=100;i++){float x=HeadlineMotion.offset(200,duration*i/100,duration);assertTrue(x>=0&&x<=200);}
 }}
 @Test public void shortTitlesAndInvalidDurationStayStill(){assertEquals(0,HeadlineMotion.offset(-20,3000,6000),0);assertEquals(0,HeadlineMotion.offset(200,3000,0),0);}
}
