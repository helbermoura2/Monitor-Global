# Otimizações após o diagnóstico DeX de 21/10/2026

O relatório do usuário cobriu 5 h 9 min, com heap aproximado de 14,5 a 347,14 MiB, 46,4 FPS nas janelas amostradas, até 612 marcadores, 56 canvases e 582 objetos de animação. Esses números não comprovam vazamento nem distinguem animações em execução das que já terminaram e mantêm seu estado final.

## Mudanças

- Diagnóstico local v3: até 32 locais de erro agregados por tipo, arquivo local carregado, linha e coluna. Não guarda mensagens, URLs, parâmetros nem pilhas completas. Falhas anteriores não podem ser reconstruídas. O relatório registra quando a nova cobertura começou.
- Contagens de canvas e animações por proprietário fixo (mapa, marcadores, cartão, sequência visual sísmica, efeito de tela, registros e outros), com máximos amostrados por minuto. Distingue animações em execução/pendentes do total de objetos de animação. Os máximos continuam amostrados, não contínuos.
- Agrupamento também em cenas densas no desktop/DeX (mais de 160 candidatos). Pontos fora da tela são descartados da representação DOM; o selecionado permanece individual. Células aumentam conforme a densidade. Os registros, a seleção, os filtros e as fontes não são removidos.
- Ícones estáticos de municípios INMET usam imagens PNG reutilizadas, com cache de no máximo 15 combinações conhecidas, em vez de um canvas de 64×64 por linha. Pesquisa e paginação permanecem iguais.
- Decoração de marcadores secundários e registros ocultos não anima. Animações de reorganização dos registros só consideram cartões visíveis (até oito); classes de entrada são retiradas quando a animação termina, evitando retenção do estado final.
- Cache de tiles: limite de 192 tiles em cache por fonte, com três níveis de zoom. Isso não limita todos os tiles ativos nem todo o uso de GPU. A camada de nomes Esri fica suspensa nos percursos coordenados por EventCamera, voltando na chegada, cancelamento ou ocultação da página. O satélite permanece visível; navegação manual e preferência de camada oculta são preservadas. Não se muda a validade HTTP das fontes.

## Medições locais controladas

| Cenário | Antes | Depois |
| --- | ---: | ---: |
| 612 pontos próximos em viewport DeX, zoom 6 | 612 marcadores individuais | 17 marcadores/grupos, catálogo com 612 registros |
| 50 municípios exibidos no cartão | 50 canvases para ícones | zero canvases; imagens compartilham a mesma representação |
| Camada de nomes, três posições/zooms simulados | 25 pedidos de tiles | 6 na chegada; zero durante o percurso |

Os tiles do teste são servidos localmente. Os resultados não estimam bytes reais, operações de Durable/KV, FPS, heap ou bateria do S25 Ultra. O efeito em uma sessão longa exige nova medição no aparelho após atualizar a página. Não houve testes funcionais contra Worker, Durable ou Telegram em produção.
