# Resumo sísmico diário — Argos Orbis (v7, Rajdhani Neon)

Modelo aprovado para o boletim automático do Telegram em 09/11/2026. A saída continua PNG HD de 1800 px de largura, gerada pelo mesmo Durable Object e pelo mesmo canal/fila de envio, sem alterar a periodicidade, o histórico nem a regra de deduplicação.

## Identidade visual

- Azul-marinho quase preto, linha ciano e radar do Argos Orbis, com títulos em Rajdhani Bold do mesmo atlas usado no aplicativo da TV.
- Título RESUMO SÍSMICO DIÁRIO em uma linha e data BRT.
- Mapa-múndi real à esquerda, contorno ciano, com os cinco maiores eventos posicionados pelas coordenadas das fontes.
- Evento principal à direita, com magnitude grande e cor por intensidade (M6+ vermelho, M5 laranja, M4 amarelo, abaixo de M4 verde), local, país, profundidade, horário BRT e bandeira apenas quando identificada.
- Ranking em quatro linhas adaptativas: magnitude, local, **bandeira ao lado do país de cada sismo**, distância geodésica a São Paulo, horário BRT e profundidade. Os cinco eventos têm bandeira quando o país é identificado no atlas, sem ícones inventados.
- Seção verde do Brasil, exibida somente com registros brasileiros, incluindo baixas magnitudes fora do Top 5.
- Cinco estatísticas coloridas e rodapé com fontes, site e @monitor_global.

## Preservação dos dados

O gerador em daily-summary-renderer.mjs mantém o mapa offline Natural Earth e o atlas de bandeiras. A classe de fonte Rajdhani Bold é carregada dos recursos do projeto. O cache passa a daily-v13-rajdhani-neon-flags e o marcador /health é monitor-global-rajdhani-neon-v7.

Os cinco maiores eventos continuam ordenados por magnitude decrescente e horário crescente no empate; bandeiras apenas para países identificados, horários America/Sao_Paulo, e dados desconhecidos não são substituídos por estimativas. O bloco Brasil expande a altura conforme a quantidade de sismos. Os alertas individuais M6+ e Brasil têm renderer independente e não são alterados por esta mudança.

## Testes e publicação

- node tests/unit/daily-summary-design-check.mjs
- node --test tests/unit/worker-image-parity.test.mjs
- node tests/unit/daily-summary-brazil-check.mjs
- node tests/unit/daily-summary-brazil-revision-check.mjs

Prévia offline: SUMMARY_PREVIEW_PATH=/tmp/resumo.png node tests/unit/daily-summary-design-check.mjs.

Depois da aprovação dos testes e do merge, é necessário implantar o Worker manualmente em Cloudflare Worker maintenance, main, mode=deploy. Não alterar segredos nem o robô existente.

## Argos Orbis · identidade aprovada pelo proprietário (16/11/2026)

O boletim PNG automático passa a usar uma miniatura transparente do **logo oficial**
`img/argos-orbis-vigilante-static.svg`, com olho tecnológico, quatro símbolos,
inscrições **ΠΑΝΟΠΤΗΣ** e **CUSTOS ORBIS**; não é outro olho gerado
por aproximação. O renderer utiliza a miniatura embutida offline,
sem acessar URLs nem contas externas durante a renderização.

Novo código de design: `argos-orbis-panoptes-imperial-v1`.
As molduras do mapa, evento principal, listagem e rodapé passam a bronze,
a faixa de totais fica compacta (108 px lógicos, cinco grupos preservados)
e o endereço do canal no rodapé é `@argosorbis`.
Os dados do boletim continuam dinâmicos, com cinco maiores sismos posicionados
pelas coordenadas das fontes, bandeiras geográficas, seção brasileira adaptativa,
fontes, datas e contagens calculadas. **Não usar os números da imagem-conceito como
conteúdo fixo.** A saída continua HD, 1800 px de largura e 2880 px de altura
para exemplos sem sismos brasileiros; os boletins com Brasil podem expandir.

O cache de renderização foi invalidado para o novo layout. Esta alteração só
atinge o gerador do resumo diário, não os alertas M6+/Brasil nem os segredos
Telegram, o canal configurado ou as regras de envio. A publicação exige deploy
separado do Worker após os testes de PNG e deduplicação.

## Arte final aprovada (16/11/2026)

O desenho agora corresponde à **composição greco-romana com estátua clássica, louros, mármore noturno e molduras bronze** aprovada pelo proprietário. A obra original foi adaptada para um raster offline compacto de uso no Cloudflare Worker; o cabeçalho, estatutária e rodapé são preservados, enquanto os campos de data, mapa, evento principal, quatro linhas de ranking e cinco estatísticas são repintados a cada execução com os dados reais.

Código visual `argos-orbis-approved-classical-art-v1`. Composição base 900 × 1200 px lógicos, PNG final 1800 × 2400 px. Boletins com atividade sísmica brasileira adicionam uma seção com número real de registros (exibem os seis mais fortes e informam o total adicional). A arte visual é uma miniatura otimizada do modelo fornecido e os números da imagem de exemplo não são reutilizados.

O mapa e suas coordenadas são gerados com o motor geográfico já existente. O cachê da imagem foi versionado para não devolver a arte anterior. Guardas de envio e credenciais permanecem intactos.
