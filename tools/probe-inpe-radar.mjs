// Explicit opt-in diagnostic, never a cron or an automatic runtime import.
import {discover,ATTRIBUTION} from '../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
const bounds=[-48,-25,-45,-22]; // regional pilot in São Paulo, not user's GPS
try{
 const result=await discover(bounds);
 console.log(JSON.stringify({source:ATTRIBUTION,...result},null,2));
 if(!result.radars.length){console.error('No recent verified metadata; keep RainViewer.');process.exitCode=2;}
}catch(e){console.error('INPE discovery unavailable:',e.message);process.exitCode=1;}
