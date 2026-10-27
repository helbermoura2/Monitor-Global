# Custos e cotas — inventário operacional

**Diretriz vigente: manter o plano Free, confirmado pelo dono em 27/10. O acompanhamento atual está em [cotas gratuitas](cotas-free-monitoramento.md). As seções de alertas financeiros abaixo registram a investigação anterior; não é necessário configurar valor em dólares para este acompanhamento.**

Revisão: 27/10/2026. Este documento organiza o que existe; **não é uma fatura nem confirmação do plano contratado**. Não foram alterados planos, cotas ou notificações da conta.

## Serviços e limites

| Serviço | Uso no projeto | Proteção / observação existente | O que falta medir |
| --- | --- | --- | --- |
| Worker `black-sky-9ba0` | APIs, fontes, imagens, Telegram e cron | Cache compartilhado e circuitos das fontes | Solicitações e CPU faturadas, plano e franquia real |
| Worker `monitor` / hospedagem | Recursos estáticos; `wrangler-monitor.toml` | Assets estáticos; GitHub Pages também publica o site | Qual hostname atende cada implantação e cobrança efetiva |
| Durable Objects SQLite | Entregas, população, fontes e caches | Meta interna 35.000 solicitações/dia; teto interno 45.000; auditoria a cada seis horas | Duração, linhas lidas/escritas e armazenamento além de solicitações |
| KV `TTS_USAGE` | Cache/legados e contagem de operações | Auditoria e métricas por função | Leituras, escritas, listagens, exclusões e GB totais na conta |
| Workers AI | Tradução de conteúdo para português | Código limita entrada a 50.000 caracteres/dia; cache | Neurons/modelo, chamadas e valor cobrado; caracteres não equivalem a neurons |
| Amazon Polly | Voz neural | 300.000 caracteres/mês no cache de voz; fallback de navegador | Franquia/valor AWS; este custo não pertence à Cloudflare |
| Rainbow | Meteorologia, nowcast e tiles | Weather 4.500/mês, 150/dia; tiles 27.000/mês, 800/dia; nowcast com orçamento próprio | Franquia contratada; verificar se produtos compartilham cota na conta do provedor |
| GitHub Actions / artifacts | Testes, coleta e disponibilidade | Tempo máximo por job e retenção limitada | Minutos/armazenamento conforme plano e visibilidade |
| Telegram | Entrega de mensagens/imagens | Deduplicação e revisões | Limites de envio; não confundir com custo de gerar imagem/voz |

Os números de proteção vêm de `tools/durable-budget-policy.json`, `shared-voice-cache.mjs`, `monitor-global-worker-7_7_0.js`, `rainbow-products-worker.mjs` e `rainbow-nowcast-worker.mjs`. **Teto de projeto não é bloqueio financeiro da conta.** CORS também não impede terceiros de consumir uma API pública.

## Medições conhecidas e lacunas

A [auditoria de 21/10](runtime-consumption-audit-20261021.md) registrou, no dia UTC completo de 19/10, 2.877 solicitações Durable, das quais 1.922 de população, e 46 leituras KV. No dia 20/10, ainda parcial, foram 2.737 solicitações e 82 leituras KV. São números históricos, não consumo atual. A referência de 100 mil/dia citada naquela conta não deve ser estendida a outros produtos nem tomada como confirmação atual do plano.

