# Android TV 1.0.124 — abertura antes dos dados

A abertura é uma cena inicial da mesma janela da tarja. O nome do evento aparece primeiro; uma passagem horizontal revela o layout atual. As duas cenas ocupam regiões exclusivas do Canvas: não há tarja de dados sob a abertura, nem transparência entre textos.

Nomes: CHUVA, SISMO NO BRASIL, SISMO REGIONAL, TEMPERATURA, COTAÇÕES, SATÉLITE e BREAKING NEWS para o sismo global. O logo oficial animado e os endereços acompanham a abertura.

No modo completo, a abertura dura 2,3 segundos (3,35 segundos no sismo global M6 elegível), incluindo a passagem final de 650/750 ms. No modo suave dura 750 ms. Desligado não exibe abertura. O tempo total original de apresentação não aumenta. Slots curtos, boletins urgentes de tsunami, revisões, resumos e acompanhantes preservam seu comportamento prioritário. A chave independente da abertura global continua respeitada.

Os layouts normais, dados, ícones, mapas, ticker, fontes e logo oficial permanecem preservados. Não há segundo overlay, player de vídeo ou nova janela.

Validação local: 316 testes Java/Robolectric, 40 testes Python, assembleDebug/Release e lintDebug/Release aprovados. Os testes verificam nomes, término e cancelamento, prioridade, modos e pixels exclusivos durante a passagem; também exportam 45 quadros reais para cada uma das seis categorias de prévia. Não foi realizada instalação em TV física nesta etapa.
