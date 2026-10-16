# Histórico persistente e relatório diário do KV

Novos registros de alertas, prévias de resumos e o marcador de resumo enviado ficam
nos Durable Objects já existentes. Não criam novas gravações KV. O controle de
entrega continua transacional: uma tentativa com resultado ambíguo não é reenviada
automaticamente. Atualizações preservam o identificador da mensagem original.

O histórico antigo continua sendo consultado no KV, somente para leitura. A tela
mescla os registros antigos e novos, dando preferência ao novo para a mesma chave.
Se a leitura do arquivo antigo falhar, os novos registros continuam disponíveis e
a resposta indica `legacyUnavailable: true`, sem afirmar que o histórico está completo.
As rotas continuam exigindo o cabeçalho administrativo; as rotas internas não são
expostas pelo Worker público.

Textos e PNGs são fragmentados em blocos de 60 kB, com tamanho máximo de 6 MiB por
registro. Metadados e fragmentos são atualizados na mesma transação. O conteúdo
expira em até 31 dias, com limpeza por alarme; o marcador de resumo dura dois dias.
A limpeza não apaga o controle de entrega. Durable Objects têm limites próprios de
operações e armazenamento; essa mudança elimina gravações KV desses fluxos, não
torna todos os serviços ilimitados. O original em HD mantém sua retenção própria.
R2 não foi provisionado nem exige contratação nesta etapa.

## Relatório

Workflow `Daily KV health and feature usage`, manual ou diariamente às 03:25 UTC
(00:25 São Paulo). Publica um resumo no GitHub Actions e JSON em artefato por 30 dias.
Consulta o dia UTC anterior e o dia atual; não modifica Worker, dados KV ou cron do
Worker. Usa os segredos de manutenção existentes, que precisam permanecer válidos.

Os níveis são atenção a partir de 70%, alto em 85%, crítico em 95% e esgotado em
100%. São indicadores no relatório, não mensagens externas nem monitoramento em
tempo real. A quota gratuita adotada é de 100 mil leituras e mil gravações,
exclusões ou listagens por dia, separadamente. Há outras cotas nos demais serviços.
Analytics pode ter atraso/amostragem. Falhas de consulta não viram consumo zero.

O contador por função registra quando começou sua cobertura. Um dia só recebe
`observationWindowComplete: true` se já terminou e a cobertura começou antes dele.
Isso descreve a janela temporal: lotes de métricas são best-effort e não são fatura.
O primeiro dia completo após a ativação desse acompanhamento será o próximo dia
UTC, observado no relatório do dia seguinte. Não se extrapola um dia parcial.

## Testes

- `node --test tests/unit/telegram-history-storage.test.mjs`: persistência após
  reinício, fragmentos UTF-8 e binários, ausência de gravações KV, leitura antiga,
  falha explícita em corrupção, paginação, limpeza e rotas reais com KV indisponível.
- `node tests/unit/telegram-history-check.mjs`: fluxo real de resumo com todas as
  gravações KV bloqueadas, concorrência, prévia, reinício e supressão de duplicatas.
- Testes existentes de alertas brasileiros, revisões e resumos revisados continuam
  exercitando os envios com Telegram simulado; nenhum teste envia mensagens reais.
- `python -m unittest discover -s tests/unit -p test_kv_daily_report.py`: limites,
  soma por namespace e distinção entre janela completa, parcial e indisponível.
