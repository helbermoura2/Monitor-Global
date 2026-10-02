# Efeitos no cartão principal

`js/cinematic-card.js` desenha uma atmosfera transparente atrás dos textos do cartão; `css/cinematic-card.css` integra essa camada com o vidro, os relâmpagos ramificados e o tremor existentes. Não altera fontes, seleção, prioridade, som, mapa ou câmera. A ilustração não é uma imagem observada do local nem uma simulação física de impacto.

- Tempestade: chuva com profundidades diferentes, gotas que acumulam massa, se juntam e escorrem pelo vidro; relâmpagos ramificados quando a descrição indica trovoadas.
- Ciclone: chuva oblíqua com rajadas variáveis, névoa em camadas e iluminação discreta. O símbolo gira discretamente; o nome do local fica estável.
- Tornado e vento: névoa lateral, partículas com movimento curvo ou horizontal.
- Incêndio: fumaça nas bordas, brasas com trajetórias diferentes, reflexos quentes e pequenas lentes de distorção de calor.
- Vulcão: cinzas e fumaça quando indicadas; calor e brasas somente com indicação textual de atividade eruptiva. Monitoramento sem erupção não recebe calor. Não há relâmpagos decorativos vulcânicos.
- Enchente: reflexos ondulados na base, sem inferir nível ou altura da água.
- Tsunami: recuo e avanço ilustrativos com transparência e espuma, sem inferir chegada, altura ou velocidade real.
- Sismo: impulso inicial seguido de tremor residual, com partículas discretas e iluminação que diminui. O semicírculo de magnitude permanece intacto.

A atmosfera permanece enquanto o evento estiver selecionado no cartão. O impulso do sismo termina após cerca de sete segundos. As cenas entram e saem gradualmente ao trocar de evento. Uma troca de evento pode manter uma única imagem residual por 400 ms; a cena anterior, seus filtros e seu observador são descartados. A revisão silenciosa preserva a cena; mudanças de atividade eruptiva ajustam suas camadas, retirando calor e brasas quando a erupção termina. O boletim do CGE mantém sua apresentação textual.

O desenho usa até 30 quadros por segundo no computador e 24 no celular, com menos partículas e resolução limitada no celular. O tamanho acompanha a expansão do cartão. O verso e o cartão recolhido deixam de desenhar; uma aba oculta pausa o ciclo. `prefers-reduced-motion` desativa a atmosfera animada e interrompe também as gotas, o giro e o vento sobre as letras. As camadas ignoram cliques e ficam fora da árvore de acessibilidade.

Verificação: `tests/cinematic-card.spec.js` cobre os nove tipos no computador e celular, atualização silenciosa, áreas de toque, expansão, troca e limpeza de camadas, boletins, indicação eruptiva e movimento reduzido. `tests/storm-lightning.spec.js` mantém a verificação dos canais de descarga e da ausência de relâmpagos em um aviso de chuva simples.

A regressão de duração verifica todos os tipos atmosféricos após 20 segundos, incluindo pixels efetivamente desenhados no computador e no celular. O cartão não perde suas camadas ao fim da antiga janela de entrada.

## Cenas e texturas da área visual

`js/card-cinema-film.js` compõe nuvens, vórtice, funil, terreno vulcânico, fogo e água com WebGL. A área do medidor recebe a cena mais visível; as bordas têm intensidade menor. O símbolo dos eventos atmosféricos foi substituído por traços vetoriais discretos. O número de magnitude do sismo é preservado.

Vídeos de textura licenciados, identificados como “ILUSTRAÇÃO”, acrescentam chuva, nuvens, chamas, fumaça, ondulações e ondas costeiras. Não são filmagens do evento. As fontes e licenças estão em `media/card-fx/README.md`. Os clipes são locais, sem áudio, H.264, 480 × 270 e 20 quadros/s. Somente um vídeo fica ativo; troca, verso, recolhimento e aba oculta liberam ou pausam o decodificador. Erro de carregamento ou bloqueio de reprodução mantém a cena gráfica. Vulcão em monitoramento usa terreno e nuvens, sem representar uma erupção inexistente.

WebGL tem resolução limitada a 240 px de largura no computador e 176 px no celular, até 20/14 quadros por segundo respectivamente; partículas usam 30/24. A ausência de WebGL conserva as camadas 2D. Movimento reduzido desativa todas essas cenas e vídeos. Os testes também verificam avanço de reprodução, pausa no verso, troca, vídeo sem som e falha de carregamento.
