# Imagens sísmicas e boletins de tsunami

O PNG do Telegram usa o mesmo ponto de ancoragem no bbox Esri EPSG:4326 e no marcador. A escala deriva do bbox e da largura exportada. A imagem destaca a região central do tremor, com o modelo GlobalQuake Gen2 existente aplicado sobre terras Natural Earth; o oceano não recebe pintura de intensidade terrestre. Cores são estimativas, sem confirmação de danos.

A exposição populacional usa o serviço `/population-exposure` do projeto: PAGER primeiro e WorldPop como alternativa. As faixas III+, V+ e VI+ são cumulativas; não devem ser somadas nem interpretadas como contagem de vítimas ou relatos. Um dado indisponível não vira zero. O envio inicial aguarda a consulta por até 2,5 segundos. O Durable Object mantém a consulta pendente em `waitUntil`. Resultados pendentes podem atualizar a mesma foto durante 20 minutos; fotos confirmadas das últimas 24 horas migram uma vez, três por ciclo. Nenhum novo aviso de magnitude é criado por uma atualização de população. Revisões de magnitude usam as coordenadas/profundidade/magnitude atualizadas.

Telegram e Story sísmico usam a mesma composição `js/quake-card-layout.js` e a mesma pintura terrestre por faixas `js/quake-image-paint.js`. O mapa ocupa os primeiros 820/1440 pixels, com epicentro em y=550, satélite Esri e nomes/fronteiras acima da pintura. A parte inferior tem fundo próprio, semicírculo pequeno, magnitude, local, data/fonte, três estatísticas e um quadro de exposição populacional. Não há radar, P/S, cidades próximas ou mecanismo focal nessa composição. Story exporta 1080×1920; Telegram 800×1440. A exportação não altera a câmera do mapa principal.

## Tsunami

A coleta internacional roda a cada 30 segundos, pausada com a página oculta pelo scheduler. O Worker mantém cache por 20 segundos e consulta Atom PTWC/NTWC mais os produtos oficiais PTWC WEPA40/WEPA42 (Pacífico) e WECA41/WECA43 (Caribe). O Atom geral pode mostrar uma declaração para Samoa enquanto o WEPA40 contém ameaça para Panamá/Equador; os produtos são independentes.

Produtos `.js` são lidos somente com JSON.parse da atribuição de dados. Nunca são executados. Informação, cancelamento, Warning, Watch, Advisory e ameaça prevista em metros recebem categorias distintas. Os itens guardam as áreas/categorias publicadas, link do boletim e coordenadas fornecidas pela fonte. A atualização de uma fonte não elimina outra fonte com falha. A limpeza doméstica NWS remove apenas seus próprios itens. Produtos acima de 72 horas não entram na rotação.

Um chip informa a categoria de maior gravidade e permite abrir o boletim. Avisos entram na fila de eventos novos; sismos M5+ continuam protegidos. Boletins informativos não disparam efeito de tsunami nem ondas ilustrativas. A correlação automática exige epicentros próximos em vez de associar qualquer aviso global a qualquer sismo.

## Verificação

Fixtures oficiais de 09/10/2026 reproduzem a diferença entre Atom informativo e WEPA40 com ameaça de 1–3 metros no Panamá. Testes cobrem coordenadas, escala, terra/oceano/lacunas, falhas parciais, categorias, população, edição da mesma foto e comportamento no navegador. Toda entrega Telegram nos testes é simulada; prévias locais não enviam mensagens.

Quando tsunami.gov estiver inacessível ao Worker, a coleta usa a API oficial NWS `/products/types/TSU` e `/products/types/TIB`, consultando somente a revisão mais recente por centro/código WMO (até 12 produtos recentes). O texto de avaliação determina ameaça/cancelamento; o aviso internacional “information only” dirigido às autoridades não neutraliza uma ameaça prevista para a costa. Links apontam para o produto oficial.

A câmera retorna ao alcance III+ do modelo, destacando a região colorida principal; a pintura I+ completa permanece no mapa. Alternância azul 6s / região 8s e quadro final 10s continuam. Replays automáticos M5,5+ mostram a pintura completa sem reiniciar P/S e sem ampliar o limite de 40s; eventos menores mantêm o radar.

A composição cartográfica v4 aplica o visual aprovado da prévia M6.6 aos dois geradores de produção. As faixas discretas do modelo são mascaradas por terras Natural Earth, com lacunas/ilhas e longitude envolvida. A máscara limita os índices de cada scanline à imagem; polígonos fora do enquadramento não pintam o oceano. População pendente/indisponível é explícita e não usa soma de cidades como substituição. Fotos confirmadas recentes migram para v4 por edição da mesma mensagem, preservando população já conhecida se a consulta temporariamente não retornar dados.

O clique manual em boletins (chip, registro, teclado ou marcador) não herda o estado de rotação. Ao abrir tsunami, cancela a câmera, o retorno antigo, o ciclo pendente e a ativação tardia de ondas/radar do sismo anterior. Sem coordenadas, abre uma visão mundial explícita, sem inventar epicentro. Com coordenadas, mostra a origem sísmica publicada. Informativos também apresentam resumo e acesso ao boletim oficial. Os filtros secundários ficam em “Mais filtros”, com contagem de filtros ativos; no celular, a gaveta é acessada pelo Menu → Filtros de eventos.

### Atualização horária de ciclones e vulcões
Furacões, tufões, depressões e demais sistemas tropicais usam o ciclo de uma hora nas consultas GDACS/NHC e no reforço NASA EONET. A consulta inicial continua no carregamento. O resumo NHC do cabeçalho também limita a consulta automática de ciclones a uma hora, mantendo os outros dados climáticos no intervalo anterior.

O catálogo vulcânico completo é atualizado de hora em hora. Uma consulta separada, a cada minuto com a página ativa, examina os boletins GDACS, USGS/VONA e VAAC/GVP e aplica somente atividade eruptiva nova, lava, cinzas, explosões ou elevação de alerta. Atualizações comuns e encerramentos ficam para o ciclo completo; uma consulta urgente nunca apaga registros ausentes. Explosões reportadas em boletins novos podem ganhar prioridade mesmo em um vulcão já em erupção; reconfirmações não repetem o alerta. A apresentação respeita a prioridade existente de sismos M5+. A detecção depende da publicação e disponibilidade da fonte, não representa detecção instantânea da explosão física.
