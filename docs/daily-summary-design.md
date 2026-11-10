# Resumo sísmico diário — Monitor Global (v7, Rajdhani Neon)

Modelo aprovado para o boletim automático do Telegram em 09/11/2026. A saída continua PNG HD de 1800 px de largura, gerada pelo mesmo Durable Object e pelo mesmo canal/fila de envio, sem alterar a periodicidade, o histórico nem a regra de deduplicação.

## Identidade visual

- Azul-marinho quase preto, linha ciano e radar do Monitor Global, com títulos em Rajdhani Bold do mesmo atlas usado no aplicativo da TV.
- Título RESUMO SÍSMICO DIÁRIO em uma linha e data BRT.
- Mapa-múndi real à esquerda, contorno ciano, com os cinco maiores eventos posicionados pelas coordenadas das fontes.
- Evento principal à direita, com magnitude grande e cor por intensidade (M6+ vermelho, M5 laranja, M4 amarelo, abaixo de M4 verde), local, país, profundidade, horário BRT e bandeira apenas quando identificada.
- Ranking em quatro linhas adaptativas: magnitude, local, distância geodésica a São Paulo, horário BRT e profundidade.
- Seção verde do Brasil, exibida somente com registros brasileiros, incluindo baixas magnitudes fora do Top 5.
- Cinco estatísticas coloridas e rodapé com fontes, site e @monitor_global.

## Preservação dos dados

O gerador em daily-summary-renderer.mjs mantém o mapa offline Natural Earth e o atlas de bandeiras. A classe de fonte Rajdhani Bold é carregada dos recursos do projeto. O cache passa a daily-v12-rajdhani-neon e o marcador /health é monitor-global-rajdhani-neon-v7.

Os cinco maiores eventos continuam ordenados por magnitude decrescente e horário crescente no empate; bandeiras apenas para países identificados, horários America/Sao_Paulo, e dados desconhecidos não são substituídos por estimativas. O bloco Brasil expande a altura conforme a quantidade de sismos. Os alertas individuais M6+ e Brasil têm renderer independente e não são alterados por esta mudança.

## Testes e publicação

- node tests/unit/daily-summary-design-check.mjs
- node --test tests/unit/worker-image-parity.test.mjs
- node tests/unit/daily-summary-brazil-check.mjs
- node tests/unit/daily-summary-brazil-revision-check.mjs

Prévia offline: SUMMARY_PREVIEW_PATH=/tmp/resumo.png node tests/unit/daily-summary-design-check.mjs.

Depois da aprovação dos testes e do merge, é necessário implantar o Worker manualmente em Cloudflare Worker maintenance, main, mode=deploy. Não alterar segredos nem o robô existente.
