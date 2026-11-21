# Argos Orbis Celular · 0.1.43 de teste

- Corrige o PNG do Subsolo 3D para preservar título, localização e moldura.

# Argos Orbis Celular · 0.1.42 de teste

- Formulário de lugares salvos com o visual do aplicativo.
- O Subsolo 3D exibe dados do catálogo e exporta a vista atual em PNG pelo compartilhamento do Android.

# Argos Orbis Celular · 0.1.41 de teste

- Nova aparência para navegação, botões e detalhes do sismo, com painéis próprios para análise e subsolo 3D.

# Argos Orbis Celular · 0.1.40 de teste

- Subsolo 3D e tour nos detalhes de sismos com coordenadas. A visualização usa a profundidade do catálogo e permite alternar entre topo e corte.
- Lugares salvos com raio e magnitude configuráveis. A verificação em segundo plano usa o catálogo USGS.

# Argos Orbis Celular · 0.1.39 de teste

- Quando o ShakeMap não chega a tempo, o vídeo pode mostrar faixas de intensidade estimadas a partir de magnitude, profundidade e distância ao epicentro.

# Argos Orbis Celular · 0.1.38 de teste

- O replay mostra a evolução do modelo oficial de ruptura ou revela as áreas por intensidade do ShakeMap, conforme os dados disponíveis.

# Argos Orbis Celular · 0.1.37 de teste

- O replay mantém o card cartográfico do compartilhamento, com animação contida no mapa.

## Argos Orbis Celular · 0.1.36 de teste

- Novo vídeo de sismo com mapa em tela cheia e revelação da intensidade. O botão de vídeo aparece para sismos brasileiros e eventos M6+ com coordenadas.

## Argos Orbis Celular · 0.1.35 de teste

- A análise sísmica identifica os dados do catálogo, os tópicos selecionados pela IA e as explicações científicas do Argos Orbis.
- O compartilhamento de eventos abre o seletor do Android com o PNG cartográfico. O renderizador tenta novamente com a arte incluída no app se a primeira geração falhar.

## Argos Orbis Celular · 0.1.34 de teste

- O cartão cartográfico de compartilhamento vem incluído no aplicativo. Os mapas continuam sendo consultados no momento da geração.

## Argos Orbis Celular · 0.1.32 de teste

- **Compartilhar evento** gera uma imagem cartográfica vertical para sismos e boletins de tsunami e abre o menu de compartilhamento do Android.

## Histórico · 0.1.27 de teste

- A barra inferior reúne **Início, Sismos, Clima, Avisos e Mais**. O mapa sísmico fica em Sismos. Os mapas de chuva e satélite ficam em Clima e preservam a aba ativa.
- Avisos dá acesso direto a tsunamis, boletins e resumo diário. Mais reúne notificações, atualização, diagnóstico e o canal oficial.
- Listas mais compactas, tipografia legível, controles com feedback de toque, indicador animado da aba ativa e um pulso discreto ao selecionar um epicentro. A interface respeita a opção de reduzir movimento e preserva a animação oficial do olho.
- Quem já usa a prévia pode atualizar em **Mais → Atualização do aplicativo** depois de instalar esta versão. Na versão anterior, a opção está em **Avisos → Configurar notificações → Informações técnicas e atualização do aplicativo**.

## Histórico · 0.1.23 de teste

O nome exibido pelo Android nas notificações e no ícone agora é **Argos Orbis** (sem o sufixo “· Teste”). O aplicativo agora usa o símbolo Olho de Argos e o nome Argos Orbis no Android. Continua sendo uma prévia, identificada no número da versão **0.1.23-teste** dentro de **Avisos e fontes**, e mantém o mesmo pacote e certificado para atualização sem perder dados. As notificações de teste local continuam explicitamente identificadas como testes; os boletins normais não recebem essa marca.

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


## Mapa de eventos mais limpo · 0.1.22

- Controles de limites estaduais/municipais e filtros ficam recolhidos inicialmente. Painel de imagens de satélite menor e janelas de eventos livres de sobreposições.
- Remove a duplicidade de zoom do Android WebView, preservando os controles nativos do mapa.
- O mapa abre com foco no Brasil; o botão **Enquadrar eventos** permite visualizar o catálogo disponível no mundo.
- Boletins oficiais de tsunami **sem ameaça**, informativos, encerrados ou sem classificação confirmada ficam no histórico, não como pinos que pareçam aviso ativo; mapa conserva avisos de tsunami classificados como warning/watch/advisory. Data e fonte dos boletins são preservadas.
- Nenhuma alteração de provedores, critérios de aviso, Worker ou notificações. A série de eventos continua limitada aos itens realmente retornados pela fonte.


## Chuva: redesenho fiel à identidade Argos Orbis · 0.1.23

- Nova disposição do radar no mapa com fundo preservado, bordas arredondadas, selo discreto “Chuva na região”, chip recolhível de divisões IBGE, zoom e centralização agrupados, horário e fonte no próprio rodapé do mapa e legenda compacta sem esconder a precipitação.
- Barra de histórico/previsão mais legível com controles de reprodução, relógio da fonte e atualização preservados.
- Card de previsão passa a mostrar um título mais curto e cauteloso em horas/minutos, acumulado em mm durante o período realmente disponível e horário/intensidade do pico em mm/h quando presentes, mantendo o gráfico por minuto fiel aos dados (sem inventar suavização).
- Quando acessado pela aba Mapa, remove o botão de voltar redundante e libera altura; o acesso vindo da aba Clima preserva retorno compacto.
- A foto do novo layout era apenas um exemplo de design: **nenhum valor de 9,7 mm, previsão às 20:30 ou imagem de chuva ilustrada foi codificado como dado real**. A tela consulta as mesmas rotas Rainbow Weather e continua identificando falhas ou desatualização.
- Mesmo package, mesmo canal de atualização e mesmo fluxo de assinatura e notificações. Nenhuma alteração na TV, Cloudflare, alertas sísmicos ou Telegram.
