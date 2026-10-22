/* Random decorative word falls. Originals and their text nodes are restored. */
(function(root){'use strict';
function create(p){
 const card=document.getElementById('painel-direito');if(!card||p.mag<2||matchMedia('(prefers-reduced-motion:reduce)').matches)return null;
 const nodes=[],walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){const parent=node.parentElement;if(!parent||parent.closest('button,a,svg,canvas,[aria-hidden="true"],#pd-mag,#pd-flag,.pd-flip-back,.pd-flip-verso,#pd-details-verso,.pd-cinema-layer,.pd-cinema-contact')||!/[\p{L}]{3}/u.test(node.textContent))continue;const r=parent.getBoundingClientRect(),cs=getComputedStyle(parent);if(r.width&&r.height&&cs.visibility!=='hidden'&&Number(cs.opacity)>0&&r.bottom>0&&r.top<innerHeight)nodes.push(node);}
 const candidates=[];for(const n of nodes){const chunks=n.textContent.split(/(\s+)/u);for(let i=0;i<chunks.length;i++)if(/[\p{L}]{3}/u.test(chunks[i]))candidates.push({node:n,chunks,index:i});}
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const limit=Math.max(1,Math.min(9,Math.round(p.mag-1)+(p.full?2:0))),count=Math.min(candidates.length,1+Math.floor(Math.random()*limit)),chosen=candidates.slice(0,count),records=[],animations=[];
 const layer=document.createElement('div');layer.className='seismic-word-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);
 for(const n of new Set(chosen.map(c=>c.node))){const shell=document.createElement('span');shell.className='seismic-word-source';const picks=new Set(chosen.filter(c=>c.node===n).map(c=>c.index));n.textContent.split(/(\s+)/u).forEach((part,i)=>{if(!picks.has(i)){shell.append(document.createTextNode(part));return;}const span=document.createElement('span');span.textContent=part;span.className='seismic-falling-word';shell.append(span);});n.replaceWith(shell);records.push({node:n,shell});}
 let index=0;for(const {shell}of records)for(const word of shell.querySelectorAll('.seismic-falling-word')){const r=word.getBoundingClientRect(),cs=getComputedStyle(word),copy=document.createElement('span');copy.textContent=word.textContent;Object.assign(copy.style,{position:'absolute',left:r.left+'px',top:r.top+'px',font:cs.font,color:cs.color,letterSpacing:cs.letterSpacing,textShadow:cs.textShadow,whiteSpace:'pre'});layer.append(copy);const delay=250+index++*180+Math.random()*250,fall=Math.min(180,innerHeight-r.bottom+25),spin=(Math.random()-.5)*90;
 if(word.animate){animations.push(word.animate([{opacity:1},{opacity:0},{opacity:0},{opacity:1}],{duration:1800,delay,fill:'none'}));animations.push(copy.animate([{transform:'translate(0,0)',opacity:0,offset:0},{transform:'translate(0,0)',opacity:1,offset:.05},{transform:`translate(${(Math.random()-.5)*70}px,${fall}px) rotate(${spin}deg)`,opacity:0,offset:1}],{duration:1600,delay,fill:'both',easing:'cubic-bezier(.35,0,.8,.7)'}));}}
 return {count,words:chosen.map(c=>c.chunks[c.index]),destroy(){animations.forEach(a=>a.cancel());layer.remove();for(const {node,shell}of records)if(shell.isConnected)shell.replaceWith(node);}};
}
root.SeismicWordFall={create};
})(window);
