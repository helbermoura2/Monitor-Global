# Diagnóstico — idade do cache sísmico e recuperação da conexão (07/11/2026)

## Falhas reproduzíveis identificadas no código
1. `salvarCacheOffline()` sobrescrevia `t` com a hora da gravação, mesmo depois de fonte indisponível. O snapshot periódico (3 minutos) e o evento `offline` podiam fazer um catálogo velho aparentar ter sido coletado agora. O histórico guardava `sismoSuccess`, mas `restaurarCacheOffline()` ignorava esse campo.
2. O evento `online` desligava `__sismoUsingCache` imediatamente, sem confirmação de que qualquer uma das 15 fontes sísmicas houvesse respondido. O painel podia deixar de distinguir dados retidos de dados ao vivo durante a reconexão.
3. A rodada com nenhuma fonte válida usava `Date.now()` como substituto da última atualização confirmada em um caso de fallback. Um erro inesperado podia também omitir o carimbo do cache nos indicadores.

## Tratamento mínimo
- Gravar snapshot se existe consulta sísmica anterior válida, ainda dentro das 6 h, **mesmo quando o site já está exibindo dados retidos**: assim novos avisos meteorológicos podem ser preservados. O campo `t` mantém a hora da última consulta sísmica válida e nunca é renovado por gravações sucessivas; `savedAt` registra separadamente a hora da gravação.
- Na restauração, usar `sismoSuccess` dos snapshots legados v2 quando existir, para evitar que gravações posteriores renovem artificialmente a validade. Recusar snapshots sem horário válido, do futuro e com idade acima de 6 h.
- Manter indicador explícito de cache enquanto a conexão volta. Só a recuperação de uma fonte real em `fetchGlobalFeeds()` retira o indicador.
- Nas falhas totais e exceções, preservar o último horário conhecido; nunca inventar `Date.now()` como sucesso.
- Não alterar as regras, intervalos, filtragem ou deduplicação de sismos, tsunami, Telegram, TV nem parâmetros do Cloudflare Free.

## Testes
- `node --test tests/unit/offline-seismic-freshness.test.cjs`: timestamp verificado, snapshots periódicos durante indisponibilidade, reconexão sem feed, cache legado v2, dados expirados e horários futuros.
- O workflow `Smoke test` já executa `tests/unit/*.test.cjs` e `tests/unit/*.test.mjs`, além do Playwright. Não é necessário acrescentar nova workflow nem mandar notificações reais.
- Testes existentes de Service Worker continuam relevantes: `tests/unit/mobile-static-cache.test.cjs` e `tests/mobile-static-cache.spec.js` (HTML rede prioritária, scripts versionados em cache, dados ao vivo não armazenados).

## Evidências e limitações
Esta é uma correção do código e testes simulados. O indicador de navegador `navigator.onLine` informa apenas conectividade; não garante que USGS/EMSC/GEOFON/IGP tenham respondido. Uma sessão real com queda/reconexão continua sendo evidência adicional útil, mas nenhuma fonte real precisa ser desligada.

Reversão: reverter o PR e republicar apenas o frontend estático `monitor`, mantendo o backend e canais de alerta intactos.
