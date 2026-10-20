# Visita automática a um mapa oficial novo

Durante o aleatório, uma nova versão do ShakeMap de um sismo M5,5+ nas últimas 72 horas entra em uma fila própria. A câmera faz a viagem normal, aproxima o epicentro, abre para a área pintada em quatro segundos e mantém esse quadro por vinte segundos. Depois retoma a rotação de nove posições descrita em `auto-cycle.md`, sem consumir um slot dessa sequência durante a visita especial.

Sismos novos e atividade vulcânica urgente têm prioridade. A visita oficial usa modo automático, não cria um sismo “NOVO”, não toca alarme e pode ser interrompida por uma chegada real de qualquer magnitude. Uma seleção manual ou uma apresentação ao vivo impede a entrada da visita oficial; o produto fica aguardando. Prévia, apresentação de tsunami e painel eleitoral também são respeitados.

A descoberta consulta um sismo por vez, com intervalo de 15 segundos entre sondagens. Um evento sem produto é verificado novamente após pelo menos um minuto; um produto disponível, após cinco minutos. A aba oculta pausa consultas e tentativas de foco. Primeiro resultado já disponível ao carregar o catálogo serve de referência silenciosa, evitando uma sequência de mapas antigos no recarregamento. Produto que chega após uma resposta indisponível e versão oficial nova geram uma visita.

São mantidos no máximo 64 estados de consulta, 8 visitas pendentes e o cache compartilhado existente de 4 produtos. A requisição de descoberta possui canal separado do produto em primeiro plano; uma mudança de câmera não cancela consultas de outros eventos. A fila descarta registros removidos, vencidos, rebaixados de magnitude ou cujos parâmetros físicos foram alterados. Grades sem intensidade III+ não geram visita especial. A pintura e o aviso continuam sujeitos à disponibilidade de uma área em terra na resolução suportada.

Verificação: `tests/official-map-priority.spec.js`, `tests/official-shakemap.spec.js`, `tests/balanced-world-transitions.spec.js`, `tests/seismic-paint-tour.spec.js` e `tests/unit/rupture-shaking-client.test.cjs`.
