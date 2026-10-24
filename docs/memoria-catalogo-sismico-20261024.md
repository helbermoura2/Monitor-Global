# Acúmulo de relatórios sísmicos — 24/10/2026

Foi reproduzido e corrigido um acúmulo sem limite no catálogo. Os contadores anteriores de caches não incluíam esses objetos; por isso caches com tamanho estável não descartavam esse problema.

## Causa e correção

`fetchGeoNetData`, `fetchJMAData`, `fetchBMKGData` e outros adaptadores regionais geram `id`, mas nem todos geram `sourceEventId`. `sismoReconcileReports` só reconhecia o segundo campo como identidade. Assim, `sismoPreserveMatchedReports` preservava os relatórios antigos e acrescentava outra cópia da mesma publicação em toda rodada do feed. Um único sismo chegou a 101 relatórios internos depois de 100 novas rodadas.

A reconciliação agora usa `sourceEventId` ou, quando ausente, o `id` do relatório, sempre separado por agência. A cópia atual substitui a anterior conforme a precedência já existente. Relatórios distintos, fontes temporariamente ausentes, revisões para cima/baixo e a relação entre soluções rápidas/revisadas continuam preservados. Duplicatas acumuladas também são removidas na próxima reconciliação.

A alteração não impõe um descarte arbitrário de fontes e não modifica câmera, efeitos, intervalos ou seleção de eventos. Não há recarga automática para esconder o crescimento.

O snapshot do heap confirmou a cadeia de retenção `globalEvents → evento → reports → cópias antigas`: os objetos continuavam alcançáveis pelo catálogo, portanto a coleta de lixo não podia removê-los.

## Comparação no navegador

No mesmo site local, com tráfego externo bloqueado, foi alternada somente a implementação antiga/corrigida de `sismoReconcileReports`. Foram renovados os objetos de 200 sismos regionais durante 960 rodadas. Cada amostra foi medida após coleta explícita de lixo pelo Chromium.

| Medição | Antes | Corrigido |
| --- | ---: | ---: |
| Heap inicial | 19,01 MiB | 18,99 MiB |
| Relatórios após 120 rodadas | 24.000 | 200 |
| Relatórios após 960 rodadas | 192.000 | 200 |
| Heap após 960 rodadas | 70,62 MiB | 20,40 MiB |
| Heap entre rodadas 120 e 960 | 25,69 → 70,62 MiB | 19,62–20,40 MiB |

[Resultado do navegador](audits/catalog-report-browser-memory-20261024.json). A carga de atualizações corresponde numericamente a 12 horas em intervalos de 45 segundos, **mas é uma reprodução acelerada, não uma sessão real de 12 horas**. Não mede RAM total, GPU ou memória de workers.

Uma repetição isolada em Node, usando as mesmas funções do código de produção, também manteve 200 relatórios nas 960 rodadas e heap próximo de 4,8 MiB após aquecimento. [Resultado isolado](audits/catalog-report-node-memory-20261024.json).

Essa comparação comprova a correção deste mecanismo de retenção. Os diagnósticos originais não têm snapshots nem contagem de relatórios internos: não é possível atribuir retrospectivamente todos os 700+ MiB a ele ou declarar o consumo total dos aparelhos resolvido apenas com essa reprodução.

## Verificação e prevenção

- 56 testes Node passaram, incluindo 1.000 atualizações por fonte regional, saneamento de 900 duplicatas existentes, preservação de fontes/IDs distintos e seleção de revisões oficiais.
- 14 testes de navegador passaram: diagnóstico local, sequência sísmica e estado das fontes. Os contadores novos não exportam IDs, locais, coordenadas ou conteúdo dos eventos.
- O diagnóstico registra `memoryOwners.quakeReports` (eventos, relatórios, máximo por evento e quantidade por fonte) e `runtimeVersion: catalog-memory-v8`. Assim o crescimento do catálogo passa a ser visível separadamente dos caches.
- A regressão de reconciliação faz parte do workflow `Long session regression`.
- Um teste antigo em `quake-priority.test.cjs` já falha também na versão anterior: espera que um evento menor interrompa uma apresentação protegida. Nenhuma regra de câmera foi alterada para satisfazer essa expectativa desatualizada.

Para repetir localmente, com dependências instaladas:

```sh
git show e0dd9da:js/sismo-fontes.js > /tmp/sismo-fontes-before.js
node --expose-gc tools/catalog-report-memory-audit.cjs --source=/tmp/sismo-fontes-before.js
node --expose-gc tools/catalog-report-memory-audit.cjs
# Em outro terminal: npx serve -l 4173 .
CHROMIUM_PATH=/usr/bin/chromium node tools/catalog-report-browser-audit.cjs /tmp/sismo-fontes-before.js
```

Snapshots completos do heap foram usados na investigação local e não entram no repositório por tamanho e por poderem conter conteúdo de página.
