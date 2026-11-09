'use strict';
// Alexa-hosted Node.js; Amazon validates the request before invoking the Lambda.
// No shared secret, Alexa password, or device credential in public GitHub.
const Alexa=require('ask-sdk');
const AWS=require('aws-sdk');
const {DynamoDbPersistenceAdapter}=require('ask-sdk-dynamodb-persistence-adapter');
const {commandForIntent,normalizePairCode}=require('./commands');
const API='https://black-sky-9ba0.terrestre.workers.dev/alexa/v1';
const adapter=new DynamoDbPersistenceAdapter({
 tableName:process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
 createTable:false,
 dynamoDBClient:new AWS.DynamoDB({apiVersion:'latest',region:process.env.DYNAMODB_PERSISTENCE_REGION})
});
const response=(input,spoken,keep=false)=>{const b=input.responseBuilder.speak(spoken);if(keep)b.reprompt('Pode dizer Brent, temperatura ou sismo no Brasil.');return b.withShouldEndSession(!keep).getResponse();};
const isIntent=(h,name)=>Alexa.getRequestType(h.requestEnvelope)==='IntentRequest'&&Alexa.getIntentName(h.requestEnvelope)===name;
async function callBridge(path,body,token=''){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3800);
 try{
  const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
  const parsed=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,data:parsed};
 }finally{clearTimeout(timer);}
}
const Launch={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==='LaunchRequest',
 async handle(h){
  const p=await h.attributesManager.getPersistentAttributes();
  return response(h,p.skillToken?'Monitor Global pronto. Diga mostrar Brent, temperatura ou último sismo no Brasil.':'Bem-vindo ao Monitor Global. Na televisão, abra o aplicativo e escolha Vincular Alexa. Depois diga vincular código e os seis números mostrados na TV.',true);
 }
};
const Link={
 canHandle:h=>isIntent(h,'LinkIntent'),
 async handle(h){
  const slot=Alexa.getSlotValue(h.requestEnvelope,'codigo'),code=normalizePairCode(slot);
  if(!code)return response(h,'Não entendi os seis dígitos. Diga vincular código e os números mostrados na televisão.',true);
  try{
   const result=await callBridge('/link',{code});
   if(!result.ok){
    if(result.status===429)return response(h,'Foram feitas muitas tentativas. Tente novamente mais tarde.');
    if(result.status===404||result.status===400)return response(h,'Esse código não foi encontrado ou expirou. Peça um novo código na TV e tente novamente.',true);
    return response(h,'A ligação com o Monitor Global está temporariamente indisponível. Tente novamente.',true);
   }
   if(!/^[a-f0-9]{64}$/.test(result.data.skillToken||''))throw Error('invalid link');
   const persistent=await h.attributesManager.getPersistentAttributes();
   h.attributesManager.setPersistentAttributes({...persistent,skillToken:result.data.skillToken});
   await h.attributesManager.savePersistentAttributes();
   return response(h,'Pronto, o Monitor Global está vinculado à sua Alexa! Você já pode pedir para mostrar o Brent, o tempo ou os sismos brasileiros.');
  }catch{return response(h,'Não consegui concluir o vínculo com a televisão. Tente novamente.',true);}
 }
};
const Cards={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==='IntentRequest'&&Boolean(commandForIntent(Alexa.getIntentName(h.requestEnvelope))),
 async handle(h){
  const command=commandForIntent(Alexa.getIntentName(h.requestEnvelope));
  const persistent=await h.attributesManager.getPersistentAttributes();
  if(!/^[a-f0-9]{64}$/.test(persistent.skillToken||''))return response(h,'Primeiro vincule o Monitor Global à sua televisão. Abra o aplicativo na TV, escolha Vincular Alexa e diga vincular código seguido dos seis números.',true);
  try{
   const result=await callBridge('/command',{command},persistent.skillToken);
   if(result.ok&&result.data.accepted){
    const label=command==='brent'?'Brent':command==='weather'?'temperatura':'sismos no Brasil';
    return response(h,'Pedido enviado. O Monitor Global vai consultar e mostrar o card de '+label+' na televisão.');
   }
   if(result.status===401)return response(h,'A ligação com a TV expirou. Vincule o Monitor Global novamente usando um novo código.');
   if(result.status===409)return response(h,'A televisão não está conectada ao Monitor Global agora. Ligue o monitoramento no aplicativo da TV e tente novamente.');
   if(result.status===429)return response(h,'Já recebi um comando. Tente novamente em alguns segundos.');
   return response(h,'Não foi possível enviar o comando. Tente novamente.');
  }catch{return response(h,'Não consegui comunicar com o Monitor Global neste momento. Tente novamente.');}
 }
};
const Help={
 canHandle:h=>isIntent(h,'AMAZON.HelpIntent')||isIntent(h,'AMAZON.FallbackIntent'),
 handle:h=>response(h,'Posso enviar os cards do Brent, temperatura de São Paulo ou sismos no Brasil à sua TV. Para vincular, diga vincular código e os seis números mostrados no aplicativo.',true)
};
const Stop={
 canHandle:h=>isIntent(h,'AMAZON.StopIntent')||isIntent(h,'AMAZON.CancelIntent'),
 handle:h=>response(h,'Até logo!')
};
const End={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==='SessionEndedRequest',
 handle:h=>h.responseBuilder.getResponse()
};
exports.handler=Alexa.SkillBuilders.custom()
 .addRequestHandlers(Launch,Link,Cards,Help,Stop,End)
 .addErrorHandlers({canHandle:()=>true,handle:h=>response(h,'O Monitor Global não conseguiu concluir o pedido. Tente novamente.')})
 .withPersistenceAdapter(adapter)
 .lambda();
