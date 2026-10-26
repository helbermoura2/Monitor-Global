# Monitor Global TV 1.0.13 — regras sísmicas alinhadas ao Telegram

## Cobertura

| Situação | Aplicativo |
| --- | --- |
| Novo sismo global | USGS, M6 ou maior |
| Novo sismo no Brasil | USP/RSBR, USGS, EMSC e GEOFON, sem corte mínimo de magnitude |
| Fronteira brasileira | Mesma malha IBGE e mesmos parsers usados pelo Telegram; países vizinhos ficam fora |
| Publicação brasileira atrasada | Janela de 72 horas, preservando horário de origem e identificando a publicação recém-observada |
| Primeira consulta de cada catálogo | Referência silenciosa, inclusive quando uma fonte se recupera pela primeira vez |
| Revisões | Magnitude acumulada de 0,3, passagem por M6/M7 ou qualquer mudança de magnitude ainda em M6+; alterações de outros dados também podem atualizar a faixa |
| Queda abaixo do corte | IDs USGS já acompanhados continuam sendo consultados por até 72 horas, mesmo abaixo de M5,5 |
| Redes diferentes | Associação conservadora: 30 s, 20 km e 0,6 no Brasil; 50 km e 1,0 global; identidade e versões observadas conservadas para evitar alternância entre soluções repetidas |
| Réplicas | IDs diferentes da mesma rede não são agrupados só por proximidade; associação ambígua permanece separada |
| Tsunami | Mesmos boletins/modelo regional oficiais: ameaça, SEM AMEAÇA e encerramento explícito; ausência ou falha não equivale a cancelamento |
| Boletim repetido | Apenas mudar a hora de publicação não faz uma situação regional idêntica disparar novamente |
| Resumo | Até cinco maiores magnitudes do dia BRT, USGS a partir de M0,1 e catálogos brasileiros; seis segundos completos por item e animações independentes |
| Replay de sismo | Último evento elegível global M6+ **ou brasileiro** em até 72 h, incluindo período com TV desligada; fallback local sem internet |

O aplicativo segue independente da entrega no Telegram. Não lê mensagens, tokens ou chat IDs; nenhuma mensagem de teste é enviada ao canal. A TV mostra faixas temporárias e o Telegram mantém/edita mensagens, portanto os dois meios não têm apresentação ou latência idênticas. O Telegram agrupa avisos de magnitude por seu cron; o aplicativo compara os dados a cada consulta. Não se promete notificação enquanto o aparelho estiver desligado.

## Estado visível

A configuração identifica USGS global, USGS Brasil, USP, EMSC, GEOFON e boletins de tsunami indisponíveis. Exibe a idade da última consulta confirmada. Um catálogo indisponível não impede os outros de emitir avisos e não inicializa sua referência silenciosa.

## Recursos e custos

- Snapshot HTTP/ETag compartilhado por 30 s; consultas concorrentes compartilham trabalho.
- Catálogos brasileiros reutilizados por dois minutos; não há uma consulta por fonte para cada TV.
- Lista limitada a 120 ocorrências/72 h, até 12 aliases por ocorrência; estado Android limitado a 256 registros.
- A lista de acompanhamento usa cache e uma chave KV `tv-seismic-watch-v1`, restaurada uma vez por inicialização do coletor. Só grava quando o conteúdo muda, no máximo uma gravação por minuto por instância; não grava a cada consulta de uma TV. A replicação do KV é eventual, não um coordenador de entrega global.
- Nenhum novo Durable Object para o feed. O contexto opcional de população já existente pode consultar os serviços compartilhados conforme os caches anteriores.
- Falha de armazenamento ou indisponibilidade de fonte não autoriza inventar dados. Redes externas ainda podem atrasar, revisar ou omitir registros.

## Validação

Testes de catálogo: atraso brasileiro, fronteira, ausência de corte mínimo, associação entre redes, prioridade da solução revisada, ausência de alternância, revisão abaixo do corte, cache, persistência após reinicialização e supressão de boletins idênticos.

Testes Android: referência por catálogo, falhas independentes, revisão acumulada e abaixo de M6, aliases e resumo salvo com magnitude pequena. Mantidos os testes de animação, resumo, replay, assinatura e distribuição. A chegada real e a apresentação física seguem dependendo da TV/Fire Stick e suas permissões.
