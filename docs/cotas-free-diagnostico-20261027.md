# Cotas Free: maiores consumidores e opções de redução

Consulta real: **27/10/2026, 09:37 UTC**. [Execução 40482127691](https://github.com/helbermoura2/Monitor-Global/actions/runs/40482127691). [JSON com dados, grupos, descrições de unidades e lacunas](audits/free-quota-20261027.json). [Tabela completa gerada](audits/free-quota-20261027.md).

A coleta recorrente já está instalada no [fluxo de cotas Free](../.github/workflows/cloudflare-free-quota.yml), quatro vezes por dia. O plano Free é a referência confirmada pelo dono. Não houve contratação, configuração de alerta em dólares ou alteração das frequências de sismos, revisões, tsunami ou câmera.

## Maior pressão medida: solicitações do Worker

| Dia UTC completo | Chamadas do Worker | Fração de 100.000/dia |
| --- | ---: | ---: |
| 21/10 | 48.303 | 48,30% |
| 22/10 | 69.275 | 69,28% |
| 23/10 | 74.609 | 74,61% |
| 24/10 | 57.757 | 57,76% |
| 25/10 | 39.263 | 39,26% |
| 26/10 | 38.524 | 38,52% |

O pico observado já passou da faixa de atenção de 70%. A redução observada depois não comprova uma economia causada por uma alteração específica: tráfego e tempo de uso podem variar. O parcial de 27/10 tinha 14.611 chamadas até a consulta; não foi projetado para o dia inteiro.

## Comparação por recurso em 26/10 UTC completo

Cada percentual usa a cota de seu próprio produto; não somar os percentuais como se fossem uma única conta.

| Recurso | Consumo medido | Cota Free | Utilização |
| --- | ---: | ---: | ---: |
| Solicitações do Worker | 38.524 | 100.000/dia | **38,52%** |
| Duração Durable | 1.158,329 GB·s | 13.000 GB·s/dia | **8,91%** |
| Workers AI | 268,179 neurons | 10.000/dia | 2,68% |
| Solicitações Durable | 2.295 | 100.000/dia | 2,30% |
| Armazenamento SQLite, máximo do dia | 114.040.830 bytes | 5 GB totais | ~2,28% |
| Linhas SQLite escritas | 2.072 | 100.000/dia | 2,07% |
| Armazenamento KV, máximo do dia | 2.287.935 bytes | 1 GB total | ~0,23% |
| Chaves KV escritas | 2 | 1.000/dia | 0,20% |
| Linhas SQLite lidas | 6.721 | 5.000.000/dia | 0,13% |
| Chaves KV lidas | 47 | 100.000/dia | 0,047% |

A unidade de duração foi confirmada pela descrição real do schema: `Sum of Duration - GB*s`. Armazenamento é comparado conservadoramente em GB decimal e não renova diariamente. Grupos ausentes de exclusões/listagens KV não foram convertidos em zeros.

Os máximos SQL subiram de 56.492.030 bytes em 21/10 para 114.040.830 em 26/10. É uma tendência de armazenamento, não de RAM. Continua longe de 5 GB, mas vale acompanhar retenção e reutilização de espaço. Não foi feita exclusão de históricos ou caches persistidos.

## Quem chama Durable

| Família | Chamadas em 26/10 | Fração das chamadas Durable |
| --- | ---: | ---: |
| População | 1.338 | **58,30%** |
| Objeto central de sismos/avisos | 480 | 20,92% |
| Resumos por data, somados | 299 | 13,03% |
| Rainbow nowcast | 88 | 3,83% |
| Métricas internas | 42 | 1,83% |
| Traduções | 29 | 1,26% |
| Rainbow weather | 19 | 0,83% |

As famílias por data foram agrupadas apenas para apresentação. Elas não representam número de assinantes ou TVs. População domina Durable, mas reduzir suas chamadas não implica reduzir na mesma proporção as solicitações de entrada no Worker.

## Limite por invocação também merece atenção

O parcial de 27/10 registrou **quatro invocações `exceededResources`**. Nesse grupo, o schema informa:

- CPU P50: 12.902 microssegundos = **12,902 ms**.
- CPU P99: 19.032 microssegundos = **19,032 ms**.
- Memória do isolate P50: 19.013.632 bytes, aproximadamente 18,13 MiB.
- Memória do isolate P99: 20.348.928 bytes, aproximadamente 19,41 MiB.

O limite Free de CPU é 10 ms por invocação. Esses valores são um **indício de pressão de CPU**, sem estabelecer a causa de cada falha ou identificar a rota. São quantis do grupo, não máximos globais, e o runtime pode permitir variações por reaproveitamento de CPU entre chamadas. A memória observada nesse grupo fica bem abaixo do limite de 128 MB por isolate. Não é medição da TCL, do Fire Stick ou do navegador.

Houve também 429 invocações `scriptThrewException` e 2.830 `clientDisconnected` em 26/10. Isso não corresponde a status HTTP 429. As causas não foram atribuídas por rota nesta auditoria; não se concluiu que sejam falhas de cota. [Referência de métricas e estados](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

## Onde há possibilidade de reduzir

1. **Chamadas repetidas ao Worker:** conferir consultas públicas idênticas, especialmente entre duas janelas/abas, e alinhar consultas complementares à validade dos dados já informada pela fonte. Uma resposta 304 ou servida de cache ainda envolve entrada no Worker. O site já junta requisições simultâneas dentro da mesma janela e pausa tarefas ocultas; isso não equivale a compartilhar respostas entre janelas visíveis. Não foi medida atribuição por rota, então não se anunciou percentual de economia.
2. **CPU de chamadas com recurso excedido:** identificar os handlers e analisar seus processamentos mais pesados antes de alterar código. A coleta agora inclui quantis e status para acompanhar a incidência. É uma prioridade de execução que não se resolve apenas com folga na cota diária de solicitações.
3. **População:** o servidor já reaproveita respostas por cinco minutos e o navegador guarda resultados disponíveis. No cliente, respostas sem resultado válido não entram nesse mesmo cache. Um cache negativo curto, por evento e parâmetros, é candidato a evitar consultas repetidas ao rever o mesmo evento. Deve preservar disponibilidade de PAGER, revisões e indicação de indisponibilidade, sem tratar falta de dados como população zero. Ainda não aplicado ou quantificado.
4. **Builds do backend:** os commits de documentação e APK deste trabalho receberam checks dos dois Workers. Filtrar arquivos observados do `black-sky-9ba0` pode evitar compilações/implantações quando seu código não mudou. O Worker de hospedagem precisa continuar publicando novos APKs e recursos do site. Configurações atuais de watch paths e minutos mensais não puderam ser lidas: a API retornou 403. Não foi aplicado um filtro nem estimada sua economia.
5. **Armazenamento:** acompanhar a curva e revisar retenções que já existem, antes de remover dados. Com ~2,28% da capacidade SQL na comparação conservadora, não é a maior pressão medida neste momento.

A consulta da TV segue a regra existente, sem aumento de intervalo. Como modelo de demanda, uma consulta a cada 30 segundos equivale a até 2.880 chamadas em 24 horas por aparelho ativo, antes de consultas adicionais ou atrasos de rede. Isso é uma conta de cadência, não atribuição medida no tráfego de produção.

## Cobertura que ainda falta

- **Logs Workers:** 200.000 eventos/dia na referência atual, mas o volume efetivamente armazenado não foi obtido. Configuração não retornada não significa logs desativados. Não inferir volume apenas do número de requisições.
- **Workers Builds:** 3.000 minutos/mês no Free; listagens de builds e triggers retornaram 403. Não foi inferido um total mensal de contagem de checks GitHub.
- **CPU por invocação:** percentis não comprovam conformidade de todas as chamadas; rotas e causas das exceções requerem logs de invocação.
- Métricas são adaptativas, podem atrasar ou ser amostradas. Datas/ações sem grupos retornados são lacunas, não prova de consumo zero.

O [guia do acompanhamento](cotas-free-monitoramento.md) descreve fontes, horários, limites e faixas de aviso. Esta etapa instala o acompanhamento e identifica alvos; não anuncia uma economia de produção ainda não medida.
