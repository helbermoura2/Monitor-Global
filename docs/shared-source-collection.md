# Coleta compartilhada de fontes públicas

## Arquitetura

O navegador consulta o Worker para os feeds públicos selecionados. O caminho
padrão `edge-collectors-v1` não invoca Durable Objects: consultas simultâneas
compartilham uma coleta e as respostas recentes ficam em memória (48 entradas,
6 MiB). Até oito identidades são agrupadas em voo; outras seguem ao coletor sem
bloquear alertas. O estado de cada fonte (corpos validados, horários e espera após
falhas) é compartilhado pelo Cache API **dentro do mesmo datacenter**.

`edge-source-store.mjs` serializa as alterações locais por fonte. Guarda um
snapshot binário limitado por grupo e recupera-o em um isolate frio, mantendo os
horários absolutos. Não há coordenação global entre datacenters: uma fonte pode
receber uma coleta de cada região. Se o cache for perdido/recusar operações, a
cópia local ainda funciona; um isolate frio pode precisar consultar a fonte outra
vez. Falta de resposta válida retorna falha, não um catálogo vazio saudável.

O agregado global reutiliza os coletores de NHC, GDACS, EONET, NWS e tsunami. Seu
teste com fontes simuladas usa 25 subconsultas a frio, abaixo das 50 permitidas no
Worker gratuito. O cache de resposta por URL não duplica o snapshot de grupo nesse
caminho, reduzindo subconsultas. Clima/painel global são coletados sob demanda; o
cron não os pré-carrega. O Telegram mantém seu caminho persistente independente.

O caminho antigo permanece disponível para reversão explícita com
`PUBLIC_SOURCE_MODE=durable`; ele continua coberto pelos testes. A manutenção
normal exige `publicSourceRuntime: edge-collectors-v1` e sinaliza a reversão em vez
de declarar a nova arquitetura ativa.

A coleta fica em `shared-source-cache.mjs`; o cliente preserva os horários em
`js/shared-source-delivery.js`. O Worker mantém validações de domínio, formato e
parâmetros. Dados de consultas com magnitude, região, coordenadas ou datas fixas
diferentes não são misturados. Janelas relativas quase idênticas são agrupadas;
o horário de entrada é preservado para que a fila não altere sua identidade.

## Prazos e falhas

| Produto | Cache recente | Limite total da resposta retida após coleta válida |
| --- | ---: | ---: |
| Catálogos sísmicos | 30 s | 120 s |
| Feed rápido USGS | 15 s | 120 s |
| Boletins de tsunami | 10 s | 60 s |
| Avisos meteorológicos e CGE | 60 s | 180 s |
| Open-Meteo e CPTEC | 300 s | 900 s |
| METAR | 300 s | 600 s |
| Vulcões e ciclones normalizados | 120 s | 600 s |
| São Paulo | 300 s | 900 s |
| Agregado global | 120 s | 300 s |

Os limites contam desde a coleta válida, e não desde a última falha. Resposta
retida conserva seu horário e informa estado `stale`. Após o limite responde 503,
sem apresentar um catálogo vazio como se não houvesse eventos. Avisos mantêm seus
próprios vencimentos e regras de cancelamento; não há previsão de tsunami gerada.

Falhas usam espera progressiva de 30, 60, 120, 240 e até 300 segundos, compartilhada
por fonte/datacenter e recuperada após reinício quando o Cache API está disponível. `Retry-After` do provedor é respeitado até
uma hora. Erros de parâmetro 4xx, exceto 429, não abrem o circuito para outros
usuários. Uma resposta 200 com erro/GeoJSON inválido não substitui o último dado
válido. Um catálogo oficial vazio, mas válido, é aceito normalmente.

O navegador não contorna uma espera explícita do coletor com novas tentativas
diretas. Se o transporte até o Worker falhar, ainda pode usar o caminho direto.
Produtos não selecionados conservam seu fluxo. Voz paga, imagens, enriquecimento
populacional, operações do Telegram, buscas de lugares e TSE não entram neste cache.
O TSE continua consultado a cada 30 segundos. URLs com credenciais não são armazenadas.

## Armazenamento e saúde

