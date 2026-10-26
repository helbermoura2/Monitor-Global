# TV 1.0.11 — abertura com varredura vermelha

Referência visual: vídeo enviado pelo proprietário em 26/10/2026, em que um bloco vermelho atravessa a faixa da esquerda para a direita e revela o conteúdo atrás dele. A adaptação usa a identidade do Monitor Global: painel azul escuro, tipografia existente, radar animado, título e rodapé.

A abertura dura 700 ms, com aceleração/desaceleração suave. Um bloco vermelho com leve gradiente percorre a largura; o conteúdo real da tarja é desenhado somente na área já revelada. O recorte acompanha os cantos arredondados. O tamanho e a posição finais permanecem os mesmos. A saída suave de 300 ms, a transição interna a cada oito segundos e o resumo de seis segundos por item continuam independentes da abertura.

O efeito é um desenho nativo Android em `BannerRevealLayout`: sem incluir o vídeo de referência no APK, sem imagens de cada frame ou carregamentos externos. Caminho, matriz, tinta e gradiente são reutilizados; não há criação de objetos Java a cada frame nesse recorte. A substituição da faixa ou o encerramento do serviço cancela a animação e remove o listener. Com animações desativadas no sistema, o conteúdo aparece diretamente.

Aplica-se a avisos reais, demonstrações, replay e resumos. A duração total continua configurada como antes; a abertura ocupa seu início. O agendamento automático de meia-noite e a recuperação do dia encerrado da versão 1.0.10 permanecem disponíveis.

Validação: compilação release, lint e testes JVM do aplicativo. Publicação assinada pelo canal oficial. A comparação visual com a referência e a fluidez na TCL/Fire Stick reais serão avaliadas pelo proprietário após instalar, usando **Testar sismo** ou a sequência demonstrativa.
