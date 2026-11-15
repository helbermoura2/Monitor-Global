# Argos Orbis Celular · 0.1.21 de teste

O nome exibido pelo Android nas notificações e no ícone agora é **Argos Orbis** (sem o sufixo “· Teste”). O aplicativo agora usa o símbolo Olho de Argos e o nome Argos Orbis no Android. Continua sendo uma prévia, identificada no número da versão **0.1.21-teste** dentro de **Avisos e fontes**, e mantém o mesmo pacote e certificado para atualização sem perder dados. As notificações de teste local continuam explicitamente identificadas como testes; os boletins normais não recebem essa marca.

## Correções preservadas da 0.1.14

Leitura de chuva unificada na tela Tempo e no Início.

- Condições de chuva usam a previsão por minuto quando ela está disponível; uma condição do modelo horário, como garoa, não é apresentada como chuva agora quando a série por minuto indica chegada posterior.
- Acumulados dos próximos 30 e 60 minutos, gráfico, distribuição entre as duas meias horas e intensidade máxima vêm da mesma série e do mesmo instante de referência. Volume em mm é separado de intensidade em mm/h.
- A projeção textual de 30 minutos que vinha de outra consulta deixa de aparecer acima do quadro de chuva. Narrativas horárias com afirmações de precipitação não substituem a leitura por minuto; contexto de IA sobre outros dados horários continua disponível quando válido.
- A chuva aparece antes das próximas horas. Falha ao carregar os dados horários é identificada como falta de dados, sem sugerir tempo seco, e oferece nova tentativa. Consultas interrompidas não mantêm um bloqueio de cinco minutos ao voltar à tela.
- As colunas horárias têm intervalos explícitos e volumes por uma hora, diferenciando-os da janela móvel de 60 minutos.

Exemplo de interpretação: 0,1 mm nos próximos 30 minutos e 1,3 mm nos próximos 60 minutos indicam 1,2 mm estimados na segunda meia hora; não significam intensidades instantâneas diferentes. Os valores reais do aplicativo continuam vindo das fontes, sem números de exemplo inseridos na interface.

Mantém radar e notificações da versão anterior e a mesma assinatura para atualização. Previsões são estimativas para um ponto da Liberdade, São Paulo, sujeitas a mudanças.

A tela principal agora usa o olho oficial compacto; o cabeçalho e as páginas de avisos mostram `argosorbis.com.br`, e os botões públicos levam a `https://argosorbis.com.br/` e `https://t.me/argosorbis`. O pacote e os tópicos históricos de notificações permanecem inalterados para preservar as atualizações e assinaturas existentes.

## Correção visual dia/noite
O desenho do tempo agora usa a posição solar calculada para a Liberdade, São Paulo, na hora consultada. Nas condições de céu limpo ou parcialmente nublado, mostra **lua à noite** e **sol de dia**, inclusive na previsão por hora. Os dados, nomes das condições, horários da previsão e alertas continuam vindos das mesmas fontes; não muda nenhuma informação meteorológica. O cálculo não depende do fuso definido no aparelho nem exige acesso à localização ou rede adicional.

## Logo oficial animado no cabeçalho
O olho do Argos Orbis usa a mesma ilustração vetorial nativa da TV: o ponteiro gira, os anéis permanecem parados e o olho pisca discretamente. A animação para quando o app fica invisível e respeita as animações desativadas do Android. Não há GIF, downloads de imagens ou mudanças nas notificações e APIs.

## Ícone de instalação — opção 3
Ícone do lançador Android atualizado com fundo preto quase puro, brilho ciano discreto atrás do olho/radar e contorno dourado. Atualização visual aplicada também à Android TV. O logo animado do cabeçalho permanece como antes; o ícone de instalação é estático, conforme o Android.

## Mapas avançados do Brasil · 0.1.21
- Contornos estaduais (27 UFs) com nome da UF e cores de alto contraste; fonte: malhas simplificadas do IBGE, empacotadas no APK. Consulta offline mesmo sem conexão para as linhas.
- Municípios visíveis a partir de zoom 8, **somente no estado enquadrado**, para economizar memória e bateria. SP (645 municípios) vem no APK; os demais estados são baixados sob demanda de um conjunto público GeoJSON versionado e imutável. Se a rede falhar, o app mantém os limites estaduais.
- Menu **Limites: desligados / estados / municípios**, em mapa de eventos, chuva e meteorologia brasileira; seleção de áreas mostra município/UF e coordenadas. Ao selecionar um município no mapa meteorológico, aparece um botão de consulta da previsão pontual (sem consultar automaticamente).
- Marcadores sísmicos agrupados em zoom baixo; toques exibem magnitude, profundidade, fonte e data reais, com botão Ver detalhes. Filtros por Brasil, 1h/24h/7d disponíveis e magnitude mínima, condicionados aos dados recebidos.
- Controles compactos, mapa mais alto, legenda e transparência do satélite; navegação 'Clima' e manutenção da identidade Argos Orbis.
- Previsão pontual Open-Meteo do município selecionado: novos campos **umidade, sensação térmica e rajadas** se fornecidos pela fonte. Ausências são exibidas como traço, sem interpolação ou suposições.
- Satélite e radar são **imagens observadas**, enquanto chuva em minutos e a meteorologia da cidade são **previsões de modelos**; escalas/cores de imagens não representam diretamente risco meteorológico.

**Limites:** As malhas simplificadas servem à orientação visual, não a decisões cadastrais; podem estar desatualizadas. O filtro "7 dias" atua apenas sobre os eventos presentes no catálogo consultado, sem prometer histórico completo. A busca municipal permanece acessível para localidades sem contorno disponível.

A versão mantém o mesmo pacote de testes, push, assinatura e canal de atualização; não altera Cloudflare, Alexa, Worker, localização nem exige chave paga.
