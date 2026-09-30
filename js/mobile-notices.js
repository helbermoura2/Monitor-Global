/* Um aviso por vez no mobile. Histórico local à sessão, sem dados externos. */
(() => {
  const media = window.matchMedia('(max-width:900px)');
  const active = new Map(), history = [];
  let stack, timer, frame, sequence = 0;
  const $ = id => document.getElementById(id);
  function ensure() {
    if (stack) return stack;
    stack = document.createElement('div'); stack.id = 'mobile-notice-stack';
    stack.setAttribute('aria-live','polite'); stack.setAttribute('aria-atomic','true');
    stack.addEventListener('click',event => event.stopPropagation());
    document.body.appendChild(stack);
    return stack;
  }
  function position() {
    frame = null;
    if (!stack || !media.matches) return;
    const panel = $('painel-direito');
    const rect = panel?.getBoundingClientRect();
    const headerBottom = Math.max($('top-strip')?.getBoundingClientRect().bottom || 0,$('latest-event-ticker')?.getBoundingClientRect().bottom || 0);
    const expanded = document.body.classList.contains('mobile-details-open');
    const tight = expanded || (rect && rect.top - headerBottom < 110);
    const inline = tight && panel && (expanded || document.body.classList.contains('mobile-details-mid'));
    stack.classList.toggle('notice-inline',!!inline);
    if (inline) {
      const header = panel.querySelector('.pd-header-row');
      if (stack.parentNode !== panel && header) header.after(stack);
      stack.style.removeProperty('--notice-bottom');
    } else {
      if (stack.parentNode !== document.body) document.body.appendChild(stack);
      const visible = rect && rect.height > 0 && rect.top < window.innerHeight;
      stack.style.setProperty('--notice-bottom', Math.max(12,visible ? window.innerHeight - rect.top + 10 : 78) + 'px');
    }
  }
  function layout() {if(frame==null)frame=requestAnimationFrame(position);}
  function dismiss(key) {active.delete(key);render();}
  function openHistory() {
    let dialog = $('mobile-notice-history');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'mobile-notice-history';
      dialog.setAttribute('aria-label','Avisos recebidos');document.body.appendChild(dialog);
    }
    dialog.replaceChildren();
    const header = document.createElement('div');header.className='notice-history-head';
    const title=document.createElement('strong');title.textContent='Avisos recebidos';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar avisos');close.onclick=()=>dialog.close();header.append(title,close);dialog.appendChild(header);
    const note=document.createElement('p');note.textContent='Últimos 50 avisos desta sessão';dialog.appendChild(note);
    if (!history.length) {const empty=document.createElement('p');empty.textContent='Nenhum aviso recebido ainda.';dialog.appendChild(empty);}
    for (const item of history.slice().reverse()) {
      const row=document.createElement('div');row.className='notice-history-row';
      const label=document.createElement('strong');label.textContent=item.title;
      const detail=document.createElement('p');detail.textContent=item.detail || '';
      const time=document.createElement('small');time.textContent=new Date(item.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      row.append(label,detail,time);dialog.appendChild(row);
    }
    if (!dialog.open) dialog.showModal();
  }
  function render() {
    clearTimeout(timer);
    const now=Date.now();for(const [key,item] of active)if(item.until<=now)active.delete(key);
    const host=ensure();host.replaceChildren();host.hidden=!media.matches || !active.size;
    if(host.hidden){layout();return;}
    const priority={error:3,warning:2,revision:1,info:0};
    const list=[...active.values()].sort((a,b)=>(priority[b.type]||0)-(priority[a.type]||0)||b.seq-a.seq);
    const item=list[0];
    const card=document.createElement('div');card.className='mobile-notice notice-'+item.type;
    const text=document.createElement('div');text.className='notice-copy';
    const title=document.createElement('strong');title.textContent=item.title;text.appendChild(title);
    if(item.detail){const detail=document.createElement('span');detail.textContent=item.detail;text.appendChild(detail);}
    const controls=document.createElement('div');controls.className='notice-actions';
    const more=document.createElement('button');more.type='button';more.textContent=list.length>1?'+'+(list.length-1)+' avisos':'Ver avisos';more.onclick=openHistory;
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dispensar este aviso');close.onclick=()=>dismiss(item.key);
    controls.append(more,close);card.append(text,controls);host.appendChild(card);
    timer=setTimeout(render,Math.max(1,Math.min(...list.map(x=>x.until))-now));layout();
  }
  function push(notice) {
    const now=Date.now();const title=String(notice.title||'').trim();if(!title)return;
    const detail=String(notice.detail||'');const key=notice.key||title+'|'+detail;
    const item={...notice,title,detail,key,at:now,seq:++sequence,until:now+(notice.duration||8000)};
    active.set(key,item);history.push(item);if(history.length>50)history.shift();
    if(active.size>30)active.delete(active.keys().next().value);render();
  }
  function sync() {render();}
  window.MobileNotices={enabled:()=>media.matches,push,openHistory};
  function install() {
    const panel=$('painel-direito');
    if(panel)new ResizeObserver(layout).observe(panel);
    new MutationObserver(layout).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);
    media.addEventListener('change',sync);
    if(media.matches){const old=$('toast-stack');if(old)for(const toast of [...old.children]){push({title:toast.textContent,type:toast.classList.contains('toast-warning')?'warning':'info'});toast.remove();}}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
