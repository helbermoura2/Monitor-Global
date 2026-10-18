// Disposable public-source snapshots only. Delivery history and quotas never use this.
const INTERVAL=15*60*1000;
export class SourceWritebackCache {
 constructor(storage){this.storage=storage;this.values=new Map();this.dirty=new Set();this.nextFlush=0;this.lastFailure=0;this.circuitRetryAt=0;}
 async get(key){if(!this.values.has(key)){let value;try{value=await this.storage.get(key);}catch{this.lastFailure=Date.now();}this.values.set(key,value);}return structuredClone(this.values.get(key));}
 async put(key,value){this.values.set(key,structuredClone(value));this.dirty.add(key);}
 async delete(key){this.values.set(key,undefined);this.dirty.add(key);}
 async getAlarm(){return null;}
 async setAlarm(){} // Cleanup runs with source requests; no recurring billable alarms.
 async transaction(work){const values=new Map(this.values),dirty=new Set(this.dirty);try{return await work(this);}catch(error){this.values=values;this.dirty=dirty;throw error;}}
 async flush(now=Date.now()){
  if(!this.dirty.size)return false;
  if(now<this.nextFlush){
   // Persist provider backoff promptly so an eviction cannot cause a retry storm.
   const circuit=this.values.get('source-circuit');
   if(this.dirty.has('source-circuit')&&circuit?.failures>0&&now>=this.circuitRetryAt){
    this.circuitRetryAt=now+30000;
    try{await this.storage.put('source-circuit',circuit);this.dirty.delete('source-circuit');return true;}catch{this.lastFailure=now;}
   }
   return false;
  }
  this.nextFlush=now+INTERVAL;
  const keys=[...this.dirty],values=new Map(keys.map(key=>[key,this.values.get(key)]));
  const write=async storage=>{for(const key of keys){const value=values.get(key);if(value===undefined)await storage.delete(key);else await storage.put(key,value);}};
  try{if(this.storage.transaction)await this.storage.transaction(write);else await write(this.storage);for(const key of keys){this.dirty.delete(key);if(this.values.get(key)===undefined)this.values.delete(key);}this.lastFailure=0;return true;}
  catch{this.lastFailure=now;console.warn('Source snapshot checkpoint unavailable; serving timestamped cache and retrying in 15 minutes.');return false;}
 }
}
