# Argos Orbis TV — Plano de implementação dos efeitos em TODAS as tarjas

> **Status: ESPECIFICAÇÃO APROVADA PARA IMPLEMENTAÇÃO FUTURA — não implementar automaticamente ao ler este documento.**
> **Pedido do responsável:** “Implemente em tudo e vamos ver no que vai dar. Qualquer coisa a gente vai mudando.”
> **Base verificada no repositório:** Android TV **1.0.122**, com abertura internacional M6+ baseada na segunda prévia de vídeo já publicada. Este documento adiciona um plano de animações para as demais tarjas; **não muda o aplicativo por si só**.
>
> **Referências visuais já aprovadas:** manter a identidade Argos Orbis, o olho oficial que **abre e fecha** (o olho não gira; somente o ponteiro interno do radar gira), a tipografia, o tamanho/posicionamento existentes de cada tarja, o logo/rodapé e os modelos de backup atuais. Não substituir esses layouts por infográficos de tela inteira. O vídeo reproduzido na TV permanece visível.

## Objetivo e princípios obrigatórios

1. Criar um **motor nativo e compartilhado de efeitos visuais** para *todas* as tarjas do app Android TV, com animações específicas por tipo de notícia. Evitar copiar um único efeito intenso para tudo.
2. Oferecer três modos configuráveis na TV: **Completo (padrão), Suave e Sem efeitos**. “Sem efeitos” mantém todos os textos, dados, mapas, alertas e sons previstos pelo sistema — só elimina as transições visuais. Respeitar também `ValueAnimator.areAnimatorsEnabled()` e as preferências de redução de movimento do sistema.
3. **Não mudar os dados, a prioridade, a duração, o tempo de disparo, o som, a lógica de replay ou a política de fonte** dos alertas. Animar apenas como eles são apresentados. Eventos reais têm prioridade absoluta sobre animações/replays; uma animação nunca deve bloquear um aviso crítico.
4. **Nenhum dado fictício em alerta real.** Usar apenas os valores/fonte/status disponíveis nos objetos já usados pelo app. Não inventar intensidades, distâncias, horários, valores de mercado, dano, probabilidade de tsunami ou radar.
5. Renderização local por `Canvas`/`Paint`/`ValueAnimator`, sem chroma key, sem WebView, sem vídeo externo, sem necessidade de PC/servidor extra e sem custos recorrentes.
6. Respeitar o safe-area/overscan da TV e a geometria variável das tarjas. Conservar as barras vermelhas visualmente conectadas à faixa principal; nunca repetir o defeito de blocos desconectados. Texto e números sempre legíveis durante todo o aviso, com opção de redução de movimento.
7. **Evitar regressões**: preservar Brasil, M5 regional, M6 global, tsunami, resumo diário, chuva, temperatura, Brent/dólar, satélite, voz e seus controles. Não modificar site/Telegram/celular neste trabalho.

## Efeitos por categoria — matriz de comportamento

