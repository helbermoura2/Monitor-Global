# Chegada e identificação do evento selecionado

A viagem entre eventos mantém as três etapas de seis segundos: afastamento,
deslocamento com a visão aberta e aproximação. O deslocamento chega à latitude
completa do destino, sem limitá-la a ±25°. A aproximação usa `flyTo`, que concentra
o alinhamento geográfico na parte distante da trajetória, inclusive quando a
projeção Mercator limita a latitude do centro no zoom de visão mundial.
Antes de aproximar, conclui na visão aberta o pequeno resíduo do último frame
do deslocamento, pois o temporizador pode disparar antes desse frame.
O enquadramento continua considerando os painéis. A chegada mantém os efeitos
do cartão no prazo original, e o arraste manual cancela o passeio.

`EventFocusBeacon` acrescenta um localizador pequeno ao elemento do pin
selecionado. Não altera o `transform` usado pelo MapLibre para posicionar o pin.
Consulta a camada de intensidade renderizada junto ao ponto: havendo pintura,
retira o localizador; sem pintura, inclusive nos sismos fracos, mantém o pulso.
Nos outros tipos usa o pin existente, sem inventar um epicentro para boletins
regionais sem coordenadas. O pulso não recebe cliques e fica estático com a
preferência de movimento reduzido. Não representa propagação nem alcance.

Verificação: alinhamento das etapas em projeção plana/globo, aproximação no
renderizador real e localização em desktop/celular, ocultação por pintura,
troca de seleção, filtros, movimento reduzido, arraste e efeitos após chegada.
