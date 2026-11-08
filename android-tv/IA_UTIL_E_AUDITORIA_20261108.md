# Android TV — IA compreensível e auditoria de usabilidade (08/11/2026)

## Segunda etapa — quatro prioridades e interface interna implementadas no PR #609

**1. IA mais útil e verificável**
- A tela de IA agora tem o mesmo desenho de dashboard da TV, com botões grandes, foco visível pelo controle remoto e marca original animada.
- O usuário pode consultar o tempo ou a chuva apenas quando quiser. O retorno distingue disponibilidade, falta de observações relevantes, processamento, limite e indisponibilidade.
- Se o retorno é válido, informa o **horário da previsão de origem e o horário de referência**, nunca apenas uma fala da IA sem fonte. Não existe análise especulativa de danos/tsunami nem repetição obrigatória de números do boletim.

**2. Replay regional transparente**
- O painel mostra o último **aviso real M5+ elegível** salvo localmente (área e magnitude, ou ausência explícita).
- Um diálogo separado informa local, profundidade, data original, fonte, duração e atraso antes de executar. É uma confirmação, não um player.
- A execução continua pela ação original `MonitorService.REPLAY_TARGET` → `CompactNotice`: **tarja REPLAY sobre o vídeo atual**, com prioridade dos alertas reais inalterada. `Banner`, `CompactNotice` e replays M6+/resumos não foram modificados.

**3. Interface para controle remoto**
- Tela inicial redesenhada com duas colunas de estado (permissões, monitoramento, fontes, tempo, chuva e satélite), seções de funções e botões grandes agrupados em linhas duplas em TVs largas.
- Foco do controle remoto com contorno ciano; textos explicativos longos acessíveis por botões `Detalhes`, sem parede de texto na primeira tela.
- A página de IA segue o mesmo estilo, com botões de consulta e resultados separados em cartões legíveis.
- **Marca obrigatória:** `RadarLogoView` usa a geometria exata de `ic_launcher_monitor.xml`: três anéis fixos, cunha e ponto na cor #38BDF8. A cunha+ponto gira em **2,4 segundos**, como em `css/brand-logo.css`. Parada fora da tela e com animação desabilitada por acessibilidade.
- `ic_launcher_monitor.xml`, `tv_banner.xml`, `css/brand-logo.css` e a arte da marca do site **não foram alterados**. A concepção gráfica com um globo não substituiu o logo.

**4. Desempenho e diagnóstico**
- O painel das configurações atualiza dados locais a cada **9 segundos em vez de 3** e só chama `setText` quando o conteúdo mudou. O histórico M5+ é decodificado apenas se seu JSON local mudar.
- O sampler existente `RuntimeDiagnostics` já coletava memória uma vez por minuto. Agora também calcula **CPU do processo em percentagem de um núcleo** entre amostras, sem iniciar cron, polling de servidor ou coleta de dados pessoais. Pode ultrapassar 100% em multicore; primeira amostra exibe `aguardando segunda leitura`.
- O diagnóstico é local, exportável no JSON existente. A varredura animada não cria uma camada GPU extra e para quando a janela não está visível.
- **NÃO** foi alterado o polling de sismos a cada 30 s, o rastreador de fontes, o Worker meteorológico nem as prioridades de emergência.

**Validação antes de mesclar:** `Android TV preview` (compilar, lint e testes gráficos Robolectric), `Smoke test`, revisão dos resultados reais na TV e confirmação visual do logo, D-pad e da tarja sobre outro aplicativo. O PR segue rascunho. Não atualizar a versão oficial nem publicar APK oficial automaticamente.

---

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

## Regra visual confirmada por gravação real da TV

O replay é uma **sobreposição na programação que o usuário está assistindo**, não uma página independente nem um player embutido na tela de configuração. O vídeo enviado mostra a tarja de telejornal com mapa de epicentro e selo REPLAY entrando sobre um conteúdo em execução e avançando por diferentes eventos. Os painéis de UI apresentados em imagens são **conceitos para a configuração e o status**, nunca para substituir a saída de `Banner`/`CompactNotice` sobre outros apps. Nenhum redesenho deve migrar o replay para dentro da `MainActivity` nem capturar os controles do player. A IA também não deve afetar as filas, os prazos ou a prioridade dessas sobreposições.

## Segurança e limites

- Alerta de sismos, tsunami, Telegram, mapas, Worker de alertas, região monitorada, fila de prioridade, intervalo de consulta e som **não foram alterados**.
- As consultas manuais podem consumir a franquia compartilhada de Workers AI; isso é explicado na tela, e somente acontece após OK do usuário.
- O texto não é gerado livremente pelo modelo no Android TV. Não há envio de texto da pessoa, microfone, localização GPS ou dados privados.
- A nova `WeatherAiInfoActivity` não é exportada no AndroidManifest e não solicita permissões extras.
- Falhas nunca bloqueiam o boletim original. Resposta inválida, muito grande, desatualizada ou de outra área não aparece como análise confirmada.
- A branch não muda `versionCode`, assinatura ou canal oficial, não faz merge nem publicação de APK.

## Próximas prioridades — propostas para PRs separados

1. **Análises dos avisos sísmicos e tsunami:** quadro curto `O que sabemos / O que ainda não sabemos`, derivado de magnitude, profundidade, localização, fonte e boletim oficial. Não transformar IA em autoridade de emergência, não prever danos nem atrasar avisos prioritários.
2. **Replay regional verificável, SEM MUDAR A APRESENTAÇÃO:** a tela de configurações deve apenas informar se há aviso elegível salvo e oferecer o comando de reprodução. O replay **não é reproduzido dentro do aplicativo**: deve continuar aparecendo como a tarja **BREAKING NEWS** sobre o vídeo ou outro app já aberto, com magnitude, local, profundidade, mapa do epicentro à direita, indicação **REPLAY**, animação e retirada automática. O replay regional real segue a duração de 15 s e o retorno ao vídeo; o resumo sísmico/replay em sequência mantém seu fluxo e tempos próprios. Não prometer replay de eventos que não foram apresentados.
3. **Navegação D-pad e leitura a distância:** agrupamento, indicadores de foco, texto maior e testes visuais no Fire Stick/Android TV real.
4. **Resiliência e desempenho:** inspecionar CPU/memória, coalescência de consultas, cache de imagens e mapas, perfis de TV lenta; não remover salvaguardas de fonte.
5. **Estado das fontes e dos alertas:** diagnosticar conectividade, idade do último evento e recuperação offline separadamente do estado da IA.

## Verificação

- Compilar e testar via `android-tv-preview.yml`: APK, lint, testes de estado, Robolectric de layout, regras de distribuição e assinatura.
- `WeatherAiInfoTest` cobre respostas válidas/inválidas e a tela de consulta sem tocar na rede.
- No aparelho real, confirmar que o controle remoto foca os botões; as consultas de IA mostram cada estado; sem internet o restante do app continua funcionando; alertas M6+, Brasil e tsunami preservam suas prioridades.
- Não publicar uma atualização oficial sem revisão, APK assinado e teste na TV.
