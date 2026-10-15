# Globo terrestre

A versão plana anterior está preservada no Git em `backup/mapa-plano-20261015` (commit `4038b00`). A referência foi enviada ao repositório remoto antes das alterações.

O globo é a visualização padrão no desktop e no celular. A projeção já consta no estilo inicial do MapLibre, evitando uma troca visível do plano para o globo ao carregar. A inicialização enquadra o planeta no espaço disponível antes da primeira apresentação de eventos. O céu e os controles são ativados no mesmo momento.

O menu **Globo e mapa plano** permite escolher a projeção na mesma instância. A escolha explícita fica salva neste navegador em `mg-map-projection`; sem preferência válida, usa o globo. Se o armazenamento estiver indisponível, a navegação continua funcionando. No globo, o controle **Voltar ao mapa plano** permanece disponível. **Ver planeta** abre o zoom como uma ação manual; não impede a entrada prioritária de eventos novos.

A troca usa `map.setProjection` do MapLibre 5.13 na mesma instância. Não recria fontes, polígonos, marcadores, eventos ou cartões. A atmosfera é removida ao voltar, restaurando a configuração anterior. A câmera não muda apenas por trocar a projeção; o usuário pode abrir o zoom com o controle separado. O cache do enquadramento sísmico inclui a projeção.

Os marcadores HTML continuam posicionados pelo MapLibre. Nesta versão, o motor marca marcadores cobertos pela esfera com opacidade 0,2; o CSS do teste os oculta para não mostrar pins através da Terra. A etiqueta de consulta também usa a opção nativa de oclusão. Não há construções ou relevo 3D acrescentados.

Testes: abertura automática em globo, alternância pelos menus, persistência das duas escolhas ao recarregar, mesma instância/fontes/dados, projeção dos pins inclusive em latitude alta, ocultação do hemisfério oposto, arrasto nativo de mouse/toque, grade oficial histórica do USGS e polígonos de tsunami. As capturas locais podem usar o tile global da Esri em resolução baixa apenas como fundo de teste; a produção mantém suas fontes de satélite existentes.

## Enquadramento e céu

O afastamento usa o campo de visão nativo e o espaço livre entre cabeçalho, lista, cartão e controles. A esfera preenche esse espaço com margem, em vez de usar um zoom fixo distante. A mesma regra é usada no afastamento entre eventos; o mapa plano conserva sua regra anterior.

`GlobeSpace` desenha estrelas decorativas e os nove astros (Sol, Lua, Mercúrio, Vênus, Marte, Júpiter, Saturno, Urano e Netuno) em canvas sem capturar gestos. As direções geocêntricas são calculadas localmente por **Astronomy Engine 2.1.19**, de Don Cross, licença MIT preservada no arquivo `vendor/astronomy-engine-2.1.19.min.js` (projeto: https://github.com/cosinekitty/astronomy). A biblioteca só é carregada ao entrar no globo. Não há novas consultas a APIs ou operações no KV.

O instante é `Date.now()`, o mesmo relógio civil que alimenta o cabeçalho em BRT; não se subtraem três horas dos cálculos UTC. Vetores geocêntricos J2000 são transformados para o equador/equinócio da data e girados pelo tempo sideral para acompanhar a orientação terrestre. A Lua usa a fração iluminada calculada. As direções são astronômicas, mas a casca de projeção, os tamanhos e as distâncias na imagem são ilustrativos: não é uma observação telescópica ou uma maquete em escala do Sistema Solar. Astros atrás da Terra, fora da tela ou encobertos pelos painéis não são reposicionados artificialmente. As estrelas não representam um catálogo observado.

A área da Terra e os painéis ficam transparentes no canvas celeste, preservando mapas, pinturas, pins e leitura dos dados. O céu desaparece ao aproximar ou inclinar a câmera e é removido ao retornar ao plano. Atualiza no máximo cerca de 22 vezes por segundo durante movimento e uma vez por segundo em repouso; as efemérides são recalculadas uma vez por minuto. Em aba oculta não desenha. O DPR é limitado a 1,5.

Referências dos testes independentes: equações solares NOAA (https://gml.noaa.gov/grad/solcalc/calcdetails.html), Lua cheia no eclipse de 21/01/2019 e Lua nova no eclipse solar de 08/04/2024. Os testes verificam também a geometria de enquadramento contra a projeção real do MapLibre no desktop/celular, relógio, remoção da camada celeste, arrasto e preservação das camadas oficiais e de tsunami.

### Conferência da Lua na captura de 15/10/2026

Às 02:31 BRT (05:31 UTC), o ponto sublunar calculado é aproximadamente 27,39° S / 145,90° E, na Austrália, com cerca de 20% da Lua iluminada. Para São Paulo (23,55° S / 46,63° O), a Lua está aproximadamente 38° abaixo do horizonte. A presença da Lua depende da fase e da geometria orbital; noite local não implica Lua acima do horizonte. O teste unitário conserva esse instante para detectar inversões de longitude ou aplicação indevida do fuso horário.
