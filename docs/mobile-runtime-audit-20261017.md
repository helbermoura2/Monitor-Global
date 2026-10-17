# Auditoria local de desempenho móvel — parte 1

Medição de 17/10/2026. Nenhuma API externa foi acessada: todos os pedidos fora do servidor local foram bloqueados; service worker desativado. Nenhuma operação KV, mensagem Telegram ou publicação foi realizada.

## Método

Chromium local, viewport 390×844, DPR 3, CPU com desaceleração 4×. Três repetições de janelas de cinco segundos por cenário. O mapa continuou renderizando; não substituímos seu renderizador. Sem tiles externos, portanto sem o custo real das imagens de satélite. Os efeitos usam os renderizadores reais locais. Medianas, sem concorrência com outros benchmarks durante a comparação de cenários.

`TaskDuration` mede tempo ocupado na thread principal do renderer; inclui trabalho além de JavaScript. Não representa CPU total do dispositivo, GPU, threads auxiliares, bateria ou FPS. Heap é apenas memória JavaScript principal amostrada depois da janela, incluindo alocações ainda não coletadas. Não serve para diagnosticar vazamento nem memória gráfica.

| Cenário | Thread principal ocupada em 5 s | JavaScript em 5 s | Heap JS aproximado |
|---|---:|---:|---:|
| Globo parado | 133 ms | 45 ms | 20,3 MiB |
| Globo com câmera em movimento | 4.973 ms | 679 ms | 25,2 MiB |
| Mapa plano parado | 112 ms | 24 ms | 20,5 MiB |
| Chuva de tela inteira | 3.285 ms | 380 ms | 21,7 MiB |
| Lava de tela inteira | 2.569 ms | 289 ms | 20,9 MiB |
| Área pintada estimada, pronta | 380 ms | 72 ms | 21.2 MiB |
| M8+ de tela inteira | 4.466 ms | 2.771 ms | 21,8 MiB |

## O que os números sustentam

1. O globo parado tem baixo custo neste teste. A câmera em movimento praticamente ocupa toda a janela da thread principal. Priorizar quantidade de quadros e custo de renderização durante transições; validar no aparelho antes de alterar a trajetória aprovada.
2. M8+ é o efeito com maior tempo de JavaScript. Chuva e lava também elevam bastante o trabalho total. Priorizar orçamento adaptativo de qualidade e evitar sobrepor efeitos pesados à câmera em movimento. Não remover os efeitos por estes dados isolados.
3. O tamanho inicial continua relevante: **215 recursos JS/CSS, 3.316.241 bytes descompactados** no instrumento de abertura. Essa contagem não inclui todos os dados, imagens, vídeos e tiles; não é transferência comprimida pela rede. O teste de abertura coincidiu com outro benchmark, portanto seus tempos foram descartados; apenas quantidade e bytes foram usados.
4. Inventário estático: MapLibre sozinho soma 1.015.688 bytes; painel/lista 133.979 bytes; CSS base 122.725 bytes; JSZip 97.630 bytes. Carregamento sob demanda é candidato à próxima etapa, especialmente recursos de exportação. Não trocar a biblioteca do mapa só pelo tamanho.

## Pins e lista: evidência já registrada

A auditoria controlada anterior com 800 registros mostrou 800→12 marcadores/grupos, 120→30 cartões e mediana de atualizações repetidas de 39,9→8,1 ms. Esses números constam em `mobile-six-items-20261017.md`; não foram medidos novamente nesta execução. Não significam ganho de 80% na velocidade de abertura.

## Limites e próximos passos

A comparação da área pintada fica no arquivo separado `mobile-performance-data/20261017-paint-runtime.json`. Mede a camada já calculada, não o custo inicial do cálculo no worker. O cenário é uma estimativa sintética M6 no Japão, sem consulta de mapa oficial.

Faltam medições em telefone físico com tiles reais, memória GPU e sessão prolongada. Não há base para prometer um valor de RAM total, economia de bateria ou fluidez universal. Esta etapa adiciona instrumentos e diagnóstico; o comportamento publicado continua igual.

Reproduzir com servidor local na porta 4173:

```sh
node tools/mobile-runtime-audit.cjs
AUDIT_SCENARIOS=paint AUDIT_REPEATS=3 node tools/mobile-runtime-audit.cjs
```

Dados completos em `mobile-performance-data/20261017-runtime.json` e inventário em `mobile-performance-data/20261017-static-resources.json`.
