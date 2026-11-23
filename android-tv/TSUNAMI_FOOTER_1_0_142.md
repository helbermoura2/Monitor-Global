# Argos Orbis TV 1.0.142 — boletins de tsunami e rodapé complementar

## Problema observado na TCL P7K
A tarja principal de sismo já exibia magnitude, local, profundidade, fonte e
horário; o ticker repetia título, detalhe, profundidade e hora, inclusive
concatenando sismo e tsunami em um mesmo texto. Em boletins oficiais sem ameaça,
a classificação aparecia na categoria esquerda, no subtítulo superior, na linha
do boletim e no ticker. Isso não acrescentava informação.

## Alteração
- **Boletim de tsunami:** a situação oficial (AVISO, VIGILÂNCIA, ATENÇÃO, SEM
  AMEAÇA, ENCERRADO ou NÃO CONFIRMADA) fica explícita na linha principal.
  O cabeçalho informa apenas **BOLETIM REGIONAL · COSTAS CITADAS** e a
  coluna da esquerda indica **TSUNAMI / BOLETIM**, sem repetir "sem ameaça".
- **Escopo:** o rodapé explica que boletins sem ameaça se referem apenas às
  costas citadas. Outras costas podem ter situação diferente. Nenhuma falta
  de boletim é interpretada como ausência de ameaça.
- **Sismos globais e regionais, Brasil e replays:** o ticker prioriza
  coordenadas do epicentro, identificação real do registro, estimativas de
  população/proximidade apenas quando disponíveis e avisos relacionados
  somente se constarem no produto de origem. Não repete magnitude, local,
  profundidade, fonte e horário do corpo da tarja.
- **Páginas vinculadas:** ao alternar entre um sismo e o boletim relacionado,
  o rodapé passa a usar os dados complementares **da página atual**. A faixa
  continua com a mesma duração e movimento.
- **Resumo diário:** mantém dia/estado da consulta e a indicação de que os
  registros históricos não provam a situação atual de tsunami.
- **Acessibilidade:** conserva título e detalhe oficiais completos, mesmo
  quando o texto rolante é editorialmente mais curto.

## Segurança
Nenhuma mudança na classificação de tsunami, nas fontes, na associação
sismo/boletim, na prioridade dos alertas, nos sons, no monitoramento ou nos
transportes de Cell Broadcast e Cloudflare. Avisos oficiais ativos permanecem
destacados e não são confundidos com um boletim sem ameaça.

## Testes
`SeismicFooterTest` cobre dados complementares, ausência de afirmação
inventada de segurança, repetição de estado, avisos ativos e rodapé por
página vinculada. A suíte existente preserva replay e resumo diário.

## Reversão
Restaurar a montagem antiga do ticker em `NewsBannerView.java` e
`BrazilNationalBannerView.java` e remover `SeismicFooter.java` e seu
teste. Manter intactas as divisórias vermelhas da 1.0.141, o alinhamento dos
mapas e os alertas. Em uma publicação de reversão, sempre aumentar
`versionCode`.

## Publicação
A presença do código não disponibiliza APK. Liberar para atualização pela TV
somente após compilação, testes gráficos, assinatura oficial e atualização
confirmada de `android-tv/distribution/stable.json` para 1.0.142.
