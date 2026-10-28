# Clareza, serviços opcionais e saúde — 28/10/2026

## O que o usuário pode concluir

- Magnitude, profundidade e horários: valores publicados pela fonte, sujeitos a revisão. Não são confirmação de danos.
- Intensidade: MMI local; ShakeMap também combina medições e modelos. Publicado pelo USGS não significa medição em cada ponto. A estimativa do app é identificada separadamente.
- População: estimativa de exposição, inclusive PAGER. Não é contagem de vítimas. Sem dados não vira zero.
- Tsunami: situação oficial por costa/região e horário; informativo ou sem ameaça não encerra avisos em outras regiões. Contorno não é inundação.
- Animações: apresentação; não determinam severidade nem substituem o boletim.

O site já tinha explicações interativas em `js/data-context.js`, rótulos por valor e diagnóstico de fontes. Foram preservados; a magnitude ganhou explicação explícita de revisão. O layout compartilhado das imagens agora identifica também PAGER/ShakeMap como estimativas publicadas; o rodapé da TV explicita ESTIMATIVA na população. O formato, a câmera e a tarja aprovada permanecem iguais. Não há migração em massa de imagens antigas nem envio de mensagens para testar.

## Isolamento verificado e reforçado

| Caminho | Comportamento quando o opcional falha |
| --- | --- |
| Site: catálogos | Orquestrador usa `Promise.allSettled` e publica catálogo inicial antes dos provedores lentos. Saúde por fonte; uma falha não apaga outras. |
| Site: população | Reserva GeoNames/ausência explícita; falha não gera zero. Consulta/poll cancelados ao trocar de evento ou ocultar a aba. |
| TV: sismos e tsunami | Coleta independente com `allSettled`; estados das fontes separados. Falha de população não altera elegibilidade, versão ou classificação. |
| TV: contexto opcional | No Worker, usa `waitUntil` para concluir população/cidades fora da resposta oficial. Responde com ausência explícita ou contexto já em cache; próxima coleta pode usar o resultado. Exceção inesperada do enriquecimento preserva o snapshot oficial. |
| TV: imagem do mapa | Recurso opcional com reserva geográfica local e encerramento dos carregamentos ao fechar a tarja. |

Não foi criado modo que desligue automaticamente recursos por uma estimativa de cota. A coleta sísmica/tsunami, os horários de avisos, Telegram e câmera não foram reduzidos. O cache compartilhado segue limitado; não surgem escritas KV por clique.

## Saúde em português

O mesmo workflow de cotas, quatro vezes por dia, agora começa com leitura rápida: último dia completo disponível, Worker/Durable/escritas KV, principal família Durable, excessos de recursos e últimas Actions observadas. A leitura das Actions é só metadados, com permissão `actions: read`. O uptime considera somente execução agendada, não a verificação manual de Secrets. Não cria serviço, alerta externo, commit periódico ou chamadas aos endpoints do Worker para medir.

Uma execução verde não comprova entrega em todos os aparelhos. Dia antigo, consulta ausente e falta de minutos mensais de builds permanecem explícitos. O primeiro dia inteiro após a otimização de população continua sendo 28/10 UTC; não declarar economia causal antes de compará-lo.

## Publicação e reversão

Site: publicação estática e recarga. Worker: `npm run worker:bundle`, ZIP/checksum revisados e deploy pelo fluxo existente. Aplicativo instalado já lê os textos de contexto do serviço; estas mudanças não exigem novo APK. Reverter PR e republicar a parte correspondente. Ver [operação em uma página](OPERACAO_EM_UMA_PAGINA.md).

## Evidência da publicação

[PR 543](https://github.com/helbermoura2/Monitor-Global/pull/543), [deploy do Worker](https://github.com/helbermoura2/Monitor-Global/actions/runs/40615478295) e [primeiro relatório de saúde](https://github.com/helbermoura2/Monitor-Global/actions/runs/40615480958), concluídos. [Registro sanitizado](audits/four-priorities-20261028.json). Testes: 7 Playwright, 11 de cotas/saúde, 179 testes modulares e os verificadores de entrega do Worker, além de 11 verificações de manutenção.

A coleta às 01h30 UTC de 28/10 ainda aponta excesso de recursos: 24 registros no dia 27 e 9 no parcial de 28. Uma execução antiga do smoke test falhou em verificadores de visibilidade/materiais. Essas são pendências observadas, não falhas corrigidas por este PR. A causa dos excessos continua sem rota identificada.
