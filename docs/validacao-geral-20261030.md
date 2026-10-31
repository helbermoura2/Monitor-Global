# Validação geral — 30/10/2026

Revisão do código publicado a partir de `c8be549`. Plano Cloudflare **Free**, sem mudança de cotas, cadência de alertas ou assinatura Android. As correções de produção atingem somente o site estático. Não foram enviadas mensagens de teste ao Telegram.

## Testes gerais

A suíte contém 544 cenários. O job único anterior foi cancelado após 65 minutos; agora a suíte é dividida em três partes, com dois navegadores por runner, sem excluir cenários. As verificações Node/Python comuns rodam apenas na primeira parte. Relatórios usam nomes diferentes para evitar conflito entre partes.

As expectativas sísmicas antigas ainda exigiam clones do cartão inteiro, seu desaparecimento e duração anterior do modo automático. O efeito aprovado desde os PRs 483/484 utiliza palavras decorativas e mantém o cartão disponível. A regressão passa a verificar palavras, texto original, controles, movimento reduzido, revisões, interrupção e limpeza. A medição de cobertura inclui o vídeo que fica sob o shader; medir só a camada transparente produzia um falso vazio. O cenário de tsunami visual agora fornece um boletim oficial de ameaça, em vez de um registro agregado sem situação confirmada. Os testes específicos de ausência de ameaça continuam separados.

