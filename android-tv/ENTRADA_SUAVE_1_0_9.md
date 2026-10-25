# TV 1.0.9 — entrada e saída suaves da tarja

A tarja inteira aparece enquanto sobe 12 dp, com desaceleração ao longo de 450 ms. Ao terminar, desce os mesmos 12 dp e desaparece em 300 ms. O radar, rodapé e transições internas continuam independentes.

A janela recebe margem transparente para o deslocamento. A faixa termina com a mesma largura, altura visual de 126 dp e afastamento de 32 dp, tanto na posição inferior quanto superior. Permanece sem capturar o controle remoto. O tempo configurado continua sendo a duração total: a saída ocupa os últimos 300 ms, sem prolongar os avisos ou o resumo.

Uma nova faixa cancela as animações da anterior. A conclusão de uma saída antiga verifica a identidade da faixa antes de removê-la, evitando fechar um alerta substituto. A remoção também tem um prazo por temporizador, para não depender de frames de animação com a tela apagada. Ao encerrar o serviço, a remoção é imediata e as animações são canceladas. Se o aparelho desativar animações, a faixa aparece e encerra diretamente.

Validação: compilação, lint e testes JVM de estado, replay e duração. Publicação oficial assinada. Para avaliar o efeito na TV real, atualizar pelo aplicativo e usar um dos botões de teste; a confirmação visual no aparelho fica com o proprietário.
