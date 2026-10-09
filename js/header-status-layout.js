/* Reuse the same status button and clock; retain mobile header ownership. */
(function(){
  const desktop=matchMedia('(min-width:901px)');
  let badgeHome,weatherHome;
  function apply(){
    const badge=document.getElementById('ao-vivo-badge'),weather=document.getElementById('sp-live-card'),row=document.querySelector('#top-strip > .ts-mainrow'),fresh=document.getElementById('freshness-bar');
    if(!badge||!weather||!row||!fresh)return;
    if(!badgeHome){badgeHome=document.createComment('status home');badge.before(badgeHome);weatherHome=document.createComment('weather home');weather.before(weatherHome);}
    if(desktop.matches){fresh.prepend(badge);row.append(weather);}
    else {badgeHome.after(badge);weatherHome.after(weather);}
    document.body.classList.toggle('mg-wide-status',desktop.matches);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  desktop.addEventListener('change',apply);
})();
