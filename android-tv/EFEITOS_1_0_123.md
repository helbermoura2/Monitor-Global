# Efeitos nativos das tarjas — 1.0.123 / Issue #745

O menu **Efeitos visuais das tarjas** alterna entre Completo (padrão), Suave e Sem efeitos, persistidos no aparelho. Reduzir animações no Android/Fire TV tem precedência. A abertura M6+ e os dois modelos Brasil conservam controles independentes.

O controlador recebe estado de apresentação. Não altera Alert, feed, prioridades, som, replay, duração ou horários. Os layouts e dados continuam nas views existentes.

| Categoria | Apresentação |
|---|---|
| M6+ | Abertura nativa do vídeo 2 em Completo; entrada curta em Suave; tarja imediata em Sem efeitos. Mantidas as exclusões de replay, revisão, Brasil, regional, resumo e tsunami associado. |
| Brasil | Faixa/manchete com deslocamento curto e fade em dois níveis; rodapé suave; pulso apenas no epicentro válido em Completo. Dois modelos preservados. |
| Regional | Passagem única de traço sísmico na borda, fora dos textos; realce suave dos dados. Mantidos os 15 s. |
| Tsunami | Pulso horizontal sóbrio; mapa e orientação disponíveis desde a entrada. |
| Tempo | Fade dos valores e passagem fria na borda; transição da imagem no mapa existente. |
| Chuva | Varredura curta; gotas apenas com precipitação atual válida; brilho único apenas com condição de temporal confirmada. Atmosfera opcional anterior limitada a Completo. |
| Mercado | Fade dos valores reais e linha de passagem única, sem interpolar preços nem criar indicadores desconhecidos. |
| Resumo | Mesmas páginas, totais e cronologia; apenas a curva de fade entre páginas é suavizada. Constantes do BannerTimeline preservadas. |
| Satélite | Fade de 400 ms (Completo) ou 200 ms (Suave) após chegar um Frame válido; fonte, captura e idade permanecem legíveis. |
| Voz | Confirmação curta na própria tarja, sem card novo. |

Replays usam no máximo Suave. Sem efeitos elimina wipes, fades, deslocamentos, pulsos e movimento do logo/ticker. Atualizações normais de relógio, dados e páginas continuam funcionando, nos slots originais.

**Testar todos os efeitos** oferece dez simulações sequenciais, silenciosas e identificadas. O botão de cancelamento, desligar a tela e avisos prioritários cancelam tarefas pendentes. A sequência não alimenta a fila real nem o histórico. Não cria imagem de satélite fictícia quando a fonte está indisponível.

O contêiner calcula as 180 unidades do Brasil separadamente das 126 unidades mais mapa das demais tarjas. Logo, fontes, gradientes, máscaras e mapa do estado são reaproveitados; o mapa estático é liberado ao destacar a view. Os efeitos não têm threads, downloads ou timers próprios. RuntimeDiagnostics também mede as tarjas informativas e Brasil.

## Validação e provas

- Regressões Python, testes Java de fila/confiança/cronologia/tsunami, builds, lint e testes unitários.
- Robolectric nativo: persistência, redução de movimento, replay suave, controle independente M6+, cancelamento e geometria Brasil superior/inferior nos dois modelos.
- Comparação de pixels do conteúdo após as transições em todos os modos.
- Capturas das dez categorias no primeiro segundo, meio e saída em FULL/SOFT/OFF, mais redução de movimento e controle M6+, no artefato `monitor-global-tv-banner-review` vinculado ao PR.

As provas usam dados fictícios identificados. Os testes de satélite verificam separadamente os pixels recebidos e a fonte real. Robolectric não mede FPS em TV física; desempenho e instalação no Android TV/Fire TV devem também ser acompanhados pelo diagnóstico local do aparelho.
