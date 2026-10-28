# Prioridades pendentes

Atualização: 27/10/2026. Pedido do dono: trabalhar primeiro nas três pendências abaixo e guardar os quatro próximos itens para depois. Esta fila registra o trabalho; não declara problemas resolvidos sem evidência.

## Agora: cotas, CPU e filtros de build

| Pendência | Situação verificada | O que falta para concluir |
|---|---|---|
| Medir a economia após a atualização de população | Publicada em 27/10 às 10h59 UTC. Monitor Free já executa quatro vezes ao dia. Nova leitura em 27/10 às 11h06 UTC: último dia completo ainda é 26/10. | Comparar dias completos após publicação com o baseline, considerando usuários/eventos. Primeiro dia integral: **28/10 UTC**, disponível no relatório agendado de **29/10 às 00h45 UTC (28/10 às 21h45 de Brasília)**. Depende da execução e da disponibilidade dos dados da Cloudflare. |
| Investigar os quatro excessos de recursos | Agregado de 27/10 continua com os mesmos quatro registros. Nova captura de 121 segundos teve dez chamadas, todas `ok`, sem tráfego sintético; sessão removida. | Identificar uma rota com excesso e sua causa antes de corrigir código. A captura não reproduziu a falha; não comprova que a CPU foi corrigida. |
| Evitar builds desnecessários do backend | **Configuração manual concluída e validada na main:** commit de documentação `9ecc564` publicou site/hosting, sem um novo check/build de `black-sky-9ba0`; antes da configuração havia builds dos dois Workers. | Prévias dos PRs ainda geraram versões de teste; a observação confirma o resultado na publicação principal, não supressão de todos os builds de prévia nem minutos economizados. Não é necessário novo token para esse ajuste. |

Baseline de 26/10 UTC: **38.524 chamadas Worker**, **2.295 Durable**, das quais **1.338 de população**. Parcial de 27/10 às 11h06 UTC: **15.016 Worker**, **941 Durable**, **410 de população**. Estes parciais misturam versões e não demonstram economia causada pela última publicação.

O filtro foi configurado manualmente no Worker **`black-sky-9ba0`**. Foram incluídos `monitor-global-worker-7_7_0.js`, `*.mjs`, `worker/*`, `js/*`, `data/*`, `wrangler.toml`, `package.json`, `package-lock.json`, `tools/*` e `downloads/monitor-global-worker-otimizado.zip`. O projeto estático `monitor` e as exclusões anteriores ficaram intactos. **Não é necessário criar outro token para concluir essa configuração manual.** O 403 anterior continua sendo uma limitação da automação, não uma indicação de que o filtro manual deixou de ser salvo.

Evidência desta verificação: [relatório sanitizado](audits/prioridades-acompanhamento-20261027.json). Execuções: [cotas](https://github.com/helbermoura2/Monitor-Global/actions/runs/40493552678) e [CPU/filtros](https://github.com/helbermoura2/Monitor-Global/actions/runs/40493556603). A segunda execução termina com falha por causa do 403 dos filtros; a captura de CPU em si terminou e removeu sua sessão.

## Os quatro itens retomados em 28/10/2026

Implementação retomada por pedido do dono. Conferidas as funções existentes para evitar duplicação. Ver [mudanças e limites](CONFIANCA_E_ISOLAMENTO.md) e [operação rápida](OPERACAO_EM_UMA_PAGINA.md).

1. [x] **Clareza das informações** — revisar site, imagens do Telegram e TV para distinguir dado oficial, magnitude, intensidade local e estimativas, preservando o visual aprovado.
2. [x] **Guia curto de operação e recuperação** — aproveitar Guia do dono, instruções de publicação e reversão existentes para uma referência curta, sem refazer a documentação inteira.
3. [x] **Isolamento de falhas** — conferir que população, clima e outros serviços opcionais possam falhar sem impedir a apresentação dos dados e avisos oficiais.
4. [x] **Resumo legível da saúde do sistema** — aproveitar os relatórios existentes para apresentar a saúde e as cotas em português simples. Destino: Summary da Action de cotas existente, quatro vezes por dia; sem novo serviço ou envio de mensagens.

Continuar no plano Free. Não mudar câmera, frequência de alertas ou regras do Telegram para economizar consultas. Os quatro itens foram retomados por autorização do dono em 28/10. As investigações de cotas e CPU acima continuam abertas; não são consideradas resolvidas por estas mudanças.

Validação do filtro manual: [evidência dos checks e publicação](audits/build-watch-paths-manual-20261027.json). A API continua retornando 403; isso não desfaz a configuração manual confirmada pelo dono.
