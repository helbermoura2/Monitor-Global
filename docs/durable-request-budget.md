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

## Consultas sob demanda e auditoria diária — 18/10/2026

- O cron deixa de pré-carregar `/sp-clima` e `/global-feeds` sem visitantes. As rotas continuam disponíveis sob demanda. O coletor sísmico e a janela de envio do resumo diário do Telegram permanecem independentes e ativos.
- As revisões brasileiras dos três resumos anteriores são verificadas nas janelas UTC de 15 minutos. Não alteram a emissão do alerta novo nem o resumo diário inicial; uma revisão histórica com falha pode aguardar a próxima janela.
- METAR, diagnóstico de disponibilidade sísmica e modelos Open-Meteo/CPTEC usam cache de cinco minutos. São informações complementares; os prazos dos feeds sísmicos, avisos meteorológicos, escalada vulcânica e tsunami não foram aumentados. A resposta mantém o horário real de coleta e estados de falha/parcial.
- Consultas populacionais idênticas compartilham resposta em memória/borda **antes** de acionar o objeto: resultado disponível ou modelo não suportado por até cinco minutos, pendente por até dez segundos, indisponível por um minuto. A validade absoluta não é renovada em acertos do cache, e a chave inclui coordenadas, magnitude, profundidade, origem e identificador USGS. As tarefas WorldPop e o histórico permanecem persistentes. O cache de população é separado do cache dos feeds urgentes.
- Snapshots de fontes expiram por validade e limpeza sob demanda. Alarmes legados podem executar uma última vez, mas a limpeza não os reagenda. O código anterior ainda reagendava alarmes legados em `pruneSources`; a nova validação cobre um snapshot ainda válido durante esse alarme. Alarmes necessários para limpar tarefas/estados populacionais expirados, histórico de entrega e cotas de voz continuam independentes.
- PNGs idênticos compartilham renderização com limite de duas entradas/8 MiB por isolate, por um minuto nos alertas e cinco minutos nos resumos. Mudança em qualquer entrada da imagem invalida a chave. Isso reduz CPU e consultas de mapas; não representa por si só redução de invocações de Durable Objects. A verificação de grade oficial continua anterior ao reaproveitamento do PNG.

`/health` deve informar `demandBudget: demand-enrichment-v1`; a manutenção exige esse marcador. O pacote preserva os mesmos pixels das imagens nas verificações de paridade e não muda reservas/deduplicação do Telegram.

A auditoria agora agrupa solicitações por família, tipo e resultado, além de mostrar os maiores objetos. Projeta separadamente a taxa dos últimos dez minutos completos. Roda manualmente e diariamente às 00:15 UTC (21:15 BRT), lendo apenas a API de analytics e metadados da Cloudflare, sem chamar os objetos nem criar contadores de tráfego. Falta de analytics não significa zero consumo.

### Base medida antes desta rodada

Auditoria de **18/10/2026 01:16:57 UTC**, workflow `39085906066`: **573 solicitações entre 01:06 e 01:16 UTC**, sendo 446 HTTP e 127 alarmes. Todos os registros diários consultados pertenciam ao Worker `black-sky-9ba0`. Essa taxa curta equivale a **82.512/dia** se mantida, mas não é consumo diário medido. O dia 17/10 completo teve **93.053 solicitações**. A projeção anterior de 30–45 mil não foi comprovada e não deve ser apresentada como resultado.

A eliminação dos alarmes descartáveis e das consultas de fundo deve retirar uma parte relevante da taxa recente. População e PNG dependem da repetição efetiva e da distribuição por datacenter/isolate. A nova estimativa deve ser revisada com analytics posteriores à publicação e confirmada após um dia completo; não somar economias de cenários sintéticos como se fossem percentuais da conta.
