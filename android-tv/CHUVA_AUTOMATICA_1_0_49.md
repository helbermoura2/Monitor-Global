# TV 1.0.49 — avisos automáticos de chuva

Um card interrompido por um aviso prioritário era marcado como entregue logo ao abrir a janela. A deduplicação podia impedir que a mesma condição de chuva fosse apresentada novamente, mesmo quando a exibição havia sido cortada.

O registro de entrega agora ocorre somente ao completar o card. Uma interrupção cancela esse registro e mantém o aviso elegível para outra tentativa quando a TV estiver livre, usando uma previsão ainda válida. Verificações durante o próprio card não reiniciam sua duração. O cache, a cadência de consultas, os limites da fonte, as horas cheias de temperatura e as prioridades sísmicas permanecem.

A tela inicial informa o horário do último aviso automático de chuva concluído, separadamente da apresentação manual. A atualização descarta uma única vez as confirmações antigas de chuva, feitas pelo protocolo anterior, para reavaliar a condição atual sem alterar as preferências do usuário.

Testes nativos cobrem o serviço automático entre horas, interrupção, retomada sem nova consulta à fonte e confirmação apenas após a apresentação completa. Esta versão não acrescenta raios nem trovões.
