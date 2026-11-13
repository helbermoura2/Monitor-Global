# TV 1.0.80 · avisos sonoros distintos

Oito sinais locais: sismo, tsunami ativo, boletim/encerramento de tsunami, sismo regional, chuva, boletim do tempo, Brent/dólar e resumo diário. PCM mono com envelopes suaves, duração abaixo de 2 segundos, sem arquivo remoto nem dependência dos bipes do aparelho.

Usa volume de mídia da TV e foco transitório com possibilidade de reduzir temporariamente o vídeo. Não altera volume global, mute ou Não Perturbe. Intensidade do aplicativo começa em 85%, com controle de 0–100% e interruptor independente por categoria. O interruptor geral de som existente é preservado. Configurar e ouvir os sons permite testar cada categoria com o controle remoto.

Som apenas quando o aviso é exibido (ou notificação sísmica alternativa), sem repetir nas consultas de dados. Replays e tsunami sem ameaça permanecem silenciosos. Avisos prioritários interrompem sons de menor prioridade; uma prévia não interrompe aviso real. Tela desligada, parada do monitoramento e perda de foco cancelam a reprodução. Falhas de áudio são informadas no teste e não impedem a tarja.

Testes verificam sinais distintos, amplitude/energia, duração, silêncio, seleção por categoria, preferências e controles do painel. A audição física depende do volume/saída de áudio da TV e deve ser conferida pelo botão Ouvir no aparelho.

## Correção 1.0.82 — áudio não inicializa na TV

Uma TV/Fire TV pode rejeitar `AudioTrack.MODE_STATIC` com taxa de 24 kHz mono mesmo que o áudio normal de aplicativos funcione. O som dos avisos agora prepara `AudioTrack.MODE_STREAM`, priorizando PCM estéreo a 48 kHz, com tentativas alternativas a 48 kHz mono, 44,1 kHz estéreo/mono e 24 kHz mono. Nenhuma preparação ou escrita de quadros bloqueia a interface. Os oito sinais são gerados em cada configuração com as mesmas melodias, envelopes, duração e limite de ganho.

Se a TV recusar todas as rotas PCM, um `ToneGenerator` usa **o volume de mídia** para um sinal alternativo genérico claramente identificado no resultado do botão OUVIR. Se até isso falhar, a tela informa a indisponibilidade real para diagnóstico; **não afirma que o som tocou**. A falha não interfere nos avisos visuais.

O teste de áudio agora observa o estado de forma assíncrona até o fechamento da janela, sem buscar uma mensagem possivelmente antiga após somente 250 ms. A reprodução continua com prioridade, cancelamento por alertas mais graves, sem tocar replay, sem alterar volume geral e sem novas permissões. A saída física só pode ser confirmada na TV real; em TVs com saída digital configurada exclusivamente para bitstream/passthrough, pode ser necessário escolher PCM/estéreo nas configurações de áudio do equipamento.
