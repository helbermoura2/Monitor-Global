# Câmera sísmica M5+

Eventos novos e cliques manuais com magnitude a partir de 5 seguem esta sequência:

1. Acompanha a frente S (vermelha) até alcançar o limite da área de intensidade estimada.
2. Acompanha a frente P (azul) durante 6 segundos.
3. Retorna a um enquadramento de toda a área pintada. Conta 8 segundos depois que o enquadramento converge.
4. Volta à frente P por 6 segundos e repete as etapas 3 e 4 até o fim da exibição física.
5. Retorna à área pintada em 3,5 segundos, permanece mais 10 segundos e libera a rotação.

A propagação não pausa durante a visita à área. A pintura usa o modelo de atenuação GlobalQuake Gen2, não relatos de tremor: abre com S e fica completa quando a frente chega ao limite estimado. Permanece até a seleção seguinte. O enquadramento considera o cabeçalho e os painéis, em desktop e celular.

Se a exibição física terminar durante uma etapa intermediária, a câmera segue diretamente para o quadro final da área afetada. Um evento recebido depois da passagem das ondas mantém a pintura estimada sem fabricar ondas novas. A rotação histórica continua usando apenas o radar estimado. Interações manuais cancelam a câmera automática; sismos novos maiores continuam podendo interromper a apresentação.

Com movimento reduzido, os passeios são omitidos e o retorno final é imediato, mantendo os 10 segundos de permanência. Outros sismos preservam os tempos anteriores.

Verificação: `tests/seismic-camera-tour.spec.js` acompanha a sequência completa e os prazos no desktop/celular; `tests/seismic-impact.spec.js` cobre pintura, chegada tardia e interrupção; `tests/wave-final-hold.spec.js` mantém a parada das ondas de eventos menores.

A câmera calcula seu alvo e amortecimento a cada frame, independentemente da geometria das ondas. Os anéis são atualizados pelo relógio físico a cada 300 ms (1500 ms com movimento reduzido); mover ou ampliar o mapa apenas reprojeta as coordenadas existentes. Raios e opacidades inalterados não são reenviados. Uma revisão de coordenadas ou profundidade continua atualizando a geometria, e o alcance estimado usado pela câmera só é recalculado se magnitude ou profundidade mudarem.

`tests/seismic-wave-performance.spec.js` conta as atualizações das fontes no mapa real em desktop/celular e verifica que pan/zoom e o quadro final não duplicam esse trabalho, sem interromper a câmera nem ignorar revisões.
