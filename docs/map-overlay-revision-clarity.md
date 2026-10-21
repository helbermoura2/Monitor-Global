# Organização do mapa e motivos de atualização

O coordenador `js/map-overlay-layout.js` compartilha a área livre entre as legendas de ondas, intensidade, tsunami e relatos. Considera cabeçalho, resumo selecionado e colunas visíveis; posiciona os indicadores em sequência e as legendas inferiores sem offsets independentes. Em tela estreita ou com o cartão móvel expandido, integra essas informações ao cartão. As legendas conservam os controles e usam details/summary para recolher conteúdo quando falta espaço. Avisos gerais também entram no cartão se a faixa entre colunas tiver menos de 280 px; durante o giro ficam fora da frente oculta.

Não acompanha cada movimento da câmera nem faz polling: reagenda em mudanças de tamanho, inserção/remoção dos elementos relevantes, abertura de painéis e mudança de orientação. Não observa texto alterado a cada quadro da animação. Não muda seleção, prioridades, duração dos cartões, fontes, chamadas de rede ou efeitos.

`js/record-update-context.js` descreve alterações já detectadas. Nomeia os campos revisados e preserva valores brutos: magnitude/profundidade, vento/pressão, níveis e atividade vulcânica. A linha do registro diferencia o horário original do evento do horário em que a revisão foi recebida. Se a fonte não detalha a alteração, isso é dito explicitamente, sem inventar um novo fenômeno. Um episódio vulcânico novo mostra o motivo reportado. Não muda a detecção de revisões, consolidação de redes ou o envio pelo Telegram.

Os modelos de hub de possíveis réplicas enviados na conversa são propostas visuais, sem alteração no agrupamento ou introdução de linhas no mapa. A associação existente continua estimada; linhas futuras não representam falhas ou propagação de energia.

Validação local: `tests/map-overlay-layout.spec.js` cobre 1280×900, 1024×720 com faixa central reduzida, 390×844 e 844×390; testa legendas, controles, retorno ao mapa e descrições de revisão. Testes existentes cobrem o giro, contexto dos dados e expiração dos registros. As fontes externas são bloqueadas ou simuladas.
