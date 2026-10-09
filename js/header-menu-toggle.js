// === parte-1 (linhas originais 13709-13719) ===
(() => {
  const moreToggle = document.getElementById('ux-more-toggle');
  const advancedMenu = document.getElementById('ux-advanced-menu');
  const filtersToggle = document.getElementById('more-filters-toggle');
  const chipsRow = document.getElementById('chips-row');
  moreToggle?.addEventListener('click', (event) => { event.stopPropagation(); const open = advancedMenu?.classList.toggle('open'); moreToggle.setAttribute('aria-expanded', String(!!open)); });
  function updateFiltersToggle(){
    if(!filtersToggle||!chipsRow)return;
    const open=chipsRow.classList.contains('expanded');
    const count=chipsRow.querySelectorAll('.advanced-filter.active,.advanced-filter.on').length;
    if(filtersToggle.getAttribute('aria-expanded')!==String(open))filtersToggle.setAttribute('aria-expanded',String(open));
    const text=(open?'− Menos filtros':'＋ Mais filtros')+(!open&&count?' ('+count+')':'');
    if(filtersToggle.textContent!==text)filtersToggle.textContent=text;
  }
  filtersToggle?.addEventListener('click',()=>{chipsRow?.classList.toggle('expanded');updateFiltersToggle();});
  if(chipsRow){new MutationObserver(updateFiltersToggle).observe(chipsRow,{attributes:true,attributeFilter:['class'],subtree:true});updateFiltersToggle();}

  document.addEventListener('click', (event) => { if (advancedMenu && !advancedMenu.contains(event.target) && event.target !== moreToggle) { advancedMenu.classList.remove('open'); moreToggle?.setAttribute('aria-expanded','false'); } });
})();

// === parte-2 (linhas originais 13720-13738) ===
(() => {
  const groups = document.querySelectorAll('.header-menu-group');
  groups.forEach(group => { const trigger=group.querySelector('.header-menu-trigger'); const menu=group.querySelector('.header-submenu'); trigger?.addEventListener('click',(event)=>{event.stopPropagation();groups.forEach(other=>{if(other!==group){other.querySelector('.header-submenu')?.classList.remove('open');other.querySelector('.header-menu-trigger')?.setAttribute('aria-expanded','false')}});const open=menu?.classList.toggle('open');trigger?.setAttribute('aria-expanded',String(!!open));}); });
  document.addEventListener('click',(event)=>{
    const t = event.target;
    if (t.closest('.header-menu-group')) return;
    if (t.closest('#header-main-menu-panel')) return;
    if (t.closest('#menu-float-panel')) return;
    if (t.closest('#btn-som-header')) return;
    groups.forEach(group=>{
      group.querySelector('.header-submenu')?.classList.remove('open');
      group.querySelector('.header-menu-trigger')?.setAttribute('aria-expanded','false');
    });
  });
  document.getElementById('events-sources-shortcut')?.addEventListener('click',()=>document.getElementById('ux-btn-sources')?.click());
  document.getElementById('ux-more-toggle')?.addEventListener('click',()=>document.getElementById('ux-advanced-menu')?.classList.toggle('open'));
})();

