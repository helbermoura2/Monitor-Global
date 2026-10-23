/* Source depth is distinct from a model assumption and display rounding. */
(function(root){'use strict';
const numeric=v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v));
function describe(item={}){const raw=Object.prototype.hasOwnProperty.call(item,'depthReported')?item.depthReported:item.depth,known=numeric(raw),value=known?Number(raw):null,assumed=!known||value<=0,modelKm=assumed?10:Math.max(1,value),format=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});return {known,value,modelKm,assumed,status:!known?'unknown':value===0?'zero':value<0?'negative':'reported',label:known?(value>0&&value<.01?'<0,01':format(value))+' km':'Não informada',note:!known?'Profundidade não informada; modelos radiais adotam 10 km.':value===0?'Zero informado pela fonte; modelos radiais adotam 10 km.':value<0?'Valor negativo informado pela fonte; modelos radiais adotam 10 km.':value>0&&value<1?'Profundidade menor que 1 km; exibida sem arredondar para zero.':''};}
root.SeismicDepth={describe};if(typeof module!=='undefined')module.exports=root.SeismicDepth;
})(globalThis);
