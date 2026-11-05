# TV 1.0.50 — faixa inferior de chuva

Implementa a opção 2 aprovada: faixa baixa no canto inferior direito, com ícone, divisor ciano, fundo azul-marinho, cantos arredondados e rodapé discreto. Mostra chegada ou condição atual, intensidade qualitativa, duração/janela estimada e acumulado dos próximos 60 minutos. A fonte e o horário da consulta permanecem no rodapé. Dados indisponíveis continuam explícitos.

Os avisos de chuva e suas demonstrações usam essa faixa. O boletim de temperatura mantém o card meteorológico, mesmo quando há previsão de chuva, incluindo o resumo de precipitação. O efeito opcional de chuva em tela inteira permanece controlado pela opção existente; a faixa fica no rodapé também sobre esse efeito. Não acrescenta relâmpagos nem trovões.

A duração de 12 segundos, a deduplicação, a confirmação somente após exibição completa, a retomada após interrupção e os limites de consulta seguem os controladores existentes.

Testes Android/Skia verificam posição e janela que não captura o controle remoto, leitura sem corte em 540p/720p/1080p, previsão futura, chuva atual, fim não estimado, períodos com pausas e ausência de valores. A CI exporta imagens da implementação real para revisão.
