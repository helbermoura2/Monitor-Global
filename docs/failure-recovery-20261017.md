# Parte 4 — recuperação independente de falhas

## Comportamento

- Falha nos tiles de satélite ou de nomes/fronteiras mostra um aviso sem bloquear o mapa inteiro nem remover registros. A mesma fonte recebe no máximo três tentativas automáticas por episódio, espaçadas em 4, 16 e 60 segundos. Eventos de erro simultâneos compartilham um temporizador por fonte. Um tile carregado com sucesso encerra o episódio.
- Uma tentativa manual reutiliza o orçamento e respeita uma espera mínima. Após esgotar as três tentativas, pode iniciar outro ciclo depois de um minuto. Voltar à conexão abre outro ciclo. A aba oculta suspende temporizadores; sem conexão não dispara downloads.
- Perda do contexto gráfico informa que a lista continua disponível. A recuperação do WebGL cabe ao navegador; o app não promete poder forçá-la. Quando o navegador restaura o contexto, conserva a instância do mapa e suas fontes, redimensiona e pede um novo quadro.
- Os botões de falha em `app-status` e de catálogo vazio deixam de recarregar a página e passam a tentar atualizar o catálogo sísmico existente. Há o mesmo controle na situação das fontes: **Tentar atualizar sismos**. A rodada normal de `fetchGlobalFeeds` mantém sua lógica de mesclagem, retenção e horários válidos. Não dispara duas rodadas simultâneas e exige um minuto entre tentativas manuais.
- Uma tentativa não declara todas as fontes saudáveis: o painel continua mostrando falhas, respostas parciais e os horários reais. Os outros produtos mantêm seus fluxos de atualização existentes. O menu geral de recarga foi preservado.

## Limites

Não recria o mapa, não recarrega a página, não apaga filtros ou o evento selecionado. Não substitui uma biblioteca WebGL que falhou antes de conseguir construir o mapa. Não muda Worker, armazenamento KV, frequência normal dos coletores ou políticas das fontes. Tentativas manuais reais consultam as fontes normais; não representam operações gratuitas. Os testes interceptam ou bloqueiam todas as URLs externas.

## Validação

Testes cobrem tempestade de erros de tiles, limite de tentativas, pausa da aba, sucesso após falha, perda/restauração gráfica, bloqueio de tentativas simultâneas/offline, retenção após rejeição e manutenção do catálogo/câmera/filtros nos layouts 390 e 1280 px. A restauração nativa de WebGL é exercitada pelo recurso `WEBGL_lose_context` do Chromium, quando disponível. Também se verificou a compatibilidade do painel de fontes existente em ambos os layouts.
