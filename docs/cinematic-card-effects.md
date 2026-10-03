# Efeitos no cartão principal

`js/cinematic-card.js` desenha uma atmosfera transparente atrás dos textos do cartão; `css/cinematic-card.css` integra essa camada com o vidro, os relâmpagos ramificados e o tremor existentes. Não altera fontes, seleção, prioridade, som, mapa ou câmera. A ilustração não é uma imagem observada do local nem uma simulação física de impacto.

- Tempestade: chuva com profundidades diferentes, gotas que acumulam massa, se juntam e escorrem pelo vidro; relâmpagos ramificados quando a descrição indica trovoadas.
- Ciclone: nuvens com relevo, sombras e bandas espirais irregulares; furacão e tufão têm olho profundo, enquanto tempestades e depressões tropicais conservam o centro coberto. Chuva em dois planos, névoa arrastada e gotas que se juntam e escorrem pelo vidro seguem rajadas de intensidade variável. O vidro, o título, os horários, a categoria e as demais métricas reagem ao mesmo campo de vento, com molas amortecidas. A intensidade acompanha o vento informado; a rotação das nuvens respeita o hemisfério.
- Tornado e vento: névoa lateral, partículas com movimento curvo ou horizontal.
- Incêndio: chamas, fumaça e reflexos quentes por todo o cartão; brasas com trajetórias diferentes e pequenas lentes de distorção de calor.
- Vulcão: cinzas e fumaça quando indicadas; calor e brasas somente com indicação textual de atividade eruptiva. Monitoramento sem erupção não recebe calor. Não há relâmpagos decorativos vulcânicos.
- Enchente: textura de água e reflexos ondulados por todo o cartão, sem inferir nível ou altura da água.
- Tsunami: recuo e avanço ilustrativos com transparência e espuma, sem inferir chegada, altura ou velocidade real.
- Sismo: impulso inicial seguido de tremor residual, com partículas discretas e iluminação que diminui. O semicírculo de magnitude permanece intacto.

A atmosfera permanece enquanto o evento estiver selecionado no cartão. O impulso do sismo termina após cerca de sete segundos. As cenas entram e saem gradualmente ao trocar de evento. Uma troca de evento pode manter uma única imagem residual por 400 ms; a cena anterior, seus filtros e seu observador são descartados. A revisão silenciosa preserva a cena; mudanças de atividade eruptiva ajustam suas camadas, retirando calor e brasas quando a erupção termina. O boletim do CGE mantém sua apresentação textual.

O desenho usa até 30 quadros por segundo no computador e 24 no celular, com menos partículas e resolução limitada no celular. O tamanho acompanha a expansão do cartão. O verso e o cartão recolhido deixam de desenhar; uma aba oculta pausa o ciclo. `prefers-reduced-motion` desativa a atmosfera animada e interrompe também as gotas, o giro e o vento sobre as letras. As camadas ignoram cliques e ficam fora da árvore de acessibilidade.

Verificação: `tests/cinematic-card.spec.js` cobre os nove tipos no computador e celular, atualização silenciosa, áreas de toque, expansão, troca e limpeza de camadas, boletins, indicação eruptiva e movimento reduzido. A regressão de cobertura compara os limites do vídeo e do canvas com todo o cartão e mede pixels no centro dos terços superior, intermediário e inferior; efeitos restritos ao medidor ou às bordas não passam. Também verifica texto claro, o botão de foco livre de sobreposições, redimensionamento entre cartão aberto e compacto, pausa no verso, recolhimento e aba oculta, além da liberação do vídeo anterior na troca. `tests/storm-lightning.spec.js` mantém a verificação dos canais de descarga e da ausência de relâmpagos em um aviso de chuva simples.

A regressão de duração verifica todos os tipos atmosféricos após 20 segundos, incluindo pixels efetivamente desenhados no computador e no celular. O cartão não perde suas camadas ao fim da antiga janela de entrada.

## Cenas e texturas em todo o cartão

`js/card-cinema-film.js` compõe nuvens, vórtice, funil, terreno vulcânico, fogo e água com WebGL. A cena, os vídeos e as partículas cobrem toda a frente visível do cartão, inclusive acima e abaixo do medidor. O fundo acompanha o tamanho do cartão ao expandir ou recolher; a cobertura permanece sobre o painel ao rolar suas informações. Uma camada escura de leitura e fundos nas áreas de dados preservam o contraste do texto. As camadas visuais ficam atrás das informações e ignoram cliques. O símbolo dos eventos atmosféricos foi substituído por traços vetoriais discretos. O número de magnitude do sismo é preservado.