Os 13 cenários sísmicos, seis cenários de vento e quatro verificações corrigidas de composição/paridade passaram em execuções locais direcionadas. A digitação do título também é aguardada antes de contar suas letras. Isso não equivale à aprovação da suíte completa. A rodada geral final é [41066152666](https://github.com/helbermoura2/Monitor-Global/actions/runs/41066152666).

A rodada completa terminou, sem cancelamento: **433 aprovados, 110 falhas e um instável, total 544; nenhum ignorado**. O grupo separado de materiais aprovou os 58 cenários. Esses totais valem para o commit `9c71b41`, antes das correções direcionadas posteriores. [Inventário da suíte](audits/general-validation-suite-20261030.json). A validação geral permanece aberta; não se encerrou a issue #327.

As falhas não são todas regressões do produto. Entre elas há expectativas de país incorreto para coordenadas chilenas, texto/precisão antigos, nomes de API aposentados, imagens salvas numa pasta exclusiva do ambiente local e relógios simulados congelados antes da consulta entre abas. As verificações de frentes P/S e radar legado também precisam ser migradas: `showEventDetails` agora retorna após iniciar `SeismicPaintTour`, e os antigos caminhos continuam somente como reserva. Não se reintroduziu comportamento antigo da câmera para satisfazer essas expectativas.

As correções já verificadas incluem renderizadores sísmicos/meteorológicos, imagens e fontes, coordenadas com tolerância numérica submilimétrica, horários de teste TSE compatíveis com 16h55 BRT, cache entre abas antes do flip e o resolvedor de profundidade. Resultados e limites no [registro sanitizado](audits/general-validation-20261030.json).

## Falhas reais corrigidas no site

- **Revisões falsas:** a solução sísmica selecionada de 16 km podia herdar `depthReported=10` de outro relatório. O valor visível e o usado na classificação divergiam, gerando falsas revisões. Agora a profundidade reportada acompanha a solução escolhida; zero, negativo e valor ausente continuam distintos. O teste de ingestão, sem afrouxar suas expectativas, passou por 12 alternâncias sem aviso falso e aceitou a revisão verdadeira M6,3 → M6,2. A comparação de status de revisão também usa o identificador nativo, separando estimativa rápida e solução sísmica da mesma agência.
- **Borda durante rajada:** o CSS compartilhado sobrescrevia a origem da rotação do vento. O cartão podia sair alguns pixels da tela. A regra específica mantém a âncora; a regressão acompanha cinco segundos da rajada.
- **Carga sem animação:** a pré-carga do renderizador era disparada mesmo com movimento reduzido. Ela agora respeita essa preferência. Os seis cenários de carregamento opcional passaram.

São correções locais: não acrescentam coleta, timers de produção, KV, Durable, serviços pagos ou consultas de população. Não se promete redução percentual de consumo antes de medir. As equações sísmicas e a câmera aprovada não foram alteradas.

## Worker e fontes

A primeira captura passiva durou 301 segundos: **37 execuções, todas `ok`**. A sessão temporária foi removida. Não houve testes de carga, gravação de parâmetros/cabeçalhos ou alteração dos filtros de builds. A segunda janela observou mais 31 execuções, também todas `ok`: 68 no total, em duas janelas de cinco minutos. Amostras sem excesso não identificam a causa dos excessos históricos.

O coletor ganhou classificação explícita de `/tv-rain` e `/tv-weather`, antes agrupadas em `other`. Isso altera somente o diagnóstico executado no Actions, sem custo adicional por acesso ao aplicativo e sem deploy do Worker.

Na leitura de 30/10, os sete catálogos sísmicos retornaram sucesso. Os seis feeds diretos de tsunami retornaram HTTP 403; o catálogo oficial alternativo do NWS respondeu sem produtos recentes nessa leitura. A cobertura é **parcial**, não ausência confirmada de ameaça. Na coleta geral, NHC/GDACS/EONET responderam; NWS e o feed agregado de tsunami estavam indisponíveis. Não se declarou recuperação desses provedores nem se substituiu dado oficial por estimativa.

Os quatro JS/CSS visuais comparados são idênticos à main. O HTML tem uma diferença identificada: o script de analytics inserido pela hospedagem Cloudflare. Não é uma alteração do código de apresentação.

A consulta de cotas às 13h36 UTC registrou, para 29/10 completo, **39.368 chamadas Worker (39,37%), 2.940 solicitações Durable (2,94%) e 84 gravações KV (8,4%)**; o parcial de 30/10 ainda contém uma ocorrência de `exceededResources`. O agregado não identifica sua rota. Não se declarou economia percentual causal ou encerramento do incidente.

População permanece o maior consumidor Durable: **1.827 solicitações, 62,14%** em 29/10. Não há economia percentual comprovada após as mudanças. As famílias meteorológicas registraram 99 solicitações de nowcast e 19 de produtos horários naquele dia; esses números compartilhados não são atribuição exclusiva à TV.

## Memória dos aparelhos

Reanalisados os cinco arquivos enviados pelo dono:

| Aparelho / versão | Janela retida | PSS pico → final | Limite da evidência |
| --- | --- | --- | --- |
| TCL 1.0.19 | 5,23 h | 47,40 → 33,16 MiB | Sem tarjas nesse período |
| Fire Stick 1.0.19 | 6 h de 736 leituras | 40,54 → 22,04 MiB | Sem tarjas nesse período |
| TCL 1.0.20 | 5,35 h | 69,83 → 69,66 MiB | Termina durante desenhos da tarja |
| Fire Stick 1.0.20 | 5,28 h | 49,72 → 49,72 MiB | Termina durante desenhos da tarja |
| Fire Stick 1.0.21 | 7 min | 56,73 → 35,69 MiB | Recuperação parcial após a tarja; janela curta |

As medianas do primeiro e último quarto dos registros longos permanecem próximas. Isso sustenta estabilidade nas condições registradas, não ausência universal de vazamento. PSS, heap Java e alocações nativas são medidas diferentes; não se somam. Intervalos de desenho não são FPS completo nem medição da GPU.

As 20 verificações locais de memória, áudio, limites de texturas/produtos e prioridade de tsunami passaram. O ensaio controlado v11 existente e seus hashes continuam documentados em `audits/session-v11-soak-20261027.json`. Eles não substituem um aparelho físico nem comprovam as novas funções da 1.0.29. Sem conexão aos aparelhos, não é possível produzir honestamente essa comprovação a distância.

## Alarme privado da página

A execução [41063043235](https://github.com/helbermoura2/Monitor-Global/actions/runs/41063043235) confirmou ausência de **ambos** os Secrets. Isso é separado dos alertas sísmicos já funcionando no Telegram.

O dono precisa abrir [Settings → Secrets and variables → Actions](https://github.com/helbermoura2/Monitor-Global/settings/secrets/actions) e criar:

- `UPTIME_TELEGRAM_BOT_TOKEN`: token do bot que administrará os avisos privados.
- `UPTIME_TELEGRAM_CHAT_ID`: identificador numérico do chat privado escolhido pelo dono.

Não colar tokens na conversa, código ou prints. Não reaproveitar o canal público de eventos como destino operacional sem escolha explícita do dono. Depois de salvar, executar **Homepage availability → Run workflow**, mantendo `configuration_only` marcado. Isso confere presença sem enviar mensagens; não prova entrega. [Instruções já existentes](alarme-disponibilidade.md).

## Publicação e reversão

As mudanças de CSS/JS/HTML do site são publicadas pelo hosting após o merge. Não exigem APK novo nem rebuild/deploy do Worker, pois esses módulos não integram seu pacote. Os demais arquivos são testes, workflow e documentação. A mudança do coletor vale nas próximas capturas pelo Actions. Para reverter, reverta o PR correspondente; não desinstale o aplicativo ou limpe seus dados. Não há migração de banco ou mudança das equações científicas.


## Continuação — 31/10/2026

As correções de preparação dos testes foram revalidadas sobre os arquivos do commit `4ece1a3`, conferidos pelo SHA dos blobs. O preload offline do coletor agora funciona ao trocar para um diretório temporário. Os ambientes isolados de câmera, contato do cartão e geometria incluem suas dependências atuais. A prioridade verifica que chegadas iguais/menores aguardam a proteção e são apresentadas uma vez; a cadência verifica cada camada de contorno/brilho separadamente, sem filtros repetidos. O cenário sintético subquilométrico usa M1,25 a 1 km (alcance aproximado de 0,751 km), sem alterar equações.

A rodada local Node concluiu 102 arquivos: 101 aprovados e um com falha, sem cancelamentos ou ignorados. A falha restante é `listen EPERM` no teste do proxy offline: este executor não permite abrir servidor local. São contagens por arquivo Node, não os 544 cenários Playwright. As verificações Android dependentes dos arquivos enviados passaram; isso não comprova estabilidade física.

O smoke passa a preservar JSONs fora de `test-results/`, com nomes distintos para suíte, visibilidade, tempestades, vento, ciclones e materiais. O resumo lê todos os relatórios e identifica erros de preparação e JSON interrompido. O job geral gera o HTML anexado; artifacts preservam também traces. Testes do resumo cobrem duas etapas com falhas, erro global e relatório incompleto; os sete arquivos Node alterados passaram na rodada direcionada. O YAML foi analisado e os caminhos conferidos quanto a colisões. Proteção offline, número de shards, cadência e cenários preservados.

Ainda falta uma execução completa do smoke no novo SHA, em executor com servidores locais e dependências disponíveis. Não declarar a validação geral aprovada nem encerrar a issue #327. Esta continuação não captura excesso novo do Worker, não altera Secrets, não envia Telegram e não comprova sessões físicas novas.


## Rodada completa de 31/10 e próxima correção

O Smoke foi habilitado para PRs que alteram código, testes ou seu workflow. A execução [41151308486](https://github.com/helbermoura2/Monitor-Global/actions/runs/41151308486), no commit `8690768`, concluiu os mesmos 544 cenários: **476 aprovados, 65 falhas e três instáveis**, sem cancelamentos ou ignorados. Visibilidade aprovou 30 cenários e materiais aprovou 58. A regressão de sessão longa [41151308761](https://github.com/helbermoura2/Monitor-Global/actions/runs/41151308761) aprovou 183 verificações internas e 75 cenários de navegador. Esses resultados não comprovam sessões físicas nos aparelhos. [Inventário sanitizado desta rodada](audits/general-validation-20261031.json).

A configuração geral estava coletando também os arquivos `node:test` pelo padrão padrão do Playwright, executando verificações internas durante a coleta do navegador. A separação passa a ser explícita: `node --test` para todos os arquivos internos, verificadores `*-check` em processos próprios e `**/*.spec.js` para navegador. A conferência local de coleta continuou encontrando exatamente 544 cenários em 143 arquivos. O runtime local disponível foi usado somente nessa conferência; a execução no navegador depende do runner com as dependências do lockfile.

As correções da próxima rodada tratam contratos observáveis: vagas atuais da rotação com categorias ausentes; imagens de bandeira e marcadores próximos apenas no zoom apropriado; contornos e rótulos em lugar do radar/legenda antigos; grade oficial fraca mantida como oficial; palavras decorativas com registros operáveis; limites próprios de estadia após a chegada. Testes do controlador físico usam suas APIs diretamente para continuar conferindo as mesmas tabelas e distâncias geodésicas, sem exigir frentes P/S na apresentação pintada atual.

As fixtures aguardam geografia/fontes quando o teste depende do layout, usam o proxy normalizado da AFAD, encerram efeitos antes de trocar de relógio e distinguem a janela inicial de chegada real. A lista incremental verifica a janela inicial de 30 itens no celular e 120 no desktop; não foi aumentado o orçamento do produto. A convergência do controlador após saltos grandes de relógio virtual é aguardada com limite explícito.

A conferência adicional passou em 242 scripts e na sintaxe de 144 arquivos de configuração/navegador. Dos 30 verificadores locais adicionais, 29 passaram inicialmente; o teste do menu móvel foi corrigido para usar o renderizador real compartilhado de áudio e passou na rechecagem. Dos 49 testes Python, 48 passaram e um depende do ZIP de distribuição do Worker ausente no pacote local. Nenhum serviço real foi chamado por esses ensaios.

**As novas correções ainda precisam passar no navegador.** O timeout de gesto nativo de tsunami e a visibilidade inicial de um aviso móvel continuam exigindo revalidação; não foram declarados defeitos corrigidos por suposição. Não houve alteração do runtime de produção nesta continuação, de equações, câmera, frequências, APK ou plano. A investigação de excesso do Worker, os Secrets privados e os ensaios físicos continuam abertos. O PR permanece em rascunho.


## Segunda rodada e compatibilidade do executor

A execução [41154779604](https://github.com/helbermoura2/Monitor-Global/actions/runs/41154779604), em `3e610be`, aprovou novamente visibilidade (30/30) e materiais (58/58). A regressão de sessões [41154779542](https://github.com/helbermoura2/Monitor-Global/actions/runs/41154779542) aprovou 183 verificações internas e 75 cenários de navegador. As duas partes gerais restantes ainda estavam em execução ao preparar este ajuste.

A coleta explícita de todos os testes internos expôs uma divergência no hash exato da geometria no Node 20 do runner. Os mesmos blobs do modelo, biblioteca de recorte e referência foram conferidos por SHA; os quatro hashes físicos originais passam no Node 24 local, sem atualizar as referências. O Smoke passa ao Node 24 LTS suportado. Isso precisa ser confirmado no runner: não se declara que uma falha de produto foi resolvida apenas pela troca do executor.

Uma falha interna continua tornando o job reprovado, mas não impede os verificadores independentes nem a etapa de navegador de registrarem seus próprios resultados. Novos commits aguardam a rodada atual, preservando sua evidência. YAML e scripts shell foram analisados localmente; as sete verificações direcionadas de geometria passaram com a proteção offline ativa. Não há mudança de runtime do site ou Worker neste ajuste.
