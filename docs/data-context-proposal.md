# Item 6: origem e limites junto ao dado

Proposta de localização, ainda sem alterar a interface. Reutiliza os diálogos e seções existentes; não adiciona chamadas de API.

- Na frente do cartão principal: selo clicável junto à intensidade. “Dado da fonte” abre a explicação do produto publicado pela agência; “Estimativa do app” explica o modelo epicentral e que ele não confirma percepção ou danos. Um ShakeMap oficial também é uma estimativa publicada, não observação em cada ponto nem limite absoluto de onde foi sentido.
- No verso, junto à população: manter a estimativa e sua cobertura parcial, com o acesso “Fonte e método” já existente. USGS PAGER continua sendo exposição estimada; WorldPop combina população em grade e modelo de intensidade. Não é número de pessoas afetadas, vítimas ou feridos.
- Em Relatos: “Relatos de percepção” identifica contribuições de pessoas, mesmo quando publicadas pelo USGS/DYFI. Fonte institucional não transforma um relato em medição instrumental.
- No bloco do tsunami: categoria e conclusão do boletim oficial, com fonte e horário. A explicação distingue origem sísmica, costas sob aviso e área de inundação. Magnitude sozinha não confirma tsunami.
- Em Detalhes: reunir fonte, horário, método e limitações em “Fontes e evidências”, aproveitando a seção existente. A explicação abre por toque/clique e permanece acessível por teclado; não depende apenas de passar o mouse.

A qualidade de cada medida deve ser explícita. Evitar usar um selo geral de fonte institucional como garantia de que todo conteúdo do cartão é observado ou confirmado. A implementação visual é a etapa seguinte à auditoria de desempenho/consumo.

## Implementação — 21/10/2026

Implementados selos acionáveis por toque, clique ou teclado, com explicações em um diálogo acessível. Profundidade identifica dado da fonte; intensidade separa modelo do app, intensidade publicada e percepção, inclusive após enriquecimento assíncrono. A explicação de intensidade publicada avisa que ShakeMap continua sendo estimado. Energia é calculada. População PAGER e WorldPop permanece estimativa e mantém Fonte e método no verso. Relatos de percepção têm explicação própria. Avisos, observações, modelos meteorológicos e boletins têm contexto por natureza; o selo do tsunami não substitui nem altera o status de ameaça do boletim.

Não adiciona consultas, muda prioridades, nem substitui o giro existente. Detalhes → Fontes e natureza dos dados reúne origem e limitações. As explicações abrem somente por ação do usuário.
