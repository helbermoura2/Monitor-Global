/* Data provenance is per value, never a severity or a promise of accuracy. */
(function(){
 'use strict';
 const explanations={
  source:['Dado da fonte','Valor publicado pela fonte identificada no evento, sujeito a revisão. A origem institucional não garante precisão absoluta nem confirma danos.'],
  intensity:['Intensidade publicada pela fonte','MMI publicado pela agência. Produtos como o ShakeMap combinam registros e modelos: continuam sendo estimativas de intensidade, não confirmação de percepção ou danos em cada local.'],
  estimate:['Intensidade estimada pelo app','Modelo calculado a partir de magnitude, profundidade e distância. Não é medição em cada cidade e não confirma onde o tremor foi sentido ou causou danos.'],
  energy:['Energia calculada','Equivalente em TNT calculado a partir da magnitude. Não é medição direta de energia nem estimativa de danos.'],
  population:['População potencialmente exposta','Estimativa de população nas faixas de tremor. Não é contagem de vítimas, feridos ou pessoas que confirmaram sentir. Consulte Fonte e método para origem, cobertura e limitações. Mesmo a exposição publicada pelo USGS PAGER é estimada.'],
  perception:['Relatos de percepção','Respostas de pessoas recebidas pela rede, como USGS/DYFI. Não são medições instrumentais nem o total de pessoas que sentiram. A publicação por uma agência não transforma relatos em confirmação de danos.'],
  tsunami:['Boletim de tsunami','O status, as regiões e os horários seguem o boletim oficial. Um boletim informativo pode declarar ausência de ameaça. O ponto de origem do sismo não é uma área de inundação; magnitude, sozinha, não confirma tsunami.'],
  forecast:['Estimativa de modelo','Condição calculada por modelo meteorológico para a área e o horário indicados. Não é uma leitura de termômetro naquele ponto nem confirmação de ocorrência em toda a cidade.'],
  warning:['Aviso oficial','Aviso válido para a área e o período indicados pela fonte. Não confirma que o fenômeno ocorreu em todos os locais abrangidos.'],
  report:['Registro da fonte','Informação reportada pela fonte do evento. Consulte o boletim e seu horário para saber a área, a atividade e os limites do registro.'],
  observed:['Observação local','Medição ou observação referente à estação, local e horário informados. Não representa automaticamente toda a cidade ou região.'],
  river:['Nível de rio observado','Leitura da régua na estação indicada. Subida do nível não confirma transbordamento sem comparação com a cota local de inundação.'],
  bulletin:['Boletim oficial','Texto publicado pela fonte no horário indicado. Relatos e previsões devem ser lidos no contexto do boletim; não confirmam ocorrência em cada ponto da região.']
 };
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function markup(type,label){if(!explanations[type])return '';return '<button type="button" class="mg-data-context estimativa-badge" data-data-context="'+type+'" aria-haspopup="dialog" aria-label="Explicar: '+escape(explanations[type][0])+'">'+escape(label)+' ⓘ</button>';}
 let dialog,opener;
 function open(type,button){
  const info=explanations[type];if(!info)return;opener=button;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='mg-data-context-dialog';dialog.className='mg-local-dialog';dialog.setAttribute('aria-labelledby','mg-data-context-title');
   dialog.innerHTML='<h2 id="mg-data-context-title"></h2><p></p><button type="button" data-context-method>Fonte e método</button><button type="button" data-context-close>Fechar</button>';
   dialog.querySelector('[data-context-close]').onclick=()=>dialog.close();
   dialog.querySelector('[data-context-method]').onclick=()=>{dialog.close();const item=window.EventStore?.getSelected();if(item&&typeof abrirEvidenciasFontes==='function')abrirEvidenciasFontes(item);};
   dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});document.body.append(dialog);
  }
  dialog.querySelector('h2').textContent=info[0];dialog.querySelector('p').textContent=info[1];
  dialog.querySelector('[data-context-method]').hidden=!window.EventStore?.getSelected();if(!dialog.open)dialog.showModal();
 }
 function annotate(item){
  const p=document.getElementById('painel-direito');if(!p)return;
  p.querySelector('#pd-data-nature')?.remove();
  if(item?.type==='earthquake'||(!item?.type&&item?.mag!=null))return;
  const nature=item?.type==='tsunami'?'tsunami':window.HazardEvidence?.classify(item)?.nature||'report';
  const label={tsunami:'BOLETIM OFICIAL',forecast:'ESTIMATIVA',warning:'AVISO OFICIAL',observed:'OBSERVAÇÃO LOCAL',river:'OBSERVAÇÃO LOCAL',bulletin:'BOLETIM OFICIAL',report:'DA FONTE'}[nature]||'DA FONTE';
  const host=document.createElement('div');host.id='pd-data-nature';host.innerHTML=markup(nature,label);
  ((item?.type==='capital-weather'?p.querySelector('#pd-capital-weather'):null)||p.querySelector('.pd-model-one-footer')||p).append(host);
 }
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-data-context]');if(!b)return;e.stopPropagation();open(b.dataset.dataContext,b);});
 window.DataContext={markup,open,annotate};
})();
