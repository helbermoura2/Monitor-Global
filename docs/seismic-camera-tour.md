# Câmera sísmica M5+

Eventos novos e cliques manuais acompanham a frente S (vermelha), mantendo o epicentro. Ao atingir o alcance estimado, a câmera permanece na área pintada e nas localidades desse entorno. Somente os últimos seis segundos da exibição física mostram a frente P (azul). Em M5+, o encerramento retorna à área pintada em 3,5 segundos e permanece mais 10 segundos antes de liberar a rotação. A sequência dos eventos menores está descrita abaixo.

Um boletim oficial associado com localização **e horário de origem** compatíveis inicia uma apresentação conjunta: 15 segundos no sismo / 10 segundos no tsunami. A seleção continua sendo a mesma; não há um evento aleatório entre as duas fases. O primeiro passeio mostra o conjunto das regiões e os seguintes visitam as regiões citadas, com voos de seis segundos e ordem por proximidade. Somente contornos de referência dos países/regiões citados ou polígonos oficiais são usados. Durante a visita, os anéis e a pintura sísmica ficam ocultos, e a câmera física das ondas cede o controle; o relógio físico segue funcionando. Ao voltar, a intensidade estimada reaparece. O azul final encerra essa alternância e retorna à área sísmica.

O cartão acompanha a fase e mantém a ligação entre sismo e boletim. Informativo recebe azul e texto sem indicação de ameaça; encerramento cancela o passeio. Associação apenas provável, origem ausente ou ambígua não inicia alternância automática; o boletim selecionado ainda percorre suas próprias regiões, sem inventar um sismo associado. Revisões não reiniciam o relógio da sequência; outro evento limpa o estado, as camadas e os temporizadores. Interação manual pausa o passeio. Abas ocultas suspendem as transições, movimento reduzido omite os voos e a prioridade/permanência dos eventos permanece sob o controlador existente.

A propagação não pausa durante a visita à área. A pintura usa o modelo de atenuação GlobalQuake Gen2, não relatos de tremor: abre com S e fica completa quando a frente chega ao limite estimado. Permanece até a seleção seguinte. O enquadramento considera o cabeçalho e os painéis, em desktop e celular.

Se a exibição física terminar durante uma etapa intermediária, a câmera segue diretamente para o quadro final da área afetada. Um evento recebido depois da passagem das ondas mantém a pintura estimada sem fabricar ondas novas. Na rotação histórica, M5,5+ conserva a pintura estimada e os demais usam o radar, dentro do prazo existente. Interações manuais cancelam a câmera automática; sismos novos maiores continuam podendo interromper a apresentação.

Com movimento reduzido, os passeios são omitidos e o retorno final é imediato, mantendo os 10 segundos de permanência. Nos menores, o retorno também mantém 10 segundos de permanência.

Verificação: `tests/seismic-camera-tour.spec.js` acompanha a sequência completa e os prazos no desktop/celular; `tests/seismic-impact.spec.js` cobre pintura, chegada tardia e interrupção; `tests/wave-final-hold.spec.js` cobre a parada das ondas sem condução de câmera.

A câmera calcula seu alvo e amortecimento a cada frame, independentemente da geometria das ondas. Os anéis são atualizados pelo relógio físico a cada 300 ms (1500 ms com movimento reduzido); mover ou ampliar o mapa apenas reprojeta as coordenadas existentes. Raios e opacidades inalterados não são reenviados. Uma revisão de coordenadas ou profundidade continua atualizando a geometria, e o alcance estimado usado pela câmera só é recalculado se magnitude ou profundidade mudarem.

`tests/seismic-wave-performance.spec.js` conta as atualizações das fontes no mapa real em desktop/celular e verifica que pan/zoom e o quadro final não duplicam esse trabalho, sem interromper a câmera nem ignorar revisões.

## Sismos abaixo de M5

A câmera mantém o enquadramento inicial do epicentro até faltarem 10 segundos para o fim físico/exibido das ondas. Nesse trecho final acompanha a onda P azul. Ao terminar, retorna ao epicentro em 3,5 segundos e permanece mais 10 segundos antes da troca. O enquadramento pintado e os 6 segundos finais do azul nos M5+ permanecem iguais. Interação manual cancela a condução automática; a origem real continua sendo usada em eventos novos, sem reiniciar ondas de relatos atrasados.
