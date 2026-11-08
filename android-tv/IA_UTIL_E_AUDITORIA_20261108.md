# Android TV — IA compreensível e auditoria de usabilidade (08/11/2026)

## Diagnóstico do código atual

- A chamada à IA **não é um chat**. `RainMonitor` usa `WeatherBriefingClient` para pedir `/weather-briefing?kind=hourly|rain` apenas durante apresentações meteorológicas relevantes; a consulta ocorre fora da thread de interface.
- O backend Cloudflare Workers AI usa Llama 3.1 8B FP8 apenas para **escolher IDs de interpretações previamente validadas** de dados meteorológicos da Liberdade/SP. Texto livre do modelo, coordenadas arbitrárias e novos números são rejeitados.
- O código atual do Worker na `main` já contém o modelo de interpretações `validated-insight-selection-v4`. O PR #603 ainda está aberto e tem conflito: não deve ser mesclado automaticamente sem reconciliar o que já entrou na `main`. Código no GitHub também não comprova o que está publicado no Worker.
- O bloco `RESUMO COM IA` só aparece quando a resposta está pronta e corresponde à previsão exata ainda válida. Ausência de fato útil, limite, falha do servidor, fonte expirada ou modelo lento deixam o cartão normal **sem bloco**. Assim, quem usa a TV não sabe o motivo nem consegue solicitar uma verificação na interface anterior.
- A `MainActivity` acumulava dezenas de controles e textos em uma lista sem seções. O replay M5+ só funciona se houver registro **real e elegível** salvo neste aparelho: não busca eventos históricos arbitrários.

## Primeira etapa implementada nesta branch

1. **Tela `IA meteorológica · entender e consultar agora`**, com acesso pelo controle remoto na parte superior da configuração. Explica o alcance e as limitações da IA sem chamá-la de previsão sísmica.
2. **Consulta manual, opt-in, tempo/chuva:** solicitação ao endpoint fixo, com timeout, limite de corpo 6 KB e até quatro observações da resposta `pending`. Não há polling automático adicional, novas permissões ou coleta de dados pessoais. A tela não imprime mensagens internas do provedor.
3. **Status legível** de `ready`, `pending`, `not_applicable`, `limited` e `unavailable`. Somente respostas `ready` com formato, modelo, área e validade verificados por `WeatherBriefing.parse` mostram a frase meteorológica. Não há alerta ou notificação novos.
4. **Último destaque em cache**, claramente rotulado como registro local, e nunca como previsão atual sem verificação da fonte.
5. **Seções na configuração:** início rápido, replay/resumos, M5+ regional, meteorologia/IA/satélite, chuva, preferências e funcionamento. Botões e regras anteriores permanecem nos mesmos modos de execução.
6. **Diagnóstico de replay M5+ no topo:** indica se existe evento regional real elegível persistido ou se o aparelho ainda não possui registro, sem inventar disponibilidade.

## Segurança e limites

- Alerta de sismos, tsunami, Telegram, mapas, Worker de alertas, região monitorada, fila de prioridade, intervalo de consulta e som **não foram alterados**.
- As consultas manuais podem consumir a franquia compartilhada de Workers AI; isso é explicado na tela, e somente acontece após OK do usuário.
- O texto não é gerado livremente pelo modelo no Android TV. Não há envio de texto da pessoa, microfone, localização GPS ou dados privados.
- A nova `WeatherAiInfoActivity` não é exportada no AndroidManifest e não solicita permissões extras.
- Falhas nunca bloqueiam o boletim original. Resposta inválida, muito grande, desatualizada ou de outra área não aparece como análise confirmada.
- A branch não muda `versionCode`, assinatura ou canal oficial, não faz merge nem publicação de APK.

## Próximas prioridades — propostas para PRs separados

1. **Análises dos avisos sísmicos e tsunami:** quadro curto `O que sabemos / O que ainda não sabemos`, derivado de magnitude, profundidade, localização, fonte e boletim oficial. Não transformar IA em autoridade de emergência, não prever danos nem atrasar avisos prioritários.
2. **Replay regional verificável:** mostrar área, magnitude, profundidade e data do último aviso real salvo, com testes explícitos de seleção M5+, replay de 15 s e retorno ao vídeo. Sem prometer replay de eventos que não foram apresentados.
3. **Navegação D-pad e leitura a distância:** agrupamento, indicadores de foco, texto maior e testes visuais no Fire Stick/Android TV real.
4. **Resiliência e desempenho:** inspecionar CPU/memória, coalescência de consultas, cache de imagens e mapas, perfis de TV lenta; não remover salvaguardas de fonte.
5. **Estado das fontes e dos alertas:** diagnosticar conectividade, idade do último evento e recuperação offline separadamente do estado da IA.

## Verificação

- Compilar e testar via `android-tv-preview.yml`: APK, lint, testes de estado, Robolectric de layout, regras de distribuição e assinatura.
- `WeatherAiInfoTest` cobre respostas válidas/inválidas e a tela de consulta sem tocar na rede.
- No aparelho real, confirmar que o controle remoto foca os botões; as consultas de IA mostram cada estado; sem internet o restante do app continua funcionando; alertas M6+, Brasil e tsunami preservam suas prioridades.
- Não publicar uma atualização oficial sem revisão, APK assinado e teste na TV.
