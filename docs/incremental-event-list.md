# Lista de registros incremental

A lista mantém até 120 cartões no DOM. Cada atualização reaproveita os cartões por ID, remove apenas os que saíram do filtro/limite e move somente os que mudaram de posição. Os cabeçalhos de horário e o aviso de limite também são reutilizados. A rolagem e o foco de teclado são preservados quando o registro continua visível.

Cada cartão tem uma assinatura dos campos que afetam sua apresentação, incluindo fontes, magnitude, profundidade, aviso, validade, posição do usuário e classificação do ciclone. Polígonos e históricos grandes não entram nessa assinatura. Cartões inalterados não refazem a formatação de horário ou o HTML; a idade relativa é atualizada separadamente. Revisões são verificadas nos 120 cartões, substituindo a assinatura global antiga que examinava somente 40 e ignorava vários campos.

Os selos NOVO/ATUALIZADO/publicado com atraso mantêm um único temporizador por cartão. Alterar o prazo cancela o temporizador anterior; sair da lista também o cancela. Cliques e teclado nos cartões e nos botões de fontes usam os dados atuais de `lastMerged`, sem closures presas ao objeto antigo. Os boletins continuam separados da seleção do registro.

`tests/incremental-event-list.spec.js` verifica ausência de mutações em atualizações idênticas, revisão de um registro depois da posição 40, entrada de novos eventos, filtros, agrupamento, idade, foco, rolagem, boletins, fontes e expiração dos selos em desktop e celular.
