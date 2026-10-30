# Validação geral — 30/10/2026

Revisão do código publicado a partir de `c8be549`. Plano Cloudflare **Free**, sem mudança de cotas, cadência de alertas ou assinatura Android. Não foram enviadas mensagens de teste ao Telegram.

## Testes gerais

A suíte contém 544 cenários. O job único anterior foi cancelado após 65 minutos; agora a suíte é dividida em três partes, com dois navegadores por runner, sem excluir cenários. As verificações Node/Python comuns rodam apenas na primeira parte. Relatórios usam nomes diferentes para evitar conflito entre partes.

As expectativas sísmicas antigas ainda exigiam clones do cartão inteiro, seu desaparecimento e duração anterior do modo automático. O efeito aprovado desde os PRs 483/484 utiliza palavras decorativas e mantém o cartão disponível. A regressão passa a verificar palavras, texto original, controles, movimento reduzido, revisões, interrupção e limpeza. O cenário de tsunami visual agora fornece um boletim oficial de ameaça, em vez de um registro agregado sem situação confirmada. Os testes específicos de ausência de ameaça continuam separados.

Resultados finais da execução: em acompanhamento no [registro sanitizado](audits/general-validation-20261030.json). Uma execução iniciada não significa aprovação.

## Worker e fontes

A primeira captura passiva durou 301 segundos: **37 execuções, todas `ok`**. A sessão temporária foi removida. Não houve testes de carga, gravação de parâmetros/cabeçalhos ou alteração dos filtros de builds. A segunda janela observou mais 31 execuções, também todas `ok`: 68 no total, em duas janelas de cinco minutos. Amostras sem excesso não identificam a causa dos excessos históricos.

O coletor ganhou classificação explícita de `/tv-rain` e `/tv-weather`, antes agrupadas em `other`. Isso altera somente o diagnóstico executado no Actions, sem custo adicional por acesso ao aplicativo e sem deploy do Worker.

Na leitura de 30/10, os sete catálogos sísmicos retornaram sucesso. Os seis feeds diretos de tsunami retornaram HTTP 403; o catálogo oficial alternativo do NWS respondeu sem produtos recentes nessa leitura. A cobertura é **parcial**, não ausência confirmada de ameaça. Na coleta geral, NHC/GDACS/EONET responderam; NWS e o feed agregado de tsunami estavam indisponíveis. Não se declarou recuperação desses provedores nem se substituiu dado oficial por estimativa.

Os quatro JS/CSS visuais comparados são idênticos à main. O HTML tem uma diferença identificada: o script de analytics inserido pela hospedagem Cloudflare. Não é uma alteração do código de apresentação.

A consulta de cotas às 13h36 UTC registrou, para 29/10 completo, os números detalhados no JSON de auditoria; o parcial de 30/10 ainda contém uma ocorrência de `exceededResources`. O agregado não identifica sua rota. Não se declarou economia percentual causal ou encerramento do incidente.

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

Estas mudanças são testes, workflow e documentação; não exigem APK novo nem rebuild/deploy do Worker. A mudança do coletor vale nas próximas capturas pelo Actions. Para reverter, reverta o PR correspondente; não desinstale o aplicativo ou limpe seus dados. Não há migração de banco ou mudança das equações científicas.