Vídeos de textura licenciados, identificados como “ILUSTRAÇÃO”, acrescentam chuva, nuvens, chamas, fumaça, ondulações e ondas costeiras. Não são filmagens do evento. As fontes e licenças estão em `media/card-fx/README.md`. Os clipes são locais, sem áudio, H.264, 360 × 640 e 20 quadros/s. O vídeo usa enquadramento que preenche toda a frente do cartão, sem recorte de transparência em uma faixa do medidor. Somente um vídeo fica ativo; troca, verso, recolhimento e aba oculta liberam ou pausam o decodificador. Erro de carregamento ou bloqueio de reprodução mantém a cena gráfica por toda a área. Vulcão em monitoramento usa terreno e nuvens, sem representar uma erupção inexistente.

WebGL tem resolução limitada a 240 px de largura no computador e 176 px no celular, até 20/14 quadros por segundo respectivamente; partículas usam 30/24. A ausência de WebGL conserva as camadas 2D. Movimento reduzido desativa todas essas cenas e vídeos. Os testes também verificam avanço de reprodução, pausa no verso, troca, vídeo sem som e falha de carregamento.

Para ciclones, a resolução do WebGL fica limitada a 320 × 640 no computador e 224 × 448 no celular, com os mesmos limites de quadros. A classificação prioriza os campos dos feeds (`classification`, categoria, `cycloneType`, `cycloneLabel` e `displayLabel`), incluindo TD/TS/STS/HU/TY e “T. Tropical”; quando faltam, usa o vento disponível (menos de 63 km/h: depressão; de 63 a 118: tempestade tropical). Menções históricas na descrição não substituem uma classificação explícita. Não há raios decorativos em ciclones.

Furacões e tufões acrescentam a textura local de uma fotografia real da NASA do olho do furacão Isabel, com movimento lento, discreta advecção e transição para as nuvens procedurais nas bordas. É uma ilustração genérica, identificada como “ILUSTRAÇÃO”, e não uma imagem do evento selecionado. O arquivo de 67 KB é carregado somente no estágio maduro; tempestades e depressões tropicais não recebem essa imagem com olho. Falha de carregamento mantém a renderização procedural. Troca, parada e movimento reduzido cancelam a carga pendente e liberam a textura de GPU.

A tipografia do ciclone envolve os grafemas existentes, preservando espaços, emojis e elementos de formatação, sem acrescentar cópias de texto. As palavras conservam quebras de linha, inclusive nomes longos com hífen ou barra. Revisões silenciosas reconstroem só os trechos atualizados e conservam a cena quando o estágio não muda. Parar, trocar de evento e ativar movimento reduzido restauram o texto atual, removem os observadores e limpam as propriedades do vento. `tests/cyclone-cinema.spec.js` verifica essas transições, a classificação, a renderização do olho, os hemisférios e o movimento de chuva, vidro e letras no computador e no celular.


## Materiais cinematográficos e demonstrações

A lava usa uma filmagem de escoamento real do USGS, com crosta escura e material incandescente; quando o vídeo falha, o shader desenha crosta e fissuras advectadas lentamente. Apenas menções positivas a lava/atividade efusiva ativam esse material. Erupção com cinzas sem menção a lava conserva fumaça e cinzas; “sem lava” não ativa lava, e “sem cinzas” não desliga uma erupção efusiva. Monitoramento usa paisagem fotográfica sem calor. Revisões que encerram erupção ou escoamento retiram as camadas correspondentes.

Enchente usa correnteza barrenta real em todo o cartão. A reserva desenha água turva com normais, reflexos especulares, espuma e advecção; a camada de partículas acrescenta pequenos detritos imersos e espuma fragmentada. Ciclones usam chuva e rajadas fotográficas com nuvens em rotação; tempestade, fogo, tornado, tsunami e vento ganham textura, iluminação e movimento próprios, sem acrescentar chuva a vento isolado ou lava ao monitoramento.

Menu → Testar efeitos permite comparar todos os tipos, inclusive três estados vulcânicos, ou entrar na demonstração de sismos. A demonstração usa somente camadas visuais sobre os dados atuais, com identificação externa, Parar/Trocar e duração de 20 s. Não insere registros, move a câmera, altera prioridade/rotação ou produz áudio. Um evento real interrompe a demonstração, e parar restaura a atmosfera do registro selecionado.

Os créditos completos estão em `media/card-fx/credits.html`, acessível no teste. Vídeos são locais e sem áudio; somente um decodificador fica ativo. Testes adicionais cobrem lava/cinzas/monitoramento, materiais sem vídeo, demonstrações isoladas e tremor de M5.9 no cartão, incluindo o aleatório.

O tornado combina filmagem licenciada de Ray Bohac com poeira advectada e turbulência. O fogo preserva o detalhe fotográfico das chamas, com reflexo quente variável e fumaça menos opaca. Em tempestades, os canais ramificados são renovados a cada ciclo de descarga, sem gerar novas animações em uma revisão silenciosa.
