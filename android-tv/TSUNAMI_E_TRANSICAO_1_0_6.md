# Transição vertical e tsunami sem ameaça — 1.0.6

O conteúdo central alterna a cada oito segundos: a página atual sobe e perde opacidade, a próxima entra por baixo e ganha opacidade, com aceleração/desaceleração suave durante 650 ms. Marca/radar, Breaking News, rodapé, dimensões e seus efeitos existentes permanecem iguais. A animação respeita a preferência do Android; revisão de magnitude e alternância site/canal mantêm seus 360 ms anteriores.

O bloco reservado ao tsunami continua no mesmo lugar, mostrando TSUNAMI e SEM AMEAÇA em duas linhas, sobre o verde informativo já existente. As regiões continuam na manchete, a autoridade e horário continuam nos campos e o rodapé mantém contexto regional. Um aviso ativo para outra região prevalece na associação principal e não é convertido em ausência global de ameaça.

O feed permite nova informação de sem ameaça somente quando um boletim oficial recente/não retido tem associação precisa a um sismo M6+. Ausência de boletim, associação provável/ambígua e falha da fonte não viram “sem ameaça”. O texto/estado continua vinculado ao produto e às costas citadas. Um sismo já acompanhado que seja revisado para baixo mantém o fluxo de atualizações existente.

Uma atualização própria de “sem ameaça” não emite o tom; um novo sismo com boletim associado mantém o aviso sonoro do sismo, se ativado. Mudanças de ameaça para sem ameaça atualizam a faixa/último registro real e o replay; boletins sem mudança de situação/escopo não repetem o aviso só por terem horário novo. A primeira conexão continua criando referência sem anunciar o catálogo antigo.

O novo botão “Testar tsunami sem ameaça (dados fictícios)” demonstra a troca sem enviar dados para o serviço ou entrar no replay real. A sequência completa acrescenta esse caso após os exemplos anteriores. Instalar a versão assinada 1.0.6/10006 pelo botão de atualização oficial; não precisa desinstalar.

Validação: compilação/lint, sete testes de codec/replay, verificações Java de fila/associação/cronologia e proteções da distribuição, mais contratos do feed com fontes simuladas. A aparência sobre vídeo e a entrega no aparelho dependem do teste na TCL/Fire Stick; não houve envio real de Telegram nem acionamento remoto de teste na TV.
