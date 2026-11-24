# Argos Orbis — Avisos CAP Severe e Extreme no Brasil

## Regra de integração
- CAP/IDAP nacional: somente registros públicos, atuais, idioma português, com área, emissor e Severity Severe/Extreme originais.
- São Paulo capital: o canal existente de TV usa apenas CAP com interseção geoespacial verificada e emissores estaduais autorizados. Alertas de outros estados não interrompem a TV.
- Cell Broadcast: permanece independente do CAP; classificação apresentada no Android não é alterada pela classificação do documento CAP.
- INMET mantém suas categorias Perigo e Grande Perigo, sem convertê-las em Severe ou Extreme.
- CEMADEN mantém Alto e Muito Alto, sem convertê-los em Severe ou Extreme.

## Componentes
- O coletor Python gera os arquivos data/defesa-civil-sp.json e data/defesa-civil-br.json na mesma execução do IDAP.
- Brasil nacional: a lista exige área explicitamente identificada; avisos cancelados, vencidos, testes e exercícios são descartados. Há teto de 1.500 registros por snapshot; excedentes são sinalizados pelo campo truncated e total.
- No site, Central Brasil apresenta o catálogo CAP nacional, INMET e CEMADEN em seções distintas. Sem som emergencial disparado pela lista nacional.
- No Android 0.1.60, Central de Alertas apresenta catálogo nacional além do cartão já existente para São Paulo, com atualização a cada cinco minutos quando aberta.
- Os dados ficam indisponíveis quando a origem não é confirmada recentemente; nenhuma ausência de dados é interpretada como ausência de risco.
- A TV continua usando o coletor local já existente e não recebe versão nova nesta etapa.

## Publicação e limitações
- GitHub Actions tenta atualizar os dois instantâneos a cada cinco minutos, mas execução e propagação podem atrasar. O catálogo começa vazio com checkedAt zero: não há dados reais inventados.
- Nunca unificar níveis de plataformas diferentes nem deduplicar avisos oficiais distintos pelo horário ou apenas pela geografia.
- Testes Python cobrem escopo, expiração, cancelamento e severidade. Testes JS checam sintaxe. Testes do aplicativo móvel validam resposta nacional e assinatura existente.
- Reversão: retirar somente os consumidores nacionais e o novo snapshot; preservar CAP estadual, ponte dos celulares e rotas atuais do Cloudflare.