Não há operações KV nem invocações de Durable Objects no caminho padrão desses
feeds. Cada fonte mantém até 16 variantes, com até 3 MiB por resposta. O snapshot
de grupo guarda até 4 MiB de corpos; cópias locais de grupos somam até 8 MiB por
binding/isolate, com remoção das mais antigas. Metadados binários ficam limitados
a 64 KiB. Leituras de estado corrompido ou grande demais são rejeitadas antes da
restauração. Estado/índice e espera são atualizados sem alarmes de limpeza.

O cache é descartável. Histórico e deduplicação do Telegram, tarefas de população
e cotas pagas mantêm persistência no Durable. As requisições HTTP continuam
consumindo recursos do Worker; retirar invocações do Durable não elimina a cota
separada de Workers nem as limitações dos provedores externos.

`GET /source-health?page=0` exige `X-Admin-Token`. Lê o estado de no máximo 20 fontes neste datacenter
por página, sem retornar URLs, coordenadas, textos dos eventos ou credenciais.
A aba **Saúde do serviço**, no acesso administrativo existente, mostra estado,
última coleta válida, última tentativa e próxima tentativa permitida. Exibe também
contadores observados e link para os relatórios da conta. Esses contadores não são
uma fatura e não incluem atendimentos que ficaram apenas no cache de borda.

O envio de contadores detalhados de atividade foi desativado: cada lote criava uma chamada adicional e uma gravação em Durable Objects. Os contadores de operações KV reais continuam sendo enviados, sem amostragem intencional, mas com entrega de melhor esforço. Valores de atividade anteriores à mudança são históricos, não consumo atual. As métricas agregadas da Cloudflare continuam sendo a referência para solicitações e linhas SQL.

## Publicação e validação

A manutenção manual verifica o checksum do pacote e exige o marcador
`sharedSources: {version: shared-sources-v1, enabled: true}` em produção, além dos
marcadores anteriores, `durableRequestBudget: durable-request-budget-v1`, `sourceEdgeBudget: shared-source-edge-v2` e `publicSourceRuntime: edge-collectors-v1`. O workflow executa os testes de concorrência, falha,
retenção, isolamento e persistência antes do upload. Preserva bindings, segredos,
cron e histórico de versões para reversão.

Testes novos: 30 visitantes/origens com uma chamada externa; cache após reinício;
espera compartilhada entre consultas; recuperação; expiração sem falso vazio;
consulta histórica/regional isolada; rejeição de dados inválidos; tamanho limitado;
reuso da borda e de fragmentos; privacidade do painel; prioridade do proxy no
cliente; preservação de idade e estado; acesso administrativo em 390 e 1280 px.
Serviços externos são simulados nesses testes. A implantação usa somente consultas
públicas de leitura para sua conferência; não envia mensagens ou sintetiza áudio.

## Prazo do cache de borda

O prazo é absoluto, calculado a partir da coleta original; atendimentos não o renovam. Respostas parciais ficam no máximo 30 segundos. Respostas retidas com estado `stale` só são reutilizadas até o menor prazo entre o próximo retry do provedor e o limite de retenção original. HTTP 503 pode ser compartilhado por até cinco segundos e continua HTTP 503 para o cliente, inclusive após leitura de outro isolate. O envelope HTTP 200 usado exclusivamente na Cache API interna é desfeito antes da resposta pública. Erros de cache não impedem a consulta ao coletor.

Voz paga, Telegram, população, TSE, administração e consultas com credenciais continuam fora desta camada. Tsunami conserva os dez segundos de cache recente. Não há novas gravações no KV ou nos Durable Objects nesta camada.

Verificação comparativa com Cache API indisponível: 100 requisições simultâneas e 100 sequenciais dentro do prazo original precisavam de 200 invocações no código anterior e uma no novo (99,5% de redução nesse cenário). Não é projeção do total diário. O cabeçalho `X-Monitor-Source-Edge` identifica `coordinator`, `joined`, `memory`, `edge` ou `bypass`, sem criar contadores ou gravações. A manutenção em modo `verify` faz três leituras públicas não pagas para conferir os cabeçalhos em produção.

Atualização de 18/10: o cron não pré-carrega clima/painel global sem demanda; caches complementares METAR/diagnóstico/modelos do tempo duram cinco minutos. Os intervalos de alertas urgentes ficam preservados. A limpeza de snapshots não agenda alarmes, inclusive ao executar um alarme legado. Consulte `durable-request-budget.md` para o cache de população e a auditoria diária.
