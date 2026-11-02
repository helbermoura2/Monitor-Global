# TV 1.0.45 — avisos sísmicos e meteorologia

Implementa os três exemplos aprovados: cartões sólidos com faixa ciano, corpo azul-escuro e rodapé escuro unidos, cantos inferiores discretos e ícones vetoriais locais.

O aviso sísmico regional destaca a magnitude em âmbar e apresenta a bandeira do país identificado junto à localização. Dados ausentes continuam desconhecidos. Fonte, profundidade, horário BRT e área monitorada permanecem disponíveis; magnitude não é tratada como estimativa de danos. A bandeira é liberada ao fechar o aviso.

A meteorologia destaca temperatura e condição, com sensação, umidade, vento e rajadas. Ícones seguem a condição conhecida; a condição desconhecida não vira céu nublado. As datas do modelo e a fonte permanecem explícitas. Falta de chuva por minuto não vira tempo seco.

O card da chuva mantém chegada, acumulado dos próximos 60 minutos e término, e adiciona duração estimada. Para chuva futura, a intensidade é a do início previsto; a intensidade atual zero não é reutilizada. Para chuva já em curso, a duração é a restante. Pausas curtas são rotuladas como janela, e ausência de término mantém a duração indefinida. Informações de chuva não são escondidas quando há previsão horária.

Mantém 8 segundos no aviso regional e 12 segundos no meteorológico, prioridade sísmica, atraso manual de 10 segundos, horas cheias de Brasília e 00h05, permissão de sobreposição, animações reduzidas e chuva em tela inteira sem raios. Não há novas fontes nem aumento da cadência de consultas.

Prévia ilustrativa: docs/previews/tv-avisos.html?v=1045. Os testes gráficos exportam os cartões no artefato monitor-global-tv-cards-review. Não equivale a teste em aparelho físico. Publicação do APK oficial pelo workflow de lançamento assinado na main, modo publish.
