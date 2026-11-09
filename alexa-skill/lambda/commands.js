'use strict';
const INTENT_TO_COMMAND=Object.freeze({
 BrentIntent:'brent',
 TempoIntent:'weather',
 BrasilIntent:'brazil'
});
function commandForIntent(name){return Object.prototype.hasOwnProperty.call(INTENT_TO_COMMAND,name)?INTENT_TO_COMMAND[name]:null;}
function normalizePairCode(value){
 const digits=String(value??'').replace(/\D/g,'');
 return digits.length>=1&&digits.length<=6?digits.padStart(6,'0'):null;
}
module.exports={commandForIntent,normalizePairCode};