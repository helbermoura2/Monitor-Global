# Acompanhamento das cotas gratuitas

O dono confirmou o plano **Free** em 27/10/2026. O acompanhamento compara consumo com as cotas oficiais gratuitas. Não consulta assinaturas ou orçamento financeiro, não muda plano e não ativa cobrança ou envio de mensagens.

O fluxo **Monitor Cloudflare Free quotas** roda às 00:45, 06:45, 12:45 e 18:45 UTC, além da execução manual. Consulta as APIs agregadas e configurações em modo somente leitura; não aciona os endpoints de eventos do projeto nem cria contadores, chaves KV ou chamadas a Durable Objects para medir. O relatório aparece no resumo da execução e em artifacts retidos por 30 dias, sem criar commits automáticos de dados que disparariam builds adicionais.

As referências estão em [`tools/free-quota-policy.json`](../tools/free-quota-policy.json), verificadas nas páginas oficiais em 27/10. Referências com mais de 30 dias exigem revisão. Avisos no GitHub: 70% atenção, 85% alto, 95% crítico e 100% limite alcançado. Um resultado recente crítico faz a checagem falhar; ausência total da métrica central de solicitações do Worker também não resulta em sucesso silencioso. Não há envio pelo Telegram nem destinatário configurado; notificações de falhas do Actions dependem das preferências de cada usuário do GitHub.

| Recurso | Cota Free usada como referência |
| --- | --- |
| Worker: solicitações dinâmicas | 100.000/dia |
| Worker: CPU | 10 ms por invocação; não existe comparação válida com uma média diária |
| Durable: solicitações | 100.000/dia, incluindo alarmes |
| Durable: duração | 13.000 GB·s/dia, somente quando a unidade do campo é confirmada pelo schema |
| SQLite de Durable: linhas lidas / escritas | 5.000.000 / 100.000 por dia |
| SQLite de Durable: armazenamento | 5 GB totais; não renova diariamente |
| KV: leituras / escritas / exclusões / listagens | 100.000 / 1.000 / 1.000 / 1.000 por dia |
| KV: armazenamento | 1 GB total |
| Workers AI | 10.000 neurons/dia |
| Workers Logs | 200.000 eventos/dia, retenção de três dias; referência precisa mudar em 01/12/2026 |
| Workers Builds | 3.000 minutos/mês; uma compilação simultânea |

Reinício diário: **00:00 UTC, 21h de Brasília**. A cota é compartilhada no escopo de cada produto; os totais de serviços diferentes não são somados como se fossem uma única cota. A capacidade usa conversão conservadora em GB decimal; valores de armazenamento são máximos diários observados, não capacidade instantânea. Não somar os máximos de dias diferentes.

O coletor procura até seis dias completos e o parcial atual, com janela menor explicitamente registrada quando o provedor a exigir. Métricas adaptativas podem atrasar ou ter amostragem. Datas faltantes e operações KV sem grupo retornado ficam como não medidas, não como uso zero. Bytes transferidos por operações KV não são confundidos com bytes armazenados. Um resultado 304 ainda consome uma chamada ao Worker; tráfego estático não deve ser somado à cota dinâmica sem a métrica correspondente.

O detalhamento de Durable informa as famílias mais chamadas no último dia completo e no parcial atual. O percentual de população é fração das solicitações **Durable**, não de todas as chamadas ao Worker. Status de invocação são retornados pelo provedor; contagem de erro não identifica sozinha um problema de quota ou uma rota específica.

Builds mensais e volume de logs podem exigir acesso adicional. Uma listagem recente de builds não comprova consumo mensal completo; amostragem de logs habilitada não informa quantos eventos foram efetivamente armazenados. Quando esses valores não forem obtidos, aparecem como lacunas de cobertura e não entram no ranking de consumo medido.

Fontes: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Durable/SQLite](https://developers.cloudflare.com/durable-objects/platform/pricing/), [KV](https://developers.cloudflare.com/kv/platform/pricing/), [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) e [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/).

## Investigação de redução

O primeiro relatório detalhado deve separar: pressão sobre solicitações do Worker; duração de Durable; famílias de acesso; operações de armazenamento; IA; lacunas de logs e builds. Comparar dias UTC completos, mantendo o dia atual como parcial. Não aumentar intervalos de sismos, revisões ou tsunami apenas para reduzir uma contagem.

Candidatos iniciais a validar: chamadas repetidas entre telas/abas, repetições durante indisponibilidade, consultas de população com resultado já pronto e builds do backend causados por alterações que não mudam seu código. Reaproveitar respostas no servidor reduz chamadas de origem e Durable, mas não elimina as solicitações de entrada feitas pelo cliente. A economia real depende do que for mudado e precisa ser medida depois; não anunciar uma projeção como redução já obtida.

Primeira coleta real concluída: [maiores consumidores e possibilidades de redução em 27/10](cotas-free-diagnostico-20261027.md), com duração confirmada em GB*s, armazenamento KV, histórico de dias completos e quantis de CPU/memória por grupo.
