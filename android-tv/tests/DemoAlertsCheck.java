package top.monitorglobal.tv;
import java.util.*;
public class DemoAlertsCheck {
 public static void main(String[] args){
  List<Alert> a=DemoAlerts.create("sequence",1800000000000L);
  if(a.size()!=4||!a.get(0).kind.equals("earthquake")||a.get(0).companion==null||!a.get(2).state.equals("ended"))throw new AssertionError("Demo must combine quake/bulletin, then revision and ending");
  if(!a.get(0).companion.relatedQuakeId.equals(a.get(0).id)||!a.get(1).id.equals(a.get(0).id)||!a.get(2).id.equals(a.get(0).companion.id))throw new AssertionError("Related identities must survive the combined presentation");
  if(!a.get(1).revision.equals("M7,2 → M6,9")||a.get(1).previousMagnitude!=7.2||a.get(2).eligible)throw new AssertionError("Previous/current magnitude and regional ending must be explicit");
  for(Alert x:a)if(!x.title.contains("EXEMPLO")||!x.id.startsWith("demo-"))throw new AssertionError("All demonstrations must remain fictional");
  for(String mode:List.of("quake","revision","tsunami","ended","noThreat"))if(DemoAlerts.create(mode,1800000000000L).size()!=1)throw new AssertionError("Individual tests must show one presentation");
  if(!a.get(3).state.equals("noThreat")||!a.get(3).quietInformation()||a.get(3).companion==null)throw new AssertionError("No-threat demo must be regional, quiet and paired");
  System.out.println("PASS: fictional combined presentation, revision and ending");
 }
}
