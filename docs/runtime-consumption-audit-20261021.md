# Auditoria inicial: sessão móvel, Durable/KV e contexto dos dados

## Consumo medido

Consulta somente de leitura em 20/10/2026 às 23:56 UTC (20:56 BRT), workflows [Durable](https://github.com/helbermoura2/Monitor-Global/actions/runs/39518183393) e [KV](https://github.com/helbermoura2/Monitor-Global/actions/runs/39518186337). Não foram invocados objetos, testes de alertas ou envios de Telegram.

| Período UTC | Durable: solicitações | População | KV: leituras | KV: gravações registradas |
| --- | ---: | ---: | ---: | ---: |
| 19/10 completo | 2.877 | 1.922 | 46 | nenhuma |
| 20/10 até 23:56 | 2.737 | 1.688 | 82 | nenhuma |

As solicitações de 20/10 representam 2,737% da cota diária de 100 mil citada na conta. A população representa 61,7% das solicitações desse período. O dia 19 completo confirma consumo abaixo da meta de 35 mil configurada no monitor; o dia 20 ainda era parcial na consulta. A janela recente de dez minutos teve 21 solicitações, equivalentes a 3.024/dia **se aquela taxa permanecesse**: projeção, não total medido nem garantia.

Houve 71 registros `clientDisconnected` em 20/10, contra 44 no dia anterior. Não houve `scriptThrewException` nas linhas diárias retornadas. As causas das desconexões não foram confirmadas: a API de telemetria detalhada recusou acesso com HTTP 403. Não atribuir todas a abas fechadas; há chamadas internas e alarmes também. Não foram medidos custos totais, linhas SQLite lidas/escritas, memória GPU ou armazenamento total. Analytics pode ter atraso ou amostragem; números ausentes não devem ser tratados como cota zero.

## Ciclo de cartões e efeitos

Instrumento: `tools/mobile-session-audit.cjs`, executado localmente com Chromium, viewport 390×844, DPR 3 e CPU desacelerada 4×. Seis categorias fixas (sismo, vulcão, tempestade, incêndio, enchente, vento), aquecimento de seis seleções e 30 trocas medidas com dois segundos por seleção. Janela medida de aproximadamente 69 segundos. Amostras após coleta de lixo; sem produção, mensagens ou voz externa.

| Medida | Início aquecido | Após 30 trocas |
| --- | ---: | ---: |
| Heap JavaScript principal | 23,05 MiB | 23,77 MiB |
| Elementos DOM conectados | 1.444 | 1.444 |
| Ouvintes de eventos (CDP) | 423 | 420 |
| Canvases | 2 | 2 |
| Vídeos / camadas de cinema após descarte | 0 / 0 | 0 / 0 |
| Marcadores | 5 | 5 |

A estrutura não se acumulou nesse cenário. O heap cresceu cerca de 0,72 MiB e subiu nas amostras intermediárias: não há base para afirmar que estabilizou ou que não existe vazamento. Também não há base para extrapolar linearmente esse aumento para horas ou consumo total de RAM.

Limitações importantes: a câmera é reposicionada sem voo; pedidos externos são bloqueados; o teste impede criação de camadas raster, mantendo o restante do mapa. Houve exceções internas do MapLibre quando rasters sem textura foram tentados nas primeiras execuções offline. O instrumento passou a isolar os rasters; a execução registrada não teve `pageerror`. Isso não demonstra uma correção no renderizador de produção. O trabalho mede o ciclo de descarte dos cartões/efeitos, não a fluidez do mapa completo, duração de bateria, aparelho físico ou horas de uso. As tentativas bloqueadas da simulação não são consumo real de APIs ou Durable.

Próxima medição necessária: sessão prolongada com dados representativos, imagens reais e aparelho físico, observando se o crescimento de heap converge e se as texturas/memória gráfica também são liberadas. Não remover recursos ou anunciar ganhos de desempenho com esta amostra curta.

## Item 6: local da explicação

A proposta concreta está em `data-context-proposal.md`. Usa selos por medida no cartão e as seções existentes “Fonte e método” (população) e “Fontes e evidências” (Detalhes). Distingue estimativa do app, estimativa publicada por agência e relato de percepção. Essa auditoria não altera a interface de produção.

## Reproduzir

Com servidor estático na porta 4173:

```sh
node tools/mobile-session-audit.cjs
AUDIT_CYCLES=120 AUDIT_DWELL_MS=2000 node tools/mobile-session-audit.cjs
```

Dados sem identificadores de conta/objetos: `mobile-performance-data/20261021-consumption.json` e `mobile-performance-data/20261021-session.json`.
