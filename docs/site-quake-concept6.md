# Imagem de sismo do site — Conceito 6 (novembro de 2026)

## Duas ações independentes

- **📤 Imagem** permanece disponível para **qualquer evento**. Nos sismos com epicentro válido, gera o PNG 1080×1920 com o Conceito 6 em qualquer magnitude; em outros tipos ou quando faltam coordenadas, usa o fallback existente, sem inventar mapa.
- **▶ Vídeo** aparece apenas para **M6,0+ no mundo** ou **qualquer magnitude com localização brasileira confirmada**. Ele cria, por ação do usuário, um arquivo de vídeo **separado da imagem**. Não adiciona player, marca de vídeo ou botão de replay ao PNG. Não envia mídia ao Telegram.

## Novo PNG de sismo

Marca Monitor Global, local, magnitude, bandeira do país, bandeira do estado brasileiro identificável, mapa e epicentro, mini mapa regional, horário de Brasília, fonte, profundidade, intensidade sísmica **estimada**, estado do boletim de tsunami e rodapé **monitorglobal.top** / **Telegram · @monitor_global**. Não apresenta painel de população, explicações longas, energia em TNT nem legenda de contornos. Esses dados permanecem no site, não no PNG.

País e estado utilizam SVGs locais já versionados, respectivamente em `assets/flags/countries` e `assets/flags/br-states`. O país vem da cartografia `CountryBoundaries` (ou campo verificado do evento); o estado vem dos polígonos reais de `assets/geography/br-states.json`. Fallback para sigla `/UF` só quando Brasil já está confirmado. Nunca inserir uma bandeira estadual para eventos estrangeiros.

O modelo de imagem entregue automaticamente pelo **Telegram não mudou**: ele tem layout e estratégia de publicação próprios (`js/quake-telegram-layout.js`, `worker/image-rendering.mjs`). O PNG do site agora usa `js/quake-site-card.js` por meio de `js/story-share.js`.

## Vídeo local e limites

O navegador renderiza um replay cartográfico de ~9 segundos usando **os mesmos pixels e dados de intensidade** do PNG, com movimento de câmera sobre o epicentro. **Não é uma simulação física da propagação de ondas, da ruptura ou dos danos**. O texto "VÍDEO ILUSTRATIVO" identifica isso durante a reprodução. Caso exista uma ShakeMap oficial já incorporada aos dados, ela pode aparecer no mapa; não é sintetizada uma grade oficial ausente.

A gravação usa `MediaRecorder` e `canvas.captureStream`. O botão salva **MP4 somente se compatível com o navegador**, caso contrário **WebM** (Chrome Android). Não exige computador, servidor de vídeo nem chaves externas. Se o navegador não suportar gravação, mostra aviso e não finge criar arquivo.

A escolha entre imagem e vídeo é local e explícita. Não há publicação automática, postagem em mídias sociais nem geração contínua em background.

## Validação

- `node --test tests/unit/quake-site-concept6.test.mjs`
- `npx playwright test tests/site-concept6.spec.js tests/story-all-events.spec.js tests/seismic-story-population.spec.js`

Verificar no aparelho: imagem com país + Pernambuco para Lajedo; botão Vídeo com M1,8 Brasil, oculto para M4,3 Japão, visível para M6,3 Japão; mídia gerada/salva na TV ou celular conforme suporte, sem vídeo no PNG.
