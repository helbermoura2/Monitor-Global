# Diagnóstico local no aparelho

Menu → Desempenho no aparelho → Iniciar diagnóstico (também disponível em Mais/Ferramentas). Usar o site normalmente por algumas horas; voltar ao mesmo menu e exportar o relatório JSON para compartilhar manualmente. Fechar a janela de diagnóstico mantém a coleta ativa. Parar encerra a coleta e preserva o relatório; Iniciar nova medição o substitui. Apagar remove o relatório e para a coleta.

Desativado por padrão. Não faz fetch, beacon, WebSocket, testes de alerta ou gravações remotas. Não altera o Worker e não usa Durable Objects/KV. Um único relatório no localStorage deste navegador, até 288 amostras (últimas 24 horas se a tela ficar visível continuamente). Continua após recarregar o site se estava ativo; não mede tempo com o navegador fechado. Armazenamento bloqueado é indicado na janela; nesse caso exportar antes de sair.

- Agrega duração visível, oculta e intervalos sem observação. Saltos do relógio monotônico maiores que dois minutos são classificados como pausas não observadas, não como travamentos ou tempo de uso confirmado.
- Amostra callbacks requestAnimationFrame por um segundo a cada minuto, somente com a tela visível. Os intervalos incluem trabalho do navegador e do monitor; não são FPS contínuos ou exclusivos do globo. Cancela a janela ao ocultar a tela ou parar.
- Observa tarefas longas, erros de código, rejeições sem tratamento, falhas de recursos, eventos de erro do mapa e perda de contexto WebGL, enquanto ativo e conforme suporte.
- Contagem e duração agregadas de recursos já solicitados pelo site. Códigos HTTP só quando expostos pelo Resource Timing; não intercepta nem repete requisições. CORS e suporte do navegador limitam essa medição.
- A cada cinco minutos visíveis, guarda heap JavaScript quando disponível, número de elementos/canvas, conectividade e contagens da saúde das fontes já existentes. Não consulta fontes para medir. Memória ausente é `null`, não zero.
- Salva agregados uma vez por minuto, ao mudar de visibilidade, sair ou exportar. O horário de navegação refere-se à visita atual; erros e contadores são acumulados desde o início da medição.

Não inclui coordenadas, identificação de eventos, conteúdo de alertas, URLs de requisições, mensagens/stack de erros ou credenciais. Inclui navegador/user-agent, viewport, DPR, memória/capacidade de hardware aproximadas quando disponíveis e horários para contextualizar o aparelho. Não mede bateria, temperatura, GPU, memória total, consumo de outros processos, nem consumo da conta Cloudflare. Exportar não envia automaticamente para ninguém.

Validação: `tests/local-performance-diagnostics.spec.js` usa página local isolada, verifica ausência de chamadas adicionais, exportação válida, persistência, parada, limpeza, suporte ausente e limite do histórico; não toca serviços de produção.

Coletor 2 (2026-10-21): mantém categorias fixas de recursos (satélite, rótulos, vetores, radar, mídia dos efeitos, bandeiras, dados locais, API do Worker, outras APIs, arquivos locais, outras imagens/mídias e outros). Guarda somente contagens, duração somada, erros HTTP e bytes disponibilizados pelo navegador. Zero bytes em fonte externa não é tratado como cache. `categoryStartedAt` e `categoryCount` delimitam o período categorizado ao retomar um relatório antigo. Não extrapolar contagens de recursos para operações Durable/KV; cargas podem vir de cache e operações internas do servidor não são visíveis aqui.

As amostras incluem contagens de fontes/camadas/imagens do mapa, marcadores e animações, DPR efetivo e estado da economia, sem conteúdo de eventos ou geometrias. O heap do Samsung Internet pode ser aproximado, agregado e atualizado em degraus: seu aumento isolado não comprova retenção. DeX pode informar Linux/desktop no user-agent e usar layout desktop apesar de executar num telefone. `deviceMemory` é uma indicação aproximada do navegador, não inventário da RAM física.
