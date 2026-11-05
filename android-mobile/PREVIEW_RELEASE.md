Monitor Global para celular · Android de teste 0.1.5.

- Nova prévia em Tempo → Explorar mapa de chuva: mapa independente, sem rotação automática dos eventos.
- Linha do tempo com histórico de até uma hora e previsão de até duas horas, reprodução sob comando e horários de Brasília.
- Gráfico por minuto para um ponto da Liberdade, acumulado em milímetros, chegada, aumento sustentado e duração estimados quando os dados permitem.
- Mapa e gráfico identificam a fonte Rainbow Weather; quadros ausentes e previsões vencidas aparecem como indisponíveis.
- Consultas e reprodução pausam ao sair da tela. Não há consultas novas por IA nem nova assinatura paga.

- Arquivos locais do mapa identificados por versão, para evitar recursos antigos após atualizar o aplicativo.
- Controles do satélite acessíveis com a lista de eventos vazia; falhas de inicialização agora têm mensagem e opção de recarregar.
- Satélite infravermelho GOES-East sobre o Brasil, com quadros e legenda da NASA/NOAA. Use o botão Brasil no mapa para enquadrar o país.
- Horário real do quadro em Brasília; a fonte pode apresentar defasagem. Não é radar de chuva.
- Animação curta sob comando, recorte nacional e pausa em segundo plano.
- Notificações de sismos e boletins de tsunami por Firebase Cloud Messaging, mediante ativação em Avisos e permissão do Android.
- Toque no aviso para abrir os detalhes do evento. Revisões não repetem o som do mesmo evento.
- Teste local disponível em Avisos; ele verifica a notificação no aparelho, não a entrega pelo Firebase.
- Início, mapa, eventos e meteorologia da Liberdade, São Paulo, preservados.
- Pacote independente top.monitorglobal.mobile.dev. A versão 0.1.5 corrige a persistência da chave de assinatura dos testes. Para migrar de versões anteriores, remova o app de teste antigo antes de instalar este APK e ative as notificações novamente em Avisos. As próximas publicações verificam a assinatura antes de liberar o arquivo.

A entrega depende da conexão, do Android e dos serviços externos; não há garantia de alerta instantâneo. Forçar a parada do aplicativo pode impedir mensagens até abri-lo novamente. O envio real deve ser confirmado no aparelho.

APK de teste fora da Play Store. Abra o arquivo baixado e autorize a instalação pelo aplicativo que abriu o APK, se solicitado. Esta migração exige reinstalar o app de teste porque os APKs antigos usavam outra assinatura.
