# Excessos de recursos — investigação de 28/10/2026

Consulta de métricas às 01h45 UTC. Worker afetado: **black-sky-9ba0**. São execuções do backend da Cloudflare; estes números não medem a RAM da TV, do Fire Stick ou do navegador.

| Dia UTC | Chamadas do backend | exceededResources | Parcela | CPU P50 / P99 das falhas | Memória P50 / P99 das falhas |
| --- | ---: | ---: | ---: | --- | --- |
| 27/10 completo | 18.896 | 24 | 0,127% | 19,032 / 70,591 ms | 19,121 / 26,332 MiB |
| 28/10 parcial até 01h45 | 4.271 | 9 | 0,211% | 16,671 / 42,611 ms | 20,452 / 21,440 MiB |

As contagens de excessos não mudaram entre as consultas de 01h30 e 01h45 UTC. As métricas podem atrasar ou ter amostragem; não concluir que não houve nenhum erro entre as consultas.

## O que os dados sustentam

CPU é o principal indício: quantis acima da referência de 10 ms por invocação do Free. A memória observada nos grupos está bem abaixo de 128 MiB. Os quantis não são máximos nem permitem excluir todo pico de memória. O próprio status agregado não distingue a causa nem identifica URL/rota.

Invocações com sucesso também podem ter quantis elevados de CPU; esses dados não demonstram o mecanismo exato da interrupção. Não é possível afirmar quais avisos foram afetados apenas por essa tabela. O histórico de logs de rota não está habilitado, portanto não há uma URL histórica para recuperar desse agregado.

## Captura natural realizada

Janela: 01h45m41 a 01h50m42 UTC, 301 segundos. Foram observadas **169 execuções: 167 `ok` e duas `canceled`**, estas na população. Nenhum `exceededCpu`, `exceededMemory` ou `exceededResources` foi capturado. Cancelamento não foi contado como excesso nem atribuído a uma causa sem evidência.

Incluiu 20 consultas `/tv-alerts`, nove `/population-exposure` com `ok`, nove `/tsunami-alerts`, 91 ao proxy público, além de outras rotas e execuções de cron/alarmes. Isso verifica funcionamento nessa amostra; não prova que uma dessas rotas nunca excede recursos.

A sessão temporária foi removida. Não houve tráfego sintético, mensagens no Telegram, URLs completas, parâmetros, cabeçalhos, dados pessoais ou logs brutos armazenados. Não se alteraram código científico, frequência de alertas, cotas ou plano.

## Ferramenta e pendência

O coletor agora permite janela configurável de 30 a 300 segundos. O diagnóstico de rotas foi separado da API de filtros de build, cujo 403 conhecido não deve transformar uma captura válida em falha. Os filtros não foram consultados ou modificados nesta execução. Testes do coletor e dos filtros aprovados.

A causa específica e a rota continuam abertas. Não foi aplicada uma otimização de produção por suposição. Para corrigir com evidência, é necessário capturar uma ocorrência com o resultado de excesso e sua rota; a captura disponível continua limitada a uma janela temporária e pode não observar uma falha rara. Não instalar monitoramento persistente ou declarar correção com base apenas nesta amostra.

[Dados sanitizados](audits/resource-excesses-20261028.json) · [Relatório de cotas](https://github.com/helbermoura2/Monitor-Global/actions/runs/40616932452) · [Captura](https://github.com/helbermoura2/Monitor-Global/actions/runs/40616929566) · [Melhoria do diagnóstico, PR 544](https://github.com/helbermoura2/Monitor-Global/pull/544).
