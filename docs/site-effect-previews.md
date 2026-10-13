# Cenas de tela inteira no menu

Menu → Testar efeitos tem quatro opções `Tela inteira`, todas com duração de dez segundos: lava incandescente, desabamento M8+, chuva intensa e onda de tsunami. São prévias ilustrativas; nenhum detector de eventos reais chama esse módulo.

Lava combina fragmentos irregulares, crosta, calor e movimento gravitacional. Chuva usa profundidades, gotas próximas ao vidro e respingos. O desabamento movimenta cabeçalho, mapa, cartão e coluna de registros, além de rachaduras e detritos. O tsunami atravessa a tela, desloca a interface e combina espuma procedural com a correnteza real já creditada em `media/card-fx/credits.html`. O cartão usa o renderizador existente e conserva os dados da seleção.

O módulo e o CSS são carregados somente ao escolher uma destas opções. Uma única cena pode ficar ativa, com resolução limitada a 1,25× no celular e 1,5× no desktop e desenho limitado a aproximadamente 25/30 quadros por segundo. Nenhum processamento visual continua após terminar. Parar, Escape, troca para evento real, aba oculta e saída da página removem o canvas, cancelam as animações e liberam o vídeo. Movimento reduzido desativa as cenas. Um token impede que um carregamento atrasado reabra uma prévia cancelada.

As animações dos elementos usam Web Animations, sem reescrever estilos, textos, eventos ou estado do mapa. A camada de desenho não recebe cliques; os controles de teste ficam acima dela. A duração começa depois que o módulo e os recursos opcionais do cartão carregam.

`tests/site-effect-demo.spec.js` verifica acesso pelo menu em desktop/mobile, conteúdo desenhado, preservação dos registros e câmera, controles acessíveis, limpeza em dez segundos, interrupção real, carregamento atrasado, resolução, movimento reduzido e aba oculta. As capturas são gravadas em `/tmp/site-scene-*.png`.