A auditoria Durable [40131800329](https://github.com/helbermoura2/Monitor-Global/actions/runs/40131800329), de 24/10, concluiu com sucesso. Nesta revisão a consulta dos metadados funcionou, mas o download do artifact foi bloqueado por HTTP 403. Portanto **não foram recuperados novos totais**, nem custos/SQLite/armazenamento completos. Ausência de uma métrica não significa consumo zero.

## Onde conferir e opções de aviso

1. Cloudflare → conta → **Billing**: conferir plano, invoices e subscriptions de cada produto. Registrar moeda, período e franquias antes de calcular qualquer valor.
2. **Workers & Pages** → Worker → métricas: solicitações/CPU. **Durable Objects** e **KV**: consultar operações e armazenamento. **Workers AI**: consumo do modelo. Nomes de menus podem variar.
3. Para contas **Pay-as-you-go**, a documentação atual confirma alertas de gasto acumulado em USD para a conta inteira: **Manage Account → Billing → Billable Usage → Create budget alert**. Definir valor e destinatários no painel. A opção é diferente dos avisos por métrica de cada produto em Notifications.
4. O alerta financeiro é informativo: não interrompe consumo nem limita cobrança. A documentação descreve implantação gradual de um alerta padrão de US$10 para contas elegíveis; isso **não confirma que ele esteja ativo nesta conta**. As mensalidades recorrentes ficam fora desse cálculo de consumo, e o processamento não é em tempo real. Não foi criado destinatário ou alterado plano nesta revisão.
5. No GitHub, abrir **Audit Durable Object requests and storage**, **Audit Cloudflare KV consumption** e o relatório diário KV. São complementos às métricas oficiais, não a fatura consolidada.

**Pendente de acesso ao painel:** confirmar plano/franquias, recuperar totais atuais, verificar quais notificações a conta oferece e escolher destinatário. Nenhum alerta de orçamento foi ativado nesta revisão.

## Referências oficiais para confirmação

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [KV](https://developers.cloudflare.com/kv/platform/pricing/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Notifications](https://developers.cloudflare.com/notifications/)

As páginas de preços retornaram HTTP 403 no ambiente desta revisão. Por isso não foram copiados valores ou anunciadas cotas atuais como verificadas.

## Atualização de 27/10: dados recuperados e referência de orçamento

Os relatórios atuais foram recuperados dos logs dos fluxos [Durable 40460823583](https://github.com/helbermoura2/Monitor-Global/actions/runs/40460823583) e [KV 40460826526](https://github.com/helbermoura2/Monitor-Global/actions/runs/40460826526), embora o download de artifacts continuasse retornando 403. Em 26/10 UTC completo: **2.295 solicitações Durable**, sendo **1.338 de população**; **47 leituras e duas escritas KV** nos grupos retornados. São métricas operacionais, não uma fatura. O dia 27 estava parcial na consulta.

A consulta consolidada de assinaturas, agregados e capacidades de notificação foi acrescentada ao fluxo `cloudflare-account-audit.yml`, com transporte que recusa mutações e relatório sem emails, webhooks ou identidade de faturamento. Consultas sem permissão ficam explícitas. A execução [40462939462](https://github.com/helbermoura2/Monitor-Global/actions/runs/40462939462) concluiu com sucesso; resultados abaixo e no [JSON sanitizado](audits/cloudflare-account-20261027.json).

Fontes oficiais consultadas em 27/10: [alertas de orçamento](https://developers.cloudflare.com/billing/manage/budget-alerts/), [alerta padrão para contas elegíveis](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/) e [preços de Workers](https://developers.cloudflare.com/workers/platform/pricing/). O conteúdo dessas páginas ficou acessível nesta revisão; o bloqueio citado acima descreve a revisão histórica de 24/10. Preços públicos não confirmam o plano desta conta.

## Consolidação obtida às 06:45 UTC de 27/10

| Serviço / métrica | 25/10 completo | 26/10 completo | 27/10 parcial |
| --- | ---: | ---: | ---: |
| Worker `black-sky-9ba0`: solicitações | 39.263 | 38.524 | 13.816 |
| Worker: CPU agregada (`cpuTimeUs` convertido em segundos) | 213,85 s | 272,29 s | 96,95 s |
| Worker: erros de invocação registrados | 3.212 | 429 | 270 |
| Durable: solicitações | 3.360 | 2.295 | 757 |
| Durable: erros registrados | 32 | 19 | 4 |
| Durable SQLite: linhas lidas | 8.464 | 6.721 | 2.185 |
| Durable SQLite: linhas escritas | 3.746 | 2.072 | 709 |
| Durable SQLite: máximo diário de bytes armazenados | 105.365.500 | 114.040.830 | 116.908.030 |
| KV: operações agregadas | 50 | 49 | 69 |
| Workers AI: neurons, agregado da conta | 398,62 | 268,18 | 134,97 |

`storedBytes` usa o agregado **max**; não é somado entre datas como capacidade contratada. CPU de Workers foi convertida somente porque o campo declara microssegundos. Campos `duration`, métricas de custo de modelos e CPU de Durable permanecem em valores brutos no JSON: não foram convertidos em dólares com unidades ou plano presumidos. Erros de invocação não foram atribuídos a uma causa por esta consulta; a auditoria Durable detalhada registrou `clientDisconnected` em 26/10. Não há evidência aqui de erro por exceder CPU/memória nos agregados periódicos de Durable retornados.

As métricas são adaptativas, com possível amostragem e atraso. O parcial de 27/10 não é projeção de dia completo. Workers traz `scriptName=black-sky-9ba0`; AI e armazenamento estão agregados por conta, sem atribuição exclusiva ao projeto. A ausência de linhas em outros datasets não comprova ausência de uso. Armazenamento KV não foi obtido pelo coletor nesta execução. O dataset de inferência detalhado não tem o formato de agregação utilizado; o dataset agregado de AI foi obtido.

### Avisos financeiros: opções visíveis, sem políticas configuradas

A API retornou os tipos **`billing_budget_alert`** e **`billing_usage_alert`**, email como destino elegível/pronto e uma lista vazia de políticas. Isso confirma as opções expostas pela API, **não um alerta ativo nem a confirmação do plano Pay-as-you-go**. A leitura de `/accounts/.../subscriptions` retornou **403 Authentication error** com a credencial existente; não foram recuperados plano, franquias contratuais, assinaturas nem uma fatura.

Para ativar um aviso financeiro faltam definir o limite em USD e o destinatário e confirmar a elegibilidade do plano no painel **Billing → Billable Usage**. Não foi escolhido email, criado alerta ou alterado orçamento por suposição. O [guia oficial](https://developers.cloudflare.com/billing/manage/budget-alerts/) confirma que o aviso não bloqueia cobranças. Recomenda-se conceder somente a leitura administrativa necessária para revisar o plano, sem substituir a credencial operacional por uma chave global.
