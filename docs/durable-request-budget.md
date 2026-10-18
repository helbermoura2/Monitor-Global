# Durable Objects: controle de solicitações e cache

A cota de solicitações é separada das cotas de linhas lidas/escritas e do Workers KV. A auditoria de 18/10 às 00:13 UTC encontrou 93.053 invocações em 17/10, incluindo 42.998 com `scriptThrewException`. A auditoria posterior por nome atribuiu 40.857 chamadas (43,9%) ao contador `kv-operation-metrics-v1` e 8.018 aos alarmes de fontes públicas. Isso comprova falhas, mas não identifica sozinho a mensagem ou causa de cada exceção.

## Mudanças

- Contadores de atividade de fonte/população/voz deixam de criar uma segunda invocação e uma gravação por requisição. Operações reais de KV continuam sendo observadas por família, com entrega de melhor esforço; os totais da conta permanecem na Cloudflare. A interface identifica os contadores de atividade antigos como históricos.
- Coletores públicos mantêm o estado atualizado em memória e persistem um checkpoint a cada 15 minutos. A primeira coleta salva uma cópia. Backoff de provedores com falha é salvo prioritariamente, com no máximo uma tentativa a cada 30 segundos.
- Falha de armazenamento do checkpoint não impede o retorno de uma coleta válida. Horários originais e limites de validade continuam valendo. Reinício pode recuperar um checkpoint mais antigo e consultar novamente o provedor; não transforma dado vencido em atual.
- Limpeza dos caches ocorre durante as consultas; não são criados novos alarmes recorrentes de limpeza de fonte. Alarmes legados podem executar até esvaziar os snapshots antigos.
- Histórico/deduplicação do Telegram, cotas de voz e tarefas de população continuam persistentes. Preservados os blocos de 400.000 caracteres e a consolidação de gravações do Telegram da alteração c1a817c.

## Verificação

Testes: 1.000 requisições somente de atividade produzem zero invocações de métricas; 300 atualizações de dois campos em 30 minutos fazem quatro gravações de checkpoint, contra 600 chamadas de gravação sem agrupamento. São medições de teste, não projeção garantida da conta. Também são verificados rollback, recuperação de checkpoint, falha de cota sem perda da resposta e backoff após reinício.

`/health` deve retornar `durableRequestBudget: durable-request-budget-v1`. O fluxo de manutenção exige esse marcador antes de declarar sucesso. A auditoria agregada não aciona os objetos; os números podem ter atraso/amostragem. A redução diária real depende do tráfego e deve ser medida após a publicação.
