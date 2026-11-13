# Monitor Global Celular · 0.1.15 de teste

O nome exibido pelo Android nas notificações e no ícone agora é **Monitor Global** (sem o sufixo “· Teste”). O aplicativo continua sendo uma prévia, identificada no número da versão **0.1.15-teste** dentro de **Avisos e fontes**, e mantém o mesmo pacote e certificado para atualização sem perder dados. As notificações de teste local continuam explicitamente identificadas como testes; os boletins normais não recebem essa marca.

## Correções preservadas da 0.1.14

Leitura de chuva unificada na tela Tempo e no Início.

- Condições de chuva usam a previsão por minuto quando ela está disponível; uma condição do modelo horário, como garoa, não é apresentada como chuva agora quando a série por minuto indica chegada posterior.
- Acumulados dos próximos 30 e 60 minutos, gráfico, distribuição entre as duas meias horas e intensidade máxima vêm da mesma série e do mesmo instante de referência. Volume em mm é separado de intensidade em mm/h.
- A projeção textual de 30 minutos que vinha de outra consulta deixa de aparecer acima do quadro de chuva. Narrativas horárias com afirmações de precipitação não substituem a leitura por minuto; contexto de IA sobre outros dados horários continua disponível quando válido.
- A chuva aparece antes das próximas horas. Falha ao carregar os dados horários é identificada como falta de dados, sem sugerir tempo seco, e oferece nova tentativa. Consultas interrompidas não mantêm um bloqueio de cinco minutos ao voltar à tela.
- As colunas horárias têm intervalos explícitos e volumes por uma hora, diferenciando-os da janela móvel de 60 minutos.

Exemplo de interpretação: 0,1 mm nos próximos 30 minutos e 1,3 mm nos próximos 60 minutos indicam 1,2 mm estimados na segunda meia hora; não significam intensidades instantâneas diferentes. Os valores reais do aplicativo continuam vindo das fontes, sem números de exemplo inseridos na interface.

Mantém radar e notificações da versão anterior e a mesma assinatura para atualização. Previsões são estimativas para um ponto da Liberdade, São Paulo, sujeitas a mudanças.
