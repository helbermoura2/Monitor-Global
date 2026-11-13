# Monitor Global Celular · 0.1.12 de teste

Notificações por categoria: sismos, tsunami, chuva, boletins horários do tempo e resumo diário de sismos.

Em **Avisos → Notificações no celular**, ative os avisos, conceda a permissão do Android e selecione as categorias. A inscrição no Firebase precisa ser confirmada. Configurações existentes de ativação são preservadas na atualização; quem já ativou os avisos recebe as novas categorias, que podem ser desligadas individualmente.

- **Sismos e tsunami:** critérios do catálogo atual, com deduplicação e acompanhamento de boletins.
- **Chuva na Liberdade, SP:** chegada ou condição estimada atual, acumulado dos próximos 60 minutos, intensidade, duração e término previstos quando disponíveis. Mudanças relevantes respeitam intervalo mínimo de dez minutos e a previsão ativa pode ser lembrada após uma hora. Sem estimativa de chuva na próxima hora é informado como previsão, não como confirmação de que a chuva local acabou.
- **Tempo na Liberdade, SP:** boletim uma vez por hora, exceto à meia-noite, com temperatura, sensação, umidade, vento e rajadas disponíveis. Não é observação de estação.
- **Resumo diário:** após 00:05 BRT, até cinco maiores sismos disponíveis do dia anterior em Brasília. Não é contagem de todos os eventos.

Ao tocar na notificação, o aplicativo abre o tempo ou o resumo correspondente. Previsões vencidas ou inválidas não geram mensagens de tempo seco. As mensagens expiram; fontes indisponíveis não viram dados inventados.

O push funciona sem manter o aplicativo na tela, sujeito à conexão, ao Firebase e às restrições do Android. Parada forçada pode impedir o recebimento até a próxima abertura. O teste local não comprova entrega pelo Firebase; o recebimento real precisa ser confirmado em um aparelho.