| Tarja | Identidade e efeito visual proposto | Completo | Suave | Sem efeitos |
|---|---|---|---|---|
| **M6+ mundial** | **Manter a abertura da prévia 2 já implementada** (`GlobalM6Intro`): faixa vermelha, clarão, BREAKING NEWS amarelo, rastro, transição à tarja sísmica oficial; logo pisca e radar gira | Respeitar duração já implementada (0–3350 ms), sem reiniciar aviso | Entrada vermelha e transição/fade breve, sem título amarelo gigante | Tarja M6+ clássica imediata |
| **Sismo no Brasil, qualquer magnitude** | Preservar **modelo editorial vermelho/branco aprovado**, mapa do estado, título principal e magnitude à direita. Faixa Brasil desliza; manchete surge em dois passos; ponto real do epicentro pulsa discretamente; rodapé entra no fim | 450–700 ms de introdução, pulso leve no ponto, fade da manchete | 200–350 ms de fade/slide; ponto estático | Desenhar imediatamente. **Modelo 1 teal/branco preservado como backup** |
| **Regional M5,0–5,9** | Preservar `NewsBannerView` regional (`AVISO REGIONAL`). Varredura de **onda sísmica** fina na faixa (não atravessar texto); magnitude ganha destaque suave; área monitorada aparece logo em seguida | 400–650 ms; onda discreta e uma só passagem | 180–300 ms de realce/fade | Tarja regional clássica |
| **Tsunami** | Aviso mais sóbrio e prioritário: faixa de atenção conectada, pulso horizontal curto, mapa/referência costeira aparecendo de imediato; sem simular ondas de altura real | 300–500 ms; manter orientação sempre legível | 150–250 ms | Dados e estado visíveis imediatamente |
| **Temperatura/tempo** | Clarão frio discreto na borda, número/condição surgem suavemente; possível transição de “virar carta” **somente na passagem já existente para mapa**, sem virar a tela inteira | 350–550 ms; 1 passagem sutil | 150–250 ms | Sem efeitos |
| **Chuva/temporal** | Varredura tipo radar concentrada no bloco meteorológico; chuva/raio **somente se o dado real justifica**. Sem chuva animada se estiver sol | 350–600 ms; temporal forte pode acrescentar brilho pontual não estroboscópico | 150–300 ms sem raio | Imóvel, conteúdo real |
| **Brent + dólar** | Um único componente de mercado, números aparecendo com fade curto, linha horizontal desenhando uma vez, seta/indicador apenas quando variação verificada é conhecida | 350–550 ms sem “roleta” nem contagem fictícia de preços | 150–250 ms | Cotação e estado estáticos |
| **Resumo diário** | **Não redesenhar a tarja**; manter 5 eventos/indicadores e duração atuais, com fades leves entre cada evento e mapa, sem “BREAKING NEWS” | 250–400 ms entre páginas (dentro da duração vigente) | 120–200 ms | Troca sem efeito |
| **Satélite** | Fade da imagem após estar pronta, horário da captura aparece junto; nunca simular nuvens ou imagens novas nem esconder idade da captura | 300–500 ms | 150–250 ms | Imagem diretamente |
| **Comandos de voz** | Confirmação visual breve e apresentação do card/tarja requisitado no mesmo estilo da categoria; sem card de canto novo | 250–350 ms | 120–200 ms | Abrir imediatamente |

**Replays:** toda animação deve ser mais discreta que no alerta real; manter rótulo histórico e nenhum som novo. A abertura global M6+ de 3,35 s continua **desligada para replay, revisão, Brasil, regional, resumo e sismo acoplado a tsunami**, conforme a regra atual de `GlobalM6Intro.eligible(...)`.

## Arquitetura proposta

### Núcleo compartilhado

Criar `TvEffectsController.java` (ou nome equivalente), responsável por:

- `EffectsMode { FULL, SOFT, OFF }`; preferência persistida `tvEffectsMode`. Padrão `FULL` **apenas depois de testes aprovados**.
- `EffectsCategory { GLOBAL_M6, BRAZIL, REGIONAL, TSUNAMI, WEATHER, RAIN, MARKET, SUMMARY, SATELLITE, VOICE }`.
- Estado por **instância de tarja** (tempo `SystemClock.uptimeMillis()`, categoria, tipo de evento, replay/demo, intensidade, animações habilitadas).
- Funções puras (`phase`, `ease`, `opacity`, `translate`) e desenho barato de streaks/pulsos; **não usar `Thread.sleep`, bloqueio da UI, renderização remota ou timers que sobrevivam ao fechamento da tarja**.
- Não reconstruir `Paint`, `Path`, `Bitmap`, `Shader`, fontes, formatos de data ou mapas a cada frame. Pré-alocar objetos quando viável.
- **Motor não altera `Alert`, `FeedClient`, nem prioridades da fila `MonitorService`**; somente recebe estado de apresentação já existente.

### Integração com arquivos reais (confirmados no repositório)

