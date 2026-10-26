# Site — fontes, memória e legendas, 26/10/2026

## Estado das consultas

A tela “Situação das fontes” e o indicador do cabeçalho já existiam. Esta atualização acrescenta contagem de fontes sísmicas recentes no próprio indicador e cobertura por categoria no diagnóstico: sismos, tsunami, meteorologia, vulcões e demais produtos efetivamente consultados. Fontes aguardando consulta não viram sucesso implícito. Se nenhuma fonte sísmica respondeu recentemente após uma rodada em falha, o cabeçalho informa “SEM ATUALIZAÇÃO”. Uma consulta válida sem eventos continua válida; uma fonte indisponível não prova ausência de eventos.

Os detalhes conservam expansão, foco e rolagem durante as atualizações. Radar desativado e integrações pausadas continuam separados de falhas. Não há novos pings, polling de rede, telemetria ou consultas Durable/KV.

## Histórico de réplicas

As correções anteriores dos relatórios sísmicos continuam válidas. Foi encontrado outro histórico: `AftershockSequence.known` conservava todos os IDs observados por 72 h, mesmo depois de saírem do catálogo. A janela temporal não era um orçamento de entradas. O histórico de novidades agora mantém no máximo 5.000 IDs; a referência do catálogo atual é separada, evitando destacar novamente eventos de uma lista alterada no próprio objeto. A saída libera histórico, referências da sequência, marcadores e trabalhos agendados; o retorno restaura a referência silenciosamente.

Isso não limita nem apaga o catálogo sísmico, não redefine associações científicas e não altera a câmera. A organização dos rótulos agrupa leituras de posições antes de aplicar compactação; em vez de girar callbacks de animação durante a espera, conserva somente um agendamento e pausa com a aba oculta. O marcador selecionado continua prioritário.

### Medição reproduzível

`node --expose-gc tools/aftershock-memory-audit.cjs` executa o controlador completo com 240 trocas de 200 IDs diferentes, mantendo origens recentes. A referência anterior foi exportada de `aee1254:js/aftershock-sequence.js` e medida em outro processo.

| Após 240 trocas | Anterior | Corrigido |
| --- | ---: | ---: |
| IDs históricos retidos | 48.000 | 5.000 |
| Após saída da página | 48.000 | 0 |

O JSON com amostras e hashes está em [antes](audits/aftershock-memory-before-20261026.json) e [depois](audits/aftershock-memory-after-20261026.json). É heap principal do Node após GC, não RAM/GPU de um celular. O cenário isola a retenção por troca de IDs; não representa uma taxa medida de eventos reais. Não se atribui a este cache todo o crescimento dos diagnósticos físicos antigos.

## Legendas dos anéis

A posição anterior considerava somente o ponto médio de cada segmento. Um anel contínuo oferecia apenas uma opção; se ela ficava atrás do cartão, não havia alternativa, embora outra parte do anel estivesse visível. Agora são consideradas até 24 posições distribuídas pelos vértices do contorno completo. Todas pertencem ao contorno publicado ou calculado; distâncias e intensidades não são inventadas. As proteções contra painéis e outras legendas permanecem. Quando não há espaço legível, a legenda continua oculta.

Não foram alterados atenuação, severidades, cores, espessuras neon, seleção ou trajetória da câmera.

## Diagnóstico e validação

Novas amostras identificam `session-stability-v10` e incluem somente contadores de memória e trabalho da sequência, sem IDs, coordenadas ou textos de eventos. Relatórios anteriores continuam históricos.

Testes cobrem fonte aguardando/indisponível, timestamps, cobertura por categoria, foco do diagnóstico, limite e limpeza do histórico, novidades/revisões, agrupamento e seleção, vértices alternativos, obstáculos e legibilidade em celular/desktop. O ensaio de navegador com câmera nativa e imagens locais é uma verificação curta de recursos; não equivale a um dia inteiro nos aparelhos físicos.

O [ensaio de navegador](audits/session-v10-soak-20261026.json) durou 183,8 s, com nove trocas de cenário, câmera nativa, CPU 4× e viewport 411×806/DPR 2,625. Terminou sem erros JavaScript; após limpeza, heap principal de 26,85 MiB, dois canvases, zero URLs/nós de áudio transitórios e nenhuma recuperação raster pendente. Os dados e imagens são locais; não medem GPU/RAM total nem disponibilidade real das fontes. Os hashes no artefato identificam os scripts exercitados. O teste unitário adicional cobre retorno da página sem disparar foco de câmera.
