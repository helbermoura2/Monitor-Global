(() => {
  const nativeFetch = window.fetch.bind(window);
  const tracedFetch=async request=>{try{const r=await nativeFetch(request);try{window.PerformanceDiagnostics?.network?.(request,r);}catch{}return r;}catch(error){try{window.PerformanceDiagnostics?.network?.(request,null,error?.name==='AbortError'?'abort':'network');}catch{}throw error;}};
  window.fetchWithTimeout = async (input, init = {}, timeout = 12000) => {
    const request = new Request(input, init);
    let response;
    if(window.BrowserRequestBudget?.eligible(request))response=await BrowserRequestBudget.fetch(request,tracedFetch,timeout);
    else {
      const controller=new AbortController(),abort=()=>controller.abort(request.signal.reason);
      const signal=typeof AbortSignal.any==='function'?AbortSignal.any([request.signal,controller.signal]):controller.signal;
      if(typeof AbortSignal.any!=='function'){request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();}
      const timer=setTimeout(()=>controller.abort(),timeout);
      try{response=await tracedFetch(new Request(request,{signal}));}finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);}
    }
    // Keep shared provider cooldown visible so fallbacks do not bypass it.
    if(!response.ok&&response.headers.get('X-Monitor-Source-State')!=='unavailable'){const error=new Error(`HTTP ${response.status}`);error.status=response.status;if(response.status===429&&response.headers.get('Retry-After'))error.sharedCooldown=true;throw error;}
    return response;
  };
  window.fetch = (input, init) => window.fetchWithTimeout(input, init);
  const status = (message, type = 'info', retryable = false) => {
    const box = document.getElementById('app-status');
    const text = document.getElementById('app-status-text');
    const retry = document.getElementById('app-status-retry');
    if (!box || !text) return;
    text.textContent = message;
    box.className = `visible ${type}`;
    if (retry) retry.hidden = !retryable;
    if (type === 'info') setTimeout(() => box.classList.remove('visible'), 5000);
  };
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button[title]:not([aria-label])').forEach(button => button.setAttribute('aria-label', button.title));
    document.querySelectorAll('button.chip, button.map-tool').forEach(button => {
      if (!button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      button.addEventListener('click', () => button.setAttribute('aria-pressed', button.classList.contains('active') || button.classList.contains('chip-toggle') ? 'true' : 'false'));
    });
    document.getElementById('app-status-retry')?.addEventListener('click', () => window.AppRecovery?.retryFeeds());
    document.getElementById('empty-map-retry')?.addEventListener('click', () => window.AppRecovery?.retryFeeds());
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.body.classList.remove('mobile-events-open', 'mobile-fc-open');
      document.getElementById('ts-vol-panel')?.classList.remove('open');
      document.getElementById('ts-more-menu')?.classList.remove('open');
    });
    status('Conectando às fontes de dados…');
  });
})();