| Local | Papel na implementação |
|---|---|
| `android-tv/app/src/main/java/top/monitorglobal/tv/Banner.java` | Escolher categoria e modo de efeitos ao criar uma tarja; manter uma única sobreposição e o agendamento original |
| `BannerRevealLayout.java` | Entrada e saída compartilhadas; **validar alturas variáveis** da tarja Brasil (180 unidades) vs sísmica padrão (126 + mapa). Evitar cortes de banner/mapa quando efeitos OFF |
| `NewsBannerView.java` | Regional, mundial, tsunami e resumo diário; acrescentar pequenos efeitos por categoria sem mudar texto, rodapé e layout existente |
| `GlobalM6Intro.java` | **Reutilizar**, não duplicar a abertura já aprovada da segunda prévia; combinar preferências M6 atuais com modo global |
| `BrazilNationalBannerView.java` | Abertura editorial do Brasil; respeitar chave de modelo aprovado/backup e o pulso apenas no epicentro localizado |
| `TvBroadcastInfoView.java` | Weather, rain, market (Brent + dólar), satellite e voice status; aplicar efeitos específicos usando seus `kind` atuais |
| `BroadcastVisuals.java`, `OledNewsChrome.java` e `OfficialArgosLogo.java` | Identidade oficial e parâmetros compartilhados; manter o olho piscando, radar interno e tipografia |
| `BannerTimeline.java` | Derivar tempos dos efeitos sem mexer em `PAGE_MS`, `SUMMARY_PAGE_MS`, `WIPE_MS`, sequência de replay ou duração total |
| `MainActivity.java` | Menu de modos e botões de demonstração/testes por categoria |
| `MonitorService.java` | Reaproveitar fluxo de testes fictícios sem notificar como alerta real, mantendo prioridade e cancelamento |
| `android-tv/app/src/nativeMapTest/java/top/monitorglobal/tv/` e `android-tv/tests/python/` | Cobrir desenho, comportamento, segurança do aviso e regressões visuais |

**Não criar tarjas redundantes, nem substituir `TvBroadcastInfoView` por novo card:** cotação, temperatura e chuva **já têm layout aprovado**. O trabalho agora é **efeitos**, não redesenho.

### Configurações na TV

Adicionar um botão acessível pelo controle remoto:

- `Efeitos das tarjas: Completo / Suave / Sem efeitos` (persiste no aparelho; rótulo atualiza ao alterar).
- Manter `Abertura animada M6+` **ativar/desativar** já existente como preferência independente e conservar `Tarja Brasil: modelo aprovado / Modelo 1 reserva`.
- Precedência: se o sistema desabilitar animações ou modo OFF, **nenhuma** animação visual, ainda que a abertura M6+ esteja ativada. Se modo SOFT, versão reduzida M6+. Se FULL, respeitar também o interruptor independente M6+.
- Botão `Testar todos os efeitos (simulações)` pode oferecer uma amostra **sequencial e cancelável**, sem iniciar sons reais nem interferir em avisos prioritários. Preferir também botões individuais por categoria.

## Tempo e prioridade

- Entrada compartilhada atual: `BannerTimeline.WIPE_MS=700`; resumo atual: `SUMMARY_PAGE_MS=6000` por página; regional atual: 15 segundos. Manter os contratos existentes.
- Efeitos entram **dentro** do tempo de apresentação, não adicionam segundos ao início/fim nem adiam informação crítica.
- **Ao receber alerta prioritário durante qualquer efeito**, cancelar a animação anterior e exibir o novo alerta imediatamente. A fila, som, `startReal()`, `stopTarget()`, `interruptDaily()` e `Banner.hide()` mantêm o comportamento atual.
- Para alertas sísmicos reais, mostrar magnitude, local e status legíveis **imediatamente ou com atraso mínimo**; uma abertura vistosa não deve ocultá-los por segundos se houver tsunami ou atualização urgente. Nos casos urgentes, ignorar abertura.
- Imagem do satélite recebe fade apenas quando `Frame` válido está pronto; mostrar indisponibilidade/horário real, nunca simular imagem carregada.
- Ao trocar de vídeo, desligar TV, receber `onDetachedFromWindow` ou encerrar alerta, cancelar animações, listeners e callbacks; sem vazamento ou dupla tarja.

## Qualidade gráfica e desempenho

