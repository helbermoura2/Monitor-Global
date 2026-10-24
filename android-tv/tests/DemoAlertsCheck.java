package top.monitorglobal.tv;
import java.util.*;
public class DemoAlertsCheck {
 public static void main(String[] args){
  List<Alert> a=DemoAlerts.create("sequence",1800000000000L);
  if(a.size()!=4||!a.get(0).kind.equals("earthquake")||!a.get(1).kind.equals("tsunami")||!a.get(3).state.equals("ended"))throw new AssertionError("Demo order must be quake, bulletin, revision, ending");
  if(!a.get(1).relatedQuakeId.equals(a.get(0).id)||!a.get(2).id.equals(a.get(0).id)||!a.get(3).id.equals(a.get(1).id))throw new AssertionError("Demonstration must keep the same earthquake and bulletin identities");
  if(!a.get(2).revision.equals("M7,2 → M6,9")||a.get(3).eligible)throw new AssertionError("Revised value and regional ending must be explicit");
  for(Alert x:a)if(!x.title.contains("EXEMPLO")||!x.id.startsWith("demo-"))throw new AssertionError("All demonstrations must remain fictional");
  for(String mode:List.of("quake","revision","tsunami","ended"))if(DemoAlerts.create(mode,1800000000000L).size()!=1)throw new AssertionError("Individual test must show one case");
  System.out.println("PASS: fictional, related, chronological demonstrations and explicit revision/ending");
 }
}
