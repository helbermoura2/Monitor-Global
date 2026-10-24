# Custos e cotas — inventário operacional

Revisão: 24/10/2026. Este documento organiza o que existe; **não é uma fatura nem confirmação do plano contratado**. Não foram alterados planos, cotas ou notificações da conta.

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
3. Conta → **Notifications** → criar notificação: procurar opções de uso/limites disponíveis para os produtos/plano. Se oferecida, configurar aviso em patamares como 50%, 80% e 95% da franquia real. Não presumir que existe alerta universal de valor em reais ou desligamento automático.
4. Se não houver alerta monetário, combinar métricas/avisos por produto e revisão periódica de Billing. Alertas de consumo não garantem bloqueio de cobranças. Não contratar serviços nem mudar plano para isso sem decisão do dono.
5. No GitHub, abrir **Audit Durable Object requests and storage**, **Audit Cloudflare KV consumption** e o relatório diário KV. São complementos às métricas oficiais, não a fatura consolidada.

**Pendente de acesso ao painel:** confirmar plano/franquias, recuperar totais atuais, verificar quais notificações a conta oferece e escolher destinatário. Nenhum alerta de orçamento foi ativado nesta revisão.

## Referências oficiais para confirmação

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [KV](https://developers.cloudflare.com/kv/platform/pricing/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Notifications](https://developers.cloudflare.com/notifications/)

As páginas de preços retornaram HTTP 403 no ambiente desta revisão. Por isso não foram copiados valores ou anunciadas cotas atuais como verificadas.
