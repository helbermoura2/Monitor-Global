# Monitor Global TV 1.0.64 — replay brasileiro independente e diagnóstico de voz no Fire TV

## Problema observado em 09/11/2026

- O botão anterior dizia “último sismo M6+ ou no Brasil (72 h)”, mas fazia uma busca mundial USGS filtrada por M6+, com fusão regional opcional. A atualização do Telegram mostrou um M1,8 em Lajedo/PE em 08/11/2026 às 02:26 BRT, que não deve depender desse filtro.
- O botão “Falar com o Monitor Global” no Fire TV Stick 4K Max retornou “Comando de voz cancelado”. Isso indica ausência de resultado do reconhecimento externo, não falha dos dados do Brent ou da TV.

## Mudanças

- Novo botão **Replay · Último sismo M6+ mundial (72 h)**: catálogo global M6+ (USGS e suplementos verificados); não mostra sismos brasileiros dentro do replay mundial.
- Novo botão **Replay · Último sismo no Brasil (72 h · qualquer magnitude)**: consulta fontes brasileiras USP/RSBR, USGS BR, EMSC e GEOFON pelo mesmo catálogo do monitor/Telegram, sem magnitude mínima, e mostra o evento mais recente com rótulo REPLAY, seu horário original e sem novo alarme.
- A consulta de voz de **sismos no Brasil nas últimas 24 h** segue independente e pode exibir até cinco registros; **não** substitui o replay de 72 horas.
- O cache local só pode substituir o resultado remoto se o evento for da categoria correta, tiver data válida e estiver dentro das últimas 72h.
- Consultas sem fontes não são apresentadas como ausência confirmada de tremores; uma ocorrência pode não aparecer se a fonte falhar ou ainda não tiver publicado o registro.
- Quando a janela externa do reconhecimento de fala devolve cancelamento sem transcrição, o aplicativo tenta uma vez o serviço de voz interno do Android e solicita permissão de microfone quando apropriado. Caso o Fire OS não disponibilize o microfone para aplicativos externos, informa a limitação — **não é possível prometer que o microfone do Fire Stick funcione fora da Alexa**.
- Cards, sobreposição, som dos alertas reais, períodos de exibição e prioridade de tsunami permanecem inalterados.

## Dependências para teste no aparelho

A atualização precisa de **dois componentes** publicados:
1. Worker com as rotas `view=brazil-replay` e `view=global-replay`.
2. APK 1.0.64 assinado pelo mesmo certificado do canal oficial e publicado junto ao manifesto de atualização.

Sem a nova versão do Worker, as consultas destes botões devem ser tratadas como indisponíveis; não podem cair silenciosamente em um replay de M6+.

## Teste

1. Atualize pelo botão oficial sem desinstalar o aplicativo.
2. Em **Replay e Resumos Sísmicos**, escolha **Replay · Último sismo no Brasil (72 h · qualquer magnitude)**. Volte ao programa; o card aparece após 10 segundos, quando houver evento confirmado e não houver outro aviso prioritário.
3. Confira a data, magnitude e local do sismo. Não invente M1,8 se nenhuma fonte responder.
4. Teste separadamente **Replay · Último sismo M6+ mundial (72 h)**.
5. Teste **Falar com o Monitor Global** no Fire TV. Caso o Fire OS não libere o microfone, use os botões até integrar Alexa/Gemini com uma ponte autorizada.

Testes automatizados: `tests/unit/tv-history.test.mjs`, `ReplaySelectionTest.java` e os workflows de Android TV/Worker.
