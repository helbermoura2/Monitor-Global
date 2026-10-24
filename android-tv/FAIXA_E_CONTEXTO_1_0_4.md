# Faixa e contexto — TV 1.0.4

O tamanho da faixa permanece igual. Breaking News, magnitude e bloco Tsunami têm cantos arredondados. O rodapé passa de 32 para 40 unidades de desenho por segundo (+25%). Sob o nome Monitor Global, `monitorglobal.top` e o ícone vetorial do Telegram com `@monitor_global` alternam a cada oito segundos, com dissolução de 360 ms. A identidade não move nem reinicia o rodapé. Animações desativadas no Android continuam respeitadas; a identidade ainda alterna, sem movimento.

Demonstrações continuam explicitamente identificadas na manchete e no rodapé; substituir a antiga palavra TESTE da área de marca não transforma exemplo em notícia real. O replay mantém sua identificação e não toca som.

## População e cidades

Campos opcionais `populationSummary` e `nearbySummary` entram no feed, codec, cópia para revisões e registro local do último alerta. Feeds/registros antigos continuam compatíveis. O contexto não modifica a versão sísmica nem dispara uma nova notificação apenas por chegar uma estimativa.

Usa-se o mesmo serviço de exposição das imagens: USGS PAGER quando disponível, estimativa em grade WorldPop ou reserva GeoNames. População é identificada como estimativa de exposição ou soma parcial de localidades, nunca contagem de vítimas. Não inferir população atingida por tsunami a partir da exposição sísmica.

As cidades são referências USGS/GeoNames: até cinco, ordenadas pela distância ao epicentro entre as referências retornadas, deduplicadas. O serviço consulta localidades com ao menos dez mil habitantes em até 400 km; não é uma lista de todas as aldeias nem confirmação de danos. Se houver menos de cinco, mostrar quantas existem; sem dados, informar indisponibilidade.

O enriquecimento é opcional, com limite de espera de quatro segundos, até três sismos elegíveis mais recentes por snapshot compartilhado, cache de até 24 contextos por instância, validade de 30 minutos quando completo e nova tentativa após um minuto quando parcial. A API de exposição e de localidades possui seus próprios limites/timeouts. Consultas pendentes podem concluir em segundo plano quando o runtime oferece `waitUntil`; falha de contexto não muda saúde/classificação dos alertas nem cancela aviso de tsunami. Eventos além dos três mais recentes podem não ter contexto. Não há consulta separada de população por TV a cada poll.

Como o rodapé pode ficar longo, as opções de duração passam a 15/20/30/60/90/120 segundos. A configuração atual é preservada; textos completos podem exigir escolher uma duração maior ou usar replay. Não prometer que todo o texto de cinco cidades e boletins caberá em vinte segundos.

## Publicação e validação

APK 1.0.4, código 10004, no mesmo pacote e assinatura oficiais. Instalação depende da confirmação no aparelho pelo botão Verificar atualização oficial. Nenhum teste real de Telegram é necessário. Compilação, lint, codec/replay, associação/cancelamento e testes de contexto usam dados simulados; a aparência final e funcionamento sobre vídeo devem ser conferidos no Fire Stick.
