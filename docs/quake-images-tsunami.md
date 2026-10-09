# Imagens sísmicas e boletins de tsunami

O PNG do Telegram usa o mesmo ponto de ancoragem no bbox Esri EPSG:4326 e no marcador. A escala deriva do bbox e da largura exportada. A imagem destaca a região central do tremor, com o modelo GlobalQuake Gen2 existente aplicado sobre terras Natural Earth; o oceano não recebe pintura de intensidade terrestre. Cores são estimativas, sem confirmação de danos.

A exposição populacional usa o serviço `/population-exposure` do projeto: PAGER primeiro e WorldPop como alternativa. As faixas III+, V+ e VI+ são cumulativas; não devem ser somadas nem interpretadas como contagem de vítimas ou relatos. Um dado indisponível não vira zero. O envio inicial aguarda a consulta por até 2,5 segundos. O Durable Object mantém a consulta pendente em `waitUntil`. Resultados pendentes podem atualizar a mesma foto durante 20 minutos; fotos confirmadas das últimas 24 horas migram uma vez, três por ciclo. Nenhum novo aviso de magnitude é criado por uma atualização de população. Revisões de magnitude usam as coordenadas/profundidade/magnitude atualizadas.

O Story prefere a mesma exposição em grade; quando usa a reserva por localidades, identifica a fonte e o raio. A pintura aproveita a geometria já calculada da cena, sem recriar o mapa ou interferir na câmera.

## Tsunami

A coleta internacional roda a cada 30 segundos, pausada com a página oculta pelo scheduler. O Worker mantém cache por 20 segundos e consulta Atom PTWC/NTWC mais os produtos oficiais PTWC WEPA40/WEPA42 (Pacífico) e WECA41/WECA43 (Caribe). O Atom geral pode mostrar uma declaração para Samoa enquanto o WEPA40 contém ameaça para Panamá/Equador; os produtos são independentes.

Produtos `.js` são lidos somente com JSON.parse da atribuição de dados. Nunca são executados. Informação, cancelamento, Warning, Watch, Advisory e ameaça prevista em metros recebem categorias distintas. Os itens guardam as áreas/categorias publicadas, link do boletim e coordenadas fornecidas pela fonte. A atualização de uma fonte não elimina outra fonte com falha. A limpeza doméstica NWS remove apenas seus próprios itens. Produtos acima de 72 horas não entram na rotação.

Um chip informa a categoria de maior gravidade e permite abrir o boletim. Avisos entram na fila de eventos novos; sismos M5+ continuam protegidos. Boletins informativos não disparam efeito de tsunami nem ondas ilustrativas. A correlação automática exige epicentros próximos em vez de associar qualquer aviso global a qualquer sismo.

## Verificação

Fixtures oficiais de 09/10/2026 reproduzem a diferença entre Atom informativo e WEPA40 com ameaça de 1–3 metros no Panamá. Testes cobrem coordenadas, escala, terra/oceano/lacunas, falhas parciais, categorias, população, edição da mesma foto e comportamento no navegador. Toda entrega Telegram nos testes é simulada; prévias locais não enviam mensagens.
