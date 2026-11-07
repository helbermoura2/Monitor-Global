# Validação de cache sísmico e reconexão — 07/11/2026

## Comportamento exigido
- A página deve mostrar dados sísmicos **ao vivo** somente depois de pelo menos uma resposta de fonte sísmica na rodada atual. Um evento `online` do navegador apenas inicia a consulta; não confirma a fonte.
- Em falha total, preservar eventos já visíveis, sem inventar horário `Date.now()`. A idade exibida deve continuar crescendo desde a última atualização sísmica confirmada.
- O snapshot offline pode ser atualizado por INMET, clima ou a cada três minutos, mas **seu horário de gravação (`t`) não pode renovar o horário verificado dos terremotos (`quakeAt`)**.
- Dados sísmicos com mais de seis horas desde a última confirmação não devem ser restaurados do armazenamento. Alertas e clima no snapshot continuam tendo o comportamento independente e o próprio prazo agregado de seis horas.
- Cache legado v2 com `sismoSuccess` válido continua legível; cache com data sísmica desconhecida nunca é classificado como ao vivo.
- Quando uma fonte sísmica voltar a responder, `fetchGlobalFeeds` redefine o modo cache, marca o horário da nova resposta e mantém a lógica usual de seleção, câmera e alertas.

## Mudanças
- `js/inmet-avisos.js`: snapshot v3 com `t` e `quakeAt` distintos; restauração valida ambos; a reconexão não elimina o indicador de cache antes da resposta das fontes.
- `js/orquestrador-feeds.js`: falhas retêm o horário real e o motivo, sem simular sucesso. A primeira resposta confirmada limpa o estado de cache.
- `js/enhancements-4413.js` e `js/painel-e-lista.js`: mesmo sem horário confirmado, a interface mostra explicitamente o estado de cache/indisponibilidade, nunca um selo de sismo atualizado.
- `tests/unit/seismic-offline-freshness.test.cjs`: cenários de offline/reconexão/snapshot legado/expiração/recuperação, inteiramente simulados e sem chamadas a fornecedores oficiais.

## Verificação
1. `node --test tests/unit/seismic-offline-freshness.test.cjs tests/unit/mobile-static-cache.test.cjs`.
2. Executar a suíte Smoke test com Playwright no PR e revisar eventuais regressões de tela, fontes e mapas.
3. Depois do merge/deploy aprovado, em celular, interromper a internet, confirmar estado cache e idade crescente, voltar à rede e confirmar que somente uma consulta sísmica bem-sucedida altera para ao vivo. Não é necessário enviar alertas Telegram de teste.
4. Não alterar os 45 segundos do ciclo sísmico, o escopo do Service Worker, a atualização Android TV, os tetos Free ou as regras de prioridade.

## Limitações
Os testes acima validam a lógica em ambiente simulado. Não constituem prova de todas as fontes funcionando em produção nem de navegação real de horas num aparelho. Nenhuma requisição sísmica foi disparada por esta alteração. O histórico de cache v2 cuja última consulta sísmica nunca foi registrada é tratado como **não confirmado**, não como atual.

## Reversão
Se houver regressão, reverter o PR e aguardar a publicação do frontend. Não remover dados locais, resetar KV/Durable ou reinstalar a Android TV.
