# Chuva unificada na barra — 25/10/2026

A barra não combina mais o acumulado previsto pelo produto horário com a classificação do produto por minuto. Um único trecho apresenta, por exemplo, “Chuva forte · agora · 12 mm/h estimados”, com a taxa e a classificação provenientes do mesmo intervalo Rainbow. O exemplo não é uma medição de pluviômetro nem acumulado da última hora. Sem dado recente e compatível com o local, mostra indisponibilidade; não substitui silenciosamente por chuva de modelo horário nem transforma falha em tempo seco.

A previsão horária continua nos detalhes, identificada com fonte e horários. Temperatura, sensação e umidade permanecem no produto horário Rainbow e nas reservas já existentes. Vento e rajadas são identificados separadamente; velocidade ausente não é preenchida com a rajada e ausência não vira zero. Tooltips mostram fonte, geração e hora de referência quando disponíveis. O fallback Open-Meteo também solicita velocidade do vento, sem adicionar outra consulta.

O celular usa os mesmos textos e critérios; a barra permite quebra de linha para preservar leitura de classificação/unidade. O campo antigo de chuva horária foi removido da barra. Atualizações de dados não mudam a fonte usada para classificar a chuva por minuto.

A apresentação reaproveita consultas, cache e temporizador de atualização existentes. Não acrescenta coleta, aumenta cotas ou altera a câmera. Atualizações idênticas não reescrevem os textos da barra, evitando reconstruir o painel/gráfico por observadores do DOM.

Validação: testes de contraste entre modelo horário (0,3 mm) e minuto (12 mm/h), ausência/vencimento/local diferente, vento versus rajada, zero válido, fontes meteorológicas, gráfico de chuva e leitura em celular/desktop, com tráfego externo bloqueado. A precisão meteorológica na rua depende da fonte e não é comprovada por testes de interface.

A execução ampliada também encontrou uma expectativa antiga em um teste de vulcões (“NOVA ATIVIDADE” versus “Lava reportada”). A mesma falha foi reproduzida na árvore sem estas alterações, commit a540129; não foi corrigida nem contada como aprovação. O workflow desta mudança seleciona os nove cenários meteorológicos, sem alterar o teste de vulcões.
