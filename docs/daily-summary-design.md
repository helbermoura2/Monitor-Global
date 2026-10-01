# Resumo diário do Telegram — modelo 2

Cartões compactos em azul escuro, magnitude em âmbar, localidade e metadados em Inter, país e bandeira à direita. O radar aparece no cabeçalho. Localidades longas quebram linhas e aumentam a altura do cartão. Regiões oceânicas sem país identificado não recebem uma bandeira inventada; Ilhas Balleny usam a identificação regional da Antártida.

As fontes e 88 bandeiras são atlas PNG embutidos nos módulos `summary-typography.mjs` e `summary-flags.mjs`. A renderização não depende de downloads externos. Inter: Google Fonts, SIL Open Font License (Inter-OFL.txt). Bandeiras nacionais: Flagpedia/flagcdn.com; identidade da Antártida: Twemoji.

A atualização altera apenas a imagem: janela de envio BRT, persistência no Durable Object, bloqueio de envios duplicados e tratamento de timeout permanecem. Não é necessário reenviar um resumo para testar.

Validação: `node tests/unit/daily-summary-design-check.mjs` e `node tests/unit/telegram-history-check.mjs`. Para gerar uma prévia local: `SUMMARY_PREVIEW_PATH=/tmp/resumo.png node tests/unit/daily-summary-design-check.mjs`.
