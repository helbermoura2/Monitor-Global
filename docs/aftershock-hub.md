# Sequência sísmica — hub C + D

Usa a associação já existente em AftershockModel, sem alterar catálogos, critérios de parentesco, prioridades, Telegram ou cadência de consultas. “Possíveis réplicas” continua sendo uma associação estimada por horário, distância, magnitude e profundidade na janela de 72 horas, não uma classificação oficial ou previsão.

No desktop, a linha do tempo ocupa a lateral esquerda. Registros novos aparecem acima dela, com sua duração original, em uma área limitada a 36% da altura para manter espaço para a sequência. O hub acompanha o fim da animação dos registros. Um chip de evento que fixa o histórico devolve a lateral aos registros; “Sequência” abre a consulta detalhada já existente nesse caso. X fecha o hub até reabertura pelo botão Sequência ou mudança de grupo.

No celular em retrato, aparece como painel inferior retrátil, com até 46% da altura. A seta recolhe/expande; “Detalhes” abre o cartão principal; o botão Sequência volta ao painel. Em paisagem, usa uma lateral compacta para preservar o mapa. A linha selecionada muda os dados do cartão e enquadra o principal e a possível réplica juntos, dentro da área livre da interface. Novas associações recebidas não movem a câmera automaticamente.

As conexões são estáticas, sem setas, pulsação ou interpretação de propagação. Destacam em ciano a selecionada e deixam as demais discretas. Há no máximo 40 conexões, correspondentes aos pontos ou grupos já representados no mapa. Ao aproximar, o agrupamento existente separa os pontos; os epicentros mantêm suas coordenadas. O cruzamento do antimeridiano é dividido em dois segmentos para não desenhar uma ligação através do planeta.

A lista inicia com o principal e as 40 possíveis réplicas mais recentes em ordem cronológica. “Mostrar anteriores” aumenta o trecho até 200; uma selecionada mais antiga é incluída mesmo fora do trecho. A interface informa a omissão e todos os eventos continuam nos registros. Mostra magnitude, data/hora BRT, profundidade e intervalo após o principal.

Tsunami em apresentação costeira e camada sísmica desligada ocultam hub/conexões. Seleção de um evento sem associação remove a sequência e a fonte gráfica. As conexões são restauradas após recarga do estilo do mapa. A seleção entre possíveis réplicas preserva o estado de expansão e o grupo.

Não adiciona fetch, polling, envio de alertas nem uso de Durable Objects/KV. Duas camadas de linha usam a geometria local já carregada; a lista e os marcadores têm limites. O posicionamento reage a mudanças de layout/tamanho e fim das animações dos registros.

Validação offline: `tests/aftershock-hub.spec.js` (desktop, retrato e paisagem, navegação, posição dos pontos, cartões novos, filtros, recolhimento, detalhes e limpeza); `tests/aftershock-sequence.spec.js` (agrupamento, grandes sequências, atualizações silenciosas e prioridade de tsunami); `tests/unit/aftershock-hub-model.test.cjs` (geometria, antimeridiano, limites, cronologia e enquadramento). Nenhum teste envia mensagens nem consulta serviços de produção.
