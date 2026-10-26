# TV 1.0.12 — seis segundos de leitura e saída com varredura

O resumo anterior incluía abertura e transições nos 30 segundos totais. O quinto sismo começava a aparecer aos 24 segundos, completava sua transição 650 ms depois e começava a desaparecer antes de completar seis segundos de leitura estável. A criação da tela também iniciava o relógio antes do primeiro frame.

Agora cada sismo fica **seis segundos totalmente visível**, com as animações contadas separadamente: abertura de 700 ms, quatro trocas de 650 ms e saída de 700 ms. Cinco sismos somam 30 segundos de leitura e aproximadamente **34 segundos de tarja**. Sem animações do sistema, são 30 segundos. Com menos registros, são seis segundos de leitura por item, mais as animações correspondentes.

O relógio e o prazo da faixa começam no primeiro frame preparado para exibição. O resumo automático só confirma a entrega pelo callback de conclusão da faixa, após a saída; cancelamento, troca por alerta real ou fechamento não invocam esse callback. A exibição manual também usa a conclusão real para liberar sua fila. Um callback antigo não pode encerrar uma solicitação local mais recente.

A saída repete o bloco vermelho da entrada em sentido inverso: ele atravessa da direita para a esquerda e recolhe a faixa. Dura os mesmos 700 ms e usa a mesma curva de aceleração/desaceleração. Desenho, tamanho e posição final continuam os mesmos. O temporizador de remoção garante limpeza mesmo sem novos frames, e as animações/listeners são cancelados ao interromper.

Os alertas individuais continuam usando a duração configurada, com a saída incluída nesse prazo. O resumo tem seu tempo próprio de leitura e transições.

Validação: testes de cada intervalo estável, das quatro transições, dos seis segundos do quinto item, abertura fora da leitura, modo sem animação, resumo de um item e duração total. Compilação/lint Android e testes existentes de estado, replay e resumo automático. Publicação oficial assinada; confirmação visual da nova saída na TCL/Fire Stick pelo proprietário após atualizar.
