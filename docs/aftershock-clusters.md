# Agrupamento de possíveis réplicas

A sequência selecionada continua sendo uma associação estimada do catálogo em até 72 horas. O agrupamento visual não altera essa classificação, a seleção, os alertas, a prioridade ou a rotação.

O sismo principal permanece em um marcador separado. Abaixo do zoom 9, os eventos associados próximos (escala Mercator, raio de 64 pixels e zoom em passos de 0,5) formam bolhas com a contagem de **todos** os seus membros. O evento selecionado permanece individual. Ao aproximar, as bolhas se dividem; no zoom 9 ou superior os marcadores ficam individuais. Mantém o limite de 41 rótulos, com pontos comuns para os eventos que não recebem rótulo. O mapa não cria centenas de elementos novos para calcular a contagem.

Um clique na bolha aproxima manualmente o grupo, considerando os painéis, sem selecionar outro sismo. Novas chegadas aparecem na bolha por 10 segundos e revisões não repetem o destaque. O agrupamento usa somente a sequência existente e não faz consultas adicionais. Movimentos sem mudança de nível de zoom reutilizam os marcadores. A visualização costeira do tsunami esconde os grupos; trocar para um evento fora da sequência remove as bolhas e restaura os pontos comuns.

`tests/unit/aftershock-cluster-model.test.cjs` verifica contagem, seleção, ordem determinística, divisão e passagem pelo meridiano de 180°. `tests/aftershock-sequence.spec.js` verifica desktop/celular, clique, limite de marcadores, novas chegadas, revisões, tsunami e limpeza.
