# Uso prolongado e espaço no celular — 22/10/2026

## Consultas

- Respostas 503 respeitam Retry-After também quando Next-Retry não existe; o backend agora expõe ambos nas respostas de indisponibilidade compartilhada. Erros 5xx sem prazo recebem pausa local curta. O cache guarda somente falhas, preservando a divisão por consulta e credenciais. A indisponibilidade do Overpass pausa o enriquecimento desse serviço, sem bloquear catálogos sísmicos.
- Sem configuração, WeatherAPI retorna indisponibilidade explícita com prazo, em vez de erro interno. A rotina brasileira interrompe as consultas individuais após a primeira falha de serviço e mantém a consulta em lote de reserva. Não é necessário comprar um serviço para eliminar tentativas inúteis.
- Catálogos regionais respeitam o bloqueio do SourceHealth antes do despacho; consultas suprimidas não contam como falhas adicionais nem consultas frescas. Repetidas falhas ampliam a pausa até 30 minutos. USGS e EMSC mantêm o despacho existente.
- A URL legada de impacto deixa de ter barra dupla. O enriquecimento legado de serviços próximos passa a ser consultado pelo botão, com cache e pausa após erro; não se reativa uma consulta automática defeituosa só porque a rota foi consertada.

## Apresentação móvel

O resumo superior ganha fechamento independente e expira em 30 segundos, ou 60 para M6+. Atualizações sem mudança de magnitude/profundidade não o reabrem. A lista completa continua acessível em Eventos.

A sequência de possíveis réplicas ocupa a mesma faixa abaixo do cabeçalho em retrato, substituindo temporariamente o resumo. Limite de 190px/26dvh, vidro neutro translúcido, fechar/recolher e rolagem interna com o movimento automático existente. O cartão principal permanece acessível no rodapé; abrir seus detalhes esconde a sequência. O clique Sequência não propaga para o acionador do painel, evitando reabertura imediata do painel principal. Desktop mantém o posicionamento lateral.

## Processamento e memória

O orçamento móvel/econômico reduz a reserva máxima de tiles por fonte de 192 para 96, e a retenção de níveis de três para dois. Atualizações simultâneas dos detalhes de evolução são agrupadas em um frame. Canvases próprios da cena e da transição liberam explicitamente seus buffers ao encerrar; economia elimina a cópia visual da cena anterior.

Isso não comprova solução para o crescimento observado no Nothing/S25. O ensaio offline com 120 seleções e coleta de lixo manteve nós/listeners estáveis, e heap de aproximadamente 21MiB. O ensaio isola câmera/tiles e não reproduz oito horas de dados reais. O diagnóstico versão 6 acrescenta contagens por componente, heap usado/total e categorias de rotas para o próximo teste identificar a retenção. Não se adicionam testes de rede, telemetria ou recarregamento automático.

Validação local: backoff por resposta, isolamento de consultas, reserva meteorológica, backend sem chave opcional, regressão de entrega Telegram com mocks, sequência/fechamento/expiração em desktop e celular, inspeção visual de retrato/paisagem, pausa e recuperação de catálogos, e medição do heap após seleção repetida. Sem testes funcionais em produção.
