# Rotação automática

A câmera e o cartão alternam dois sismos e um evento de outro tipo. Revisitam cada registro por 30 segundos após o voo, mantendo os tempos próprios de eventos novos/ao vivo e de seleções manuais. As filas persistem entre chegadas, revisões, cliques e reagendamentos: a interrupção usa a apresentação normal, mas não consome nem reinicia o slot da rotação. Ao fim da exibição, o ciclo retoma o próximo slot.

Os sismos usam todo o catálogo disponível, sem limite de 50. Cada ID entra numa fila embaralhada e passa uma vez antes de uma nova rodada. Nos demais eventos, primeiro se sorteia uma categoria (furacão/tufão, incêndio, enchente, vento, vulcão etc.) e depois um registro dessa categoria, também com filas sem reposição. Categorias com muitos registros não abafam as raras. IDs novos entram nas filas existentes; os removidos saem, e os dados são resolvidos na base atual.

Fisher–Yates e inserção aleatória usam `crypto.getRandomValues` com rejeição de amostras enviesadas, com `Math.random` como reserva. Evita-se repetir imediatamente o evento em tela e a última categoria não sísmica quando existem alternativas. Se faltam sismos ou outros eventos, usa-se o grupo disponível; uma base vazia aguarda sem consumir slots.

Chegadas novas continuam precedendo a rotação. Uma revisão pendente pode interromper, mas o próximo slot é retomado antes de outra revisão, para que uma fila grande não monopolize a tela. Novas chegadas ainda têm prioridade, com prioridade sísmica por magnitude e proteção de eventos ao vivo/manuais. O ciclo não interrompe um voo. A proteção das exibições reais permanece; a simples existência de sismos no catálogo não impede a terceira vaga de mostrar outro tipo.

Entram eventos ativos e condições atuais de vento/tempestade modeladas, com seus rótulos de previsão preservados. Avisos oficiais sem ponto também têm vez no cartão, sem voo nem epicentro inventado. Réguas de rios, boletins e registros expirados/futuros conservam acesso manual. A primeira fonte sísmica com dados já inicia a exibição, enquanto as agências mais lentas continuam sendo consultadas; a inicialização começa em DOMContentLoaded, sem esperar o carregamento completo da página. Somente dados novos ou revisados usam os fluxos de interrupção; uma atualização silenciosa do cartão não reinicia o ciclo.

Verificação: `tests/unit/auto-cycle.test.cjs` cobre proporção, 80 sismos sem repetição, categorias raras, continuidade, renovação da base, espera/proteção, reservas e entropia. `tests/auto-cycle.spec.js` confere seleção real, câmera/cartão, chegada nova, permanência protegida e retomada no computador e celular.

### Replay sísmico no ciclo automático

Eventos revisitados pelo aleatório exibem `Replay automático` e o tempo simulado em segundos. A reprodução começa três segundos depois da chegada vertical da onda P à superfície, calculada na tabela iasp91 do GlobalQuake para a profundidade do evento. Isso evita uma espera sem círculos nos sismos profundos. Depois, o relógio avança a 1×: cada raio é calculado pelo mesmo modelo, sem multiplicador de velocidade. A câmera acompanha P; o ciclo mantém os 30 segundos após o voo inicial e não recebe proteção até o fim das ondas. Eventos novos continuam usando o horário publicado e podem interromper o replay. Cliques manuais continuam reproduzindo desde t=0.
