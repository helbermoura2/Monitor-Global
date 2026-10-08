# Rotação automática

A câmera e o cartão alternam dois sismos e um evento de outro tipo. Revisitam cada registro por 30 segundos após o voo, mantendo os tempos próprios de eventos novos/ao vivo e de seleções manuais. As filas persistem entre chegadas, revisões, cliques e reagendamentos: a interrupção usa a apresentação normal, mas não consome nem reinicia o slot da rotação. Ao fim da exibição, o ciclo retoma o próximo slot.

Os sismos usam todo o catálogo disponível, sem limite de 50. Cada ID entra numa fila embaralhada e passa uma vez antes de uma nova rodada. Nos demais eventos, primeiro se sorteia uma categoria (furacão/tufão, incêndio, enchente, vento, vulcão etc.) e depois um registro dessa categoria, também com filas sem reposição. Categorias com muitos registros não abafam as raras. IDs novos entram nas filas existentes; os removidos saem, e os dados são resolvidos na base atual.

Fisher–Yates e inserção aleatória usam `crypto.getRandomValues` com rejeição de amostras enviesadas, com `Math.random` como reserva. Evita-se repetir imediatamente o evento em tela e a última categoria não sísmica quando existem alternativas. Se faltam sismos ou outros eventos, usa-se o grupo disponível; uma base vazia aguarda sem consumir slots.

Chegadas novas continuam precedendo a rotação. Uma revisão pendente pode interromper, mas o próximo slot é retomado antes de outra revisão, para que uma fila grande não monopolize a tela. Novas chegadas ainda têm prioridade, com prioridade sísmica por magnitude e proteção de eventos ao vivo/manuais. O ciclo não interrompe um voo. A proteção das exibições reais permanece; a simples existência de sismos no catálogo não impede a terceira vaga de mostrar outro tipo.

Entram eventos ativos e condições atuais de vento/tempestade modeladas, com seus rótulos de previsão preservados. Avisos oficiais sem ponto também têm vez no cartão, sem voo nem epicentro inventado. Réguas de rios, boletins e registros expirados/futuros conservam acesso manual. A primeira fonte sísmica com dados já inicia a exibição, enquanto as agências mais lentas continuam sendo consultadas; a inicialização começa em DOMContentLoaded, sem esperar o carregamento completo da página. Somente dados novos ou revisados usam os fluxos de interrupção; uma atualização silenciosa do cartão não reinicia o ciclo.

Verificação: `tests/unit/auto-cycle.test.cjs` cobre proporção, 80 sismos sem repetição, categorias raras, continuidade, renovação da base, espera/proteção, reservas e entropia. `tests/auto-cycle.spec.js` confere seleção real, câmera/cartão, chegada nova, permanência protegida e retomada no computador e celular.

### Radar sísmico no ciclo automático

O aleatório mostra apenas o radar de alcance estimado: vermelho para a zona crítica, azul para a região onde o sismo pode ter sido sentido, com varredura no epicentro. O rótulo identifica essas áreas como estimativas, sem afirmar medições de relatos. Revisões atualizam as áreas sem reiniciar o ciclo. A rotação mantém 30 segundos após o voo, sem proteção longa, e eventos novos podem interrompê-la. As frentes físicas do GlobalQuake aparecem exclusivamente nos eventos novos (horário publicado) e nas seleções manuais (replay desde t=0), preservando a abertura e a pausa final de cinco segundos.
