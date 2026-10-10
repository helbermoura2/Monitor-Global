/* Faixa de vidro única no desktop e no celular. A fila não vence antes de ser exibida. */
(() => {
  const media=window.matchMedia('(max-width:900px)');
  const active=new Map(),history=[],recent=new Map();
  const priority={newquake:5,error:4,revision:3,warning:2,info:1};
  let stack,timer,frame,sequence=0,current=null;
  const $=id=>document.getElementById(id);
  function ensure(){
    if(stack)return stack;
    stack=document.createElement('div');stack.id='mobile-notice-stack';
    stack.setAttribute('aria-live','polite');stack.setAttribute('aria-atomic','true');
    stack.addEventListener('click',event=>event.stopPropagation());document.body.appendChild(stack);return stack;
  }
  function position(){
    frame=null;if(!stack)return;
    if(!media.matches){
      if(stack.parentNode!==document.body)document.body.appendChild(stack);
      stack.classList.toggle('notice-inline',false);
      stack.style.removeProperty('--notice-bottom');
      const headerBottom=Math.max($('top-strip')?.getBoundingClientRect().bottom||0,$('ux-controlbar')?.getBoundingClientRect().bottom||0,$('latest-event-ticker')?.getBoundingClientRect().bottom||0);
      const waveBottom=Math.max(0,...[...(document.querySelectorAll?.('.wave-front-status,.seismic-impact-status')||[])].map(el=>el.getBoundingClientRect().bottom));
      stack.style.setProperty('--notice-top',Math.max(6,headerBottom+6,waveBottom+6)+'px');
      const left=$('sidebar-left')?.getBoundingClientRect(),right=$('painel-direito')?.getBoundingClientRect();
      const start=left&&left.width>0?left.right+18:18;
      const end=right&&right.width>0?right.left-18:window.innerWidth-18;
      stack.style.setProperty('--notice-left',Math.max(18,start)+'px');
      stack.style.setProperty('--notice-width',Math.max(280,Math.min(540,end-start))+'px');
      return;
    }
    stack.style.removeProperty('--notice-top');
    const panel=$('painel-direito'),rect=panel?.getBoundingClientRect();
    const headerBottom=Math.max($('top-strip')?.getBoundingClientRect().bottom||0,$('latest-event-ticker')?.getBoundingClientRect().bottom||0);
    const expanded=document.body.classList.contains('mobile-details-open');
    const inline=(expanded||(rect&&rect.top-headerBottom<110))&&panel&&(expanded||document.body.classList.contains('mobile-details-mid'));
    stack.classList.toggle('notice-inline',!!inline);
    if(inline){const header=panel.querySelector('.pd-header-row');if(stack.parentNode!==panel&&header)header.after(stack);stack.style.removeProperty('--notice-bottom');}
    else{if(stack.parentNode!==document.body)document.body.appendChild(stack);const visible=rect&&rect.height>0&&rect.top<window.innerHeight;stack.style.setProperty('--notice-bottom',Math.max(12,visible?window.innerHeight-rect.top+10:78)+'px');}
  }
  function layout(){if(frame==null)frame=requestAnimationFrame(position);}
  function openHistory(){
    let dialog=$('mobile-notice-history');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='mobile-notice-history';dialog.setAttribute('aria-label','Avisos recebidos');document.body.appendChild(dialog);}
    dialog.replaceChildren();
    const header=document.createElement('div');header.className='notice-history-head';
    const title=document.createElement('strong');title.textContent='Avisos recebidos';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar avisos');close.onclick=()=>dialog.close();header.append(title,close);dialog.appendChild(header);
    const note=document.createElement('p');note.textContent='Últimos 50 avisos desta sessão · '+Math.max(0,active.size-(current?1:0))+' aguardando';dialog.appendChild(note);
    if(!history.length){const empty=document.createElement('p');empty.textContent='Nenhum aviso recebido ainda.';dialog.appendChild(empty);}
    for(const item of history.slice().reverse()){
      const row=document.createElement('div');row.className='notice-history-row';
      const label=document.createElement('strong');label.textContent=item.title;
      const detail=document.createElement('p');detail.textContent=item.detail||'';
      const time=document.createElement('small');time.textContent=new Date(item.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+(active.has(item.key)?current===item?' · Em exibição':' · Na fila':'');
      row.append(label,detail,time);dialog.appendChild(row);
    }
    if(!dialog.open)dialog.showModal();
  }
  function dismiss(key){active.delete(key);if(current?.key===key)current=null;render();}
  function render(){
    clearTimeout(timer);const now=Date.now();
    if(current){current.remaining-=Math.max(0,now-current.started);current.started=now;if(current.remaining<=0){active.delete(current.key);current=null;}}
    const list=[...active.values()].sort((a,b)=>(priority[b.type]||1)-(priority[a.type]||1)||a.seq-b.seq);
    const next=list[0];const before=current;
    if(next&&(!current||(priority[next.type]||1)>(priority[current.type]||1))){current=next;current.started=now;}
    const host=ensure();host.replaceChildren();host.hidden=!current;
    if(!current){layout();return;}
    const item=current;
    const card=document.createElement('div');card.className='mobile-notice notice-'+item.type+(before!==current?' notice-enter':'');
    const icon=document.createElement('span');icon.className='notice-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.type==='revision'||item.type==='newquake'?'〰':item.type==='warning'||item.type==='error'?'!':'i';
    const text=document.createElement('div');text.className='notice-copy';
    const title=document.createElement('strong');title.textContent=item.title;text.appendChild(title);
    if(item.detail){const detail=document.createElement('span');detail.textContent=item.detail;text.appendChild(detail);}
    const controls=document.createElement('div');controls.className='notice-actions';
    const more=document.createElement('button');more.type='button';more.className='notice-more';more.textContent=active.size>1?'+'+(active.size-1)+' avisos':'Histórico';more.onclick=openHistory;
    const close=document.createElement('button');close.type='button';close.className='notice-close';close.textContent='×';close.setAttribute('aria-label','Dispensar este aviso');close.onclick=()=>dismiss(item.key);
    controls.append(more,close);card.append(icon,text,controls);host.appendChild(card);
    timer=setTimeout(render,Math.max(1,item.remaining));layout();
  }
  function push(notice){
    const now=Date.now(),title=String(notice.title||'').trim();if(!title)return;
    const detail=String(notice.detail||''),key=String(notice.key||title+'|'+detail);
    // Fonte offline persistente não ocupa novamente a fila a cada atualização.
    const cooldown=/offline|indisponível|sem conexão/i.test(title+' '+detail)?300000:10000;
    if(active.has(key))return;
    if(recent.has(key)&&now-recent.get(key)<cooldown)return;
    recent.set(key,now);for(const[k,at]of recent)if(now-at>300000)recent.delete(k);
    const item={title,detail,key,type:priority[notice.type]?notice.type:'info',at:now,seq:++sequence,remaining:Math.max(3000,Math.min(15000,Number(notice.duration)||7000)),started:null};
    active.set(key,item);history.push(item);if(history.length>50)history.shift();
    if(active.size>30){const old=[...active.values()].find(x=>x!==current&&x!==item);if(old)active.delete(old.key);}
    render();
  }
  window.MobileNotices={enabled:()=>true,push,openHistory};
  function install(){
    const observer=window.ResizeObserver?new ResizeObserver(layout):null;
    for(const id of ['painel-direito','sidebar-left','top-strip','ux-controlbar','latest-event-ticker']){const panel=$(id);if(panel)observer?.observe(panel);}
    const mapHost=$('mapWrap');
    if(mapHost&&window.MutationObserver)new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('.wave-front-status,.seismic-impact-status'))observer?.observe(node);layout();}).observe(mapHost,{childList:true});
    if(window.MutationObserver)new MutationObserver(layout).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);media.addEventListener('change',render);
    const old=$('toast-stack');if(old)for(const toast of [...old.children]){push({title:toast.textContent,type:toast.classList.contains('toast-warning')?'warning':'info'});toast.remove();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
