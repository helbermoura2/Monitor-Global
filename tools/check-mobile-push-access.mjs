import fs from 'node:fs';
import {sendFcm} from '../worker/mobile-push.mjs';
// Validate without delivering a message. Never print credentials or raw server bodies.
const required=['FIREBASE_SERVICE_ACCOUNT','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'];
for(const name of required)if(!process.env[name]){console.error('Missing repository Secret: '+name);process.exit(1);}
let account;try{account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);}catch{console.error('FIREBASE_SERVICE_ACCOUNT must contain the complete service-account JSON.');process.exit(1);}
const client=JSON.parse(fs.readFileSync('android-mobile/app/firebase-client.json','utf8'));
if(account.type!=='service_account'||typeof account.private_key!=='string'||typeof account.client_email!=='string'||account.project_id!==client.project_info.project_id){console.error('Service-account format or Firebase project does not match the public Android configuration.');process.exit(1);}
try{await sendFcm(process.env,{topic:'monitor_global_alerts_v1',data:{probe:'configuration-validation'},android:{priority:'NORMAL',ttl:'0s'}},fetch,Date.now(),true);console.log('Firebase OAuth and FCM permission verified with validate_only=true. No notification was sent.');}catch(error){const message=String(error?.message||'');console.error(message.startsWith('Firebase ')?message:'Firebase credential validation failed. Check the saved JSON and private-key format.');process.exit(1);}
