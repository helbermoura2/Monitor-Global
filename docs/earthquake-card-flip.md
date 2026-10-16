# Verso automático do cartão sísmico

O tour da área pintada também agenda a virada do cartão, em eventos novos,
seleção manual e aleatório. A espera começa na seleção, somando a duração
real do voo (6 ou 18 s) a 18 s no local (26 s para M8+, preservando o efeito especial). O verso mostra população estimada,
fonte, faixas de intensidade e localidades por 12 s, depois retorna à frente.
Nas visitas prioritárias de mapa oficial, a espera no local é de 7 s para
caber na apresentação mais curta. A câmera e os alertas sonoros mantêm sua
sequência atual.

A população não ocupa mais um resumo na frente. Continua disponível em
Detalhes e no verso; consulta pendente ou indisponível não significa zero.
As respostas assíncronas atualizam o verso quando ele já está aberto.
Trocar de evento, encerrar o tour ou abrir os detalhes manualmente cancela
uma virada pendente. A proteção de geração também cobre respostas tardias
para o mesmo evento e os quadros de animação.

Verificação: `tests/earthquake-card-flip.spec.js` (desktop e celular;
manualmente, aleatório, evento novo; retorno e cancelamento),
`tests/weak-official-shaking.spec.js` e verificação unitária de exposição.
