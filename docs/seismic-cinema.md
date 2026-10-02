# Apresentação sísmica

`SeismicCinema` regula a força por MMI, com prioridade para um valor numérico da fonte/ShakeMap já disponível. A reserva usa a mesma equação hipocentral de Allen, Wald e Worden (2012) da exposição populacional, aplicada à região do epicentro. Profundidade zero/ausente adota 10 km. A estimativa não representa o local do visitante nem confirma danos. Dados oficiais recebidos depois ficam disponíveis para a próxima reprodução, sem novo susto na revisão silenciosa.

Chegadas novas e cliques manuais M6+ acionam a tela inteira: vibração irregular com ataque, impacto e dissipação, cópias de elementos com trajetória acelerada e rotação, poeira periférica e sombra gradual. M6 dura 10 s; M7 dura 13 s; M8 dura 16 s. A tela e as superfícies da interface se movem com fases distintas, a poeira tem volume nas bordas, pequenos fragmentos seguem a gravidade e as peças amortecem ao atingir a base da janela. A profundidade/intensidade regula amplitude e número de peças. Não há escurecimento piscante. Elementos reais, controles, câmera e áudio não são alterados pelos efeitos. Clones são inertes, sem IDs e fora da árvore acessível.

O ciclo automático usa apenas uma vibração curta do cartão (1,3 s), sem quedas nem movimento da tela. Abaixo de M6, o manual/novo também fica restrito ao cartão, com força/duração pela intensidade. Não se acumulam efeitos: troca de seleção, nova reprodução, aba oculta e preferência por movimento reduzido cancelam animação, camadas e timers.

Menu → **Testar efeitos sísmicos** abre uma demonstração temporária, em computador e celular. Permite comparar M2, M5.9, M6.1, M6.5, M7.5 e M8.2, quatro profundidades (incluindo 43 km para comparar com o vídeo) e o modo discreto. Um aviso externo identifica a demonstração e oferece Parar/Trocar. Não insere sismos, altera seleção ou rotação, emite alertas/voz nem move a câmera. A entrada pode ser retirada do Menu depois da avaliação.

Testes: `seismic-cinema.test.cjs` verifica modo, profundidade, equação e precedência da fonte; `seismic-cinema.spec.js` verifica renderização, limpeza, Menu, isolamento das demonstrações, revisão e movimento reduzido em computador/celular.
