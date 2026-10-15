# Cenas de tela inteira no menu

Menu → Testar efeitos tem quatro opções `Tela inteira`, com duração de 10 segundos para lava/chuva, 24 para M8+ e 20 para tsunami: lava incandescente, desabamento M8+, chuva intensa e onda de tsunami. São prévias ilustrativas; nenhum detector de eventos reais chama esse módulo.

Lava combina fragmentos irregulares, crosta, calor e movimento gravitacional. Chuva usa profundidades, gotas próximas ao vidro, respingos e dois clarões isolados de relâmpago. O M8+ reutiliza o SeismicCinema existente de M7/M8 (tremor, poeira, detritos e apagões), com quedas mais lentas e blocos visíveis da coluna de registros derrubados em sequência. As opções adicionais só são aplicadas nesta prévia. O tsunami atravessa a tela, desloca a interface e usa água procedural com turbulência, iluminação e espuma, sem carregar vídeo. Fragmentos da interface flutuam com a corrente de entrada e a de retorno. O cartão usa o renderizador existente e conserva os dados da seleção.

O módulo e o CSS são carregados somente ao escolher uma destas opções. Uma única cena pode ficar ativa, com resolução limitada a 1,25× no celular e 1,5× no desktop e desenho limitado a aproximadamente 25/30 quadros por segundo. Nenhum processamento visual continua após terminar. Parar, Escape, troca para evento real, aba oculta e saída da página removem o canvas, cancelam as animações e restauram todos os fragmentos e originais. Movimento reduzido desativa as cenas. Um token impede que um carregamento atrasado reabra uma prévia cancelada.

As animações dos elementos usam Web Animations, sem reescrever estilos, textos, eventos ou estado do mapa. A camada de desenho não recebe cliques; os controles de teste ficam acima dela. A duração começa depois que o módulo e os recursos opcionais do cartão carregam.

`tests/site-effect-demo.spec.js` verifica acesso pelo menu em desktop/mobile, conteúdo desenhado, preservação dos registros e câmera, controles acessíveis, limpeza nos prazos de cada cena, interrupção real, carregamento atrasado, resolução, movimento reduzido e aba oculta. As capturas são gravadas em `/tmp/site-scene-*.png`.

A referência visual para o tsunami é a frente de inundação turbulenta e a corrente de retorno descritas pela NOAA: https://www.noaa.gov/jetstream/tsunamis/tsunami-inundation e https://www.noaa.gov/jetstream/tsunamis/tsunami-dangers. A duração é comprimida para o teste e não simula alcance, altura ou tempo de chegada de um aviso real.
