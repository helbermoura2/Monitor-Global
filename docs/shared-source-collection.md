# Coleta compartilhada de fontes públicas

## Arquitetura

O navegador consulta primeiro o Worker para os feeds públicos selecionados. Uma
camada curta de Cache API atende repetições no mesmo datacenter. Quando ela não
tem o resultado, um Durable Object existente, nomeado por fonte/produto, serializa
a coleta. Visitantes de datacenters distintos reutilizam o mesmo resultado.
O cron de São Paulo e dos feeds globais usa esse mesmo caminho; o agregador global
reutiliza os coletores de NHC, GDACS, EONET, NWS e boletins de tsunami.

Isso resolve duas limitações anteriores: promessas em memória e Cache API isolavam
apenas o processo/datacenter, e cada navegador tentava a fonte diretamente antes
do proxy. A rota `/global-feeds` também apontava para um handler ausente; agora
retorna o agregado e seu risco calculado.

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
| Open-Meteo e CPTEC | 120 s | 600 s |
| METAR | 120 s | 300 s |
| Vulcões e ciclones normalizados | 120 s | 600 s |
| São Paulo | 300 s | 900 s |
| Agregado global | 120 s | 300 s |

Os limites contam desde a coleta válida, e não desde a última falha. Resposta
retida conserva seu horário e informa estado `stale`. Após o limite responde 503,
sem apresentar um catálogo vazio como se não houvesse eventos. Avisos mantêm seus
próprios vencimentos e regras de cancelamento; não há previsão de tsunami gerada.

Falhas usam espera progressiva de 30, 60, 120, 240 e até 300 segundos, compartilhada
por fonte e preservada após reinício. `Retry-After` do provedor é respeitado até
uma hora. Erros de parâmetro 4xx, exceto 429, não abrem o circuito para outros
usuários. Uma resposta 200 com erro/GeoJSON inválido não substitui o último dado
válido. Um catálogo oficial vazio, mas válido, é aceito normalmente.

O navegador não contorna uma espera explícita do coletor com novas tentativas
diretas. Se o transporte até o Worker falhar, ainda pode usar o caminho direto.
Produtos não selecionados conservam seu fluxo. Voz paga, imagens, enriquecimento
populacional, operações do Telegram, buscas de lugares e TSE não entram neste cache.
O TSE continua consultado a cada 30 segundos. URLs com credenciais não são armazenadas.

## Armazenamento e saúde

Não há operações KV nesse cache. Cada coletor mantém até 16 variantes, até 3 MiB
por resultado e 12 MiB no total, em fragmentos de 60 kB. Transações preservam a
consistência. O estado recente fica em memória e é salvo em checkpoints a cada 15 minutos; a limpeza ocorre nas consultas, sem novos alarmes recorrentes. Após reinício pode haver nova consulta ao provedor, sempre respeitando o horário original dos dados restaurados. Falhas de checkpoint não derrubam os feeds; o circuito de falhas recebe persistência prioritária para evitar tempestade de tentativas após reinício. Corpos idênticos reutilizam os
fragmentos existentes. Durable Objects e Worker continuam tendo cotas próprias:
a economia de consultas externas não significa recursos ilimitados ou custo zero.

`GET /source-health?page=0` exige `X-Admin-Token`. Consulta no máximo 20 coletores
por página, sem retornar URLs, coordenadas, textos dos eventos ou credenciais.
A aba **Saúde do serviço**, no acesso administrativo existente, mostra estado,
última coleta válida, última tentativa e próxima tentativa permitida. Exibe também
contadores observados e link para os relatórios da conta. Esses contadores não são
uma fatura e não incluem atendimentos que ficaram apenas no cache de borda.

O envio de contadores detalhados de atividade foi desativado: cada lote criava uma chamada adicional e uma gravação em Durable Objects. Os contadores de operações KV reais continuam sendo enviados, sem amostragem intencional, mas com entrega de melhor esforço. Valores de atividade anteriores à mudança são históricos, não consumo atual. As métricas agregadas da Cloudflare continuam sendo a referência para solicitações e linhas SQL.

## Publicação e validação

A manutenção manual verifica o checksum do pacote e exige o marcador
`sharedSources: {version: shared-sources-v1, enabled: true}` em produção, além dos
marcadores anteriores e `durableRequestBudget: durable-request-budget-v1`. O workflow executa os testes de concorrência, falha,
retenção, isolamento e persistência antes do upload. Preserva bindings, segredos,
cron e histórico de versões para reversão.

Testes novos: 30 visitantes/origens com uma chamada externa; cache após reinício;
espera compartilhada entre consultas; recuperação; expiração sem falso vazio;
consulta histórica/regional isolada; rejeição de dados inválidos; tamanho limitado;
reuso da borda e de fragmentos; privacidade do painel; prioridade do proxy no
cliente; preservação de idade e estado; acesso administrativo em 390 e 1280 px.
Serviços externos são simulados nesses testes. A implantação usa somente consultas
públicas de leitura para sua conferência; não envia mensagens ou sintetiza áudio.
