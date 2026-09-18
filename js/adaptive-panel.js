(function(){
  function classifyPanel(){
    const panel=document.querySelector('#painel-direito');
    if(!panel)return;
    const text=(panel.innerText||'').toLowerCase();
    let type='generic';
    if(/tempestade|inmet|chuva|vendaval|granizo|raio/.test(text))type='storm';
    else if(/terremoto|sismo|magnitude|epicentro|profundidade/.test(text))type='earthquake';
    else if(/furac[aã]o|ciclone|tropical|depress[aã]o tropical/.test(text))type='cyclone';
    panel.setAttribute('data-event-type',type);
  }
  function start(){
    const panel=document.querySelector('#painel-direito');
    if(!panel){setTimeout(start,500);return}
    new MutationObserver(classifyPanel).observe(panel,{subtree:true,childList:true,characterData:true});
    classifyPanel();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

