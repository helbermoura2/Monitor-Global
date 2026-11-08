package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;
public class RuntimeCpuCheckTest {
 @Test public void cpuIsNormalizedToOneCoreAndSupportsMultiCore(){
  assertEquals(20d,RuntimeDiagnostics.cpuPercentOneCore(1000,1000,1200,2000),0.01);
  assertEquals(140d,RuntimeDiagnostics.cpuPercentOneCore(1000,1000,2400,2000),0.01);
  assertTrue(Double.isNaN(RuntimeDiagnostics.cpuPercentOneCore(1000,2000,1200,2000)));
  assertTrue(Double.isNaN(RuntimeDiagnostics.cpuPercentOneCore(1200,1000,1000,2000)));
 }
}