- Testar Android TV e Fire TV, inclusive equipamentos modestos (animação de baixa complexidade), fundo 16:9 e posicionamento em cima/embaixo.
- Quando sem dados de mapa, não animar um epicentro inventado. Se preço/humidade/variação indisponível, não gerar contagem de valores fictícios.
- Evitar flashes estroboscópicos; o brilho M6 aprovado deve ser curto e limitado à tarja. Texto deve manter contraste e legibilidade.
- Prevenir: elementos fora das bordas, faixa vermelha desconectada, sobreposição no rodapé, logo cortado, ticker atravessando relógio/marca, tarja invadindo mapa e cortes por `themeWidthPercent`.
- Priorizar 60 fps nos equipamentos capazes, degradação graciosa a 30 fps, sem bloqueio visível da aplicação/TV. Medir tempos por `RuntimeDiagnostics`; comparar com a versão base para memória e tempo de desenho.
- Sem bibliotecas pagas, sem API extra e sem download de efeitos em tempo real.

## Estratégia de implementação e entrega

1. **Base:** motor de efeitos + 3 modos + testes de configuração e cancelamento, sem mudar o visual padrão ainda.
2. **Sísmicos:** Brasil, regional, tsunami; integrar com o M6+ existente; validar prioridade dos eventos. Preservar Brasil Modelo 1 como backup.
3. **Informativos:** tempo, chuva, Brent/dólar; garantir que os dados se mantenham corretos e os layouts aprovados idênticos ao estado anterior fora das transições.
4. **Acabamento:** resumo diário, satélite e voz.
5. **Verificações:** testes Java/Robolectric nativos, regressão Python, testes de fumaça e capturas quadro a quadro com o mesmo evento antes/depois (FULL, SOFT, OFF), inclusive dispositivo com animações do sistema desligadas.
6. **Publicação:** PR próprio, CI aprovado, merge e APK oficial com atualização pelo próprio app. Número de versão é definido na implementação; **não alterar o `build.gradle` neste documento**.

### Critérios de aceitação (obrigatórios)

- [ ] Todos os **10 tipos de apresentação** da matriz têm efeitos próprios; mercado inclui **Brent e dólar** e tempo cobre temperatura, chuva e satélite.
- [ ] Modo **Completo**, **Suave** e **Sem efeitos** funciona em todas as categorias e persiste após reinício.
- [ ] M6+ usa a prévia 2 já aprovada em FULL; interruptor M6+ existente continua funcional, inclusive em OFF.
- [ ] Brasil conserva dois modelos e a escolha de backup; modelo aprovado mantém disposição branca/vermelha e magnitude à direita.
- [ ] Todos os alertas reais preservam dados, rótulos, sons, horários, prioridade e duração original; replays não simulam eventos novos.
- [ ] Resumo diário mantém **exatamente o layout** e os totais atuais.
- [ ] Tarjas de cotação, temperatura e chuva mantêm seu **layout já renovado**.
- [ ] Logo oficial não gira como um todo: **olho pisca, ponteiro interno gira**.
- [ ] Sem travamento, vazamentos, artefatos de transição, recortes, tarjas soltas ou mudança involuntária da posição das tarjas.
- [ ] Screenshots/frames de antes/depois por categoria anexados ao PR, incluindo o **primeiro segundo**, o **meio** e a **saída**.
- [ ] Aprovação dos testes Android TV e Smoke test antes de publicar versão assinada.

## Pedido pronto para um agente/Codex no GitHub

> Implementar o plano de animações de todas as tarjas definido em `docs/argos-orbis-tv-efeitos-todas-tarjas.md` no repositório `helbermoura2/Monitor-Global`. Manter todos os layouts aprovados e regras atuais. Criar motor compartilhado FULL/SOFT/OFF, efeitos por categoria, testes gráficos nativos com capturas comparativas, fallback da tarja Brasil e controle existente de abertura M6+. Não alterar site, Telegram ou app celular. Abrir PR; executar Android TV preview e smoke tests; só integrar/publicar após passar CI. Preservar todas as fontes e informações verdadeiras de cada alerta.

---

**Importante:** este arquivo é uma **especificação de trabalho** no GitHub. A existência do arquivo ou da issue associada **não significa que os efeitos já foram implementados**.
