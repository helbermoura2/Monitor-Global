# Rotação automática

A câmera e o cartão alternam dois sismos e um evento de outro tipo. As filas persistem entre chegadas, revisões, cliques e reagendamentos: a interrupção usa a apresentação normal, mas não consome nem reinicia o slot da rotação. Ao fim da exibição, o ciclo retoma o próximo slot.

Os sismos usam todo o catálogo disponível, sem limite de 50. Cada ID entra numa fila embaralhada e passa uma vez antes de uma nova rodada. Nos demais eventos, primeiro se sorteia uma categoria (furacão/tufão, incêndio, enchente, vento, vulcão etc.) e depois um registro dessa categoria, também com filas sem reposição. Categorias com muitos registros não abafam as raras. IDs novos entram nas filas existentes; os removidos saem, e os dados são resolvidos na base atual.

Fisher–Yates e inserção aleatória usam `crypto.getRandomValues` com rejeição de amostras enviesadas, com `Math.random` como reserva. Evita-se repetir imediatamente o evento em tela e a última categoria não sísmica quando existem alternativas. Se faltam sismos ou outros eventos, usa-se o grupo disponível; uma base vazia aguarda sem consumir slots.

Chegadas novas e revisões pendentes continuam precedendo a rotação, com prioridade sísmica por magnitude e proteção de eventos ao vivo/manuais. O ciclo não interrompe um voo. A proteção das exibições reais permanece; a simples existência de sismos no catálogo não impede a terceira vaga de mostrar outro tipo.

Só entram ocorrências ativas com coordenadas verificáveis. Previsões, vazão modelada, boletins, avisos sem ponto e registros expirados/futuros conservam seu acesso normal na lista e não disparam câmera aleatória. Somente dados novos ou revisados usam os fluxos de interrupção; uma atualização silenciosa do cartão não reinicia o ciclo.

Verificação: `tests/unit/auto-cycle.test.cjs` cobre proporção, 80 sismos sem repetição, categorias raras, continuidade, renovação da base, espera/proteção, reservas e entropia. `tests/auto-cycle.spec.js` confere seleção real, câmera/cartão, chegada nova, permanência protegida e retomada no computador e celular.
