# Pendências operacionais — 31/10/2026

Os testes instáveis são tratados sem alterar magnitude, intensidade, prioridade ou temporização do produto. O teste M5,9 percorre a animação realmente anexada ao cartão, nos mesmos 1.500 ms, mantendo a exigência de deslocamento maior que 4 px. Os testes de tsunami e ondas instalam um relógio conhecido e pausam com margem para a comunicação com o navegador. O caso de convergência M4,1 conserva os cálculos, projeção e `jumpTo` reais, isolando apenas o desenho contínuo da GPU. A rodada dedicada repete os quatro cenários três vezes, sem retries.

## Excesso de recursos do Worker

O workflow **Worker resource follow-up** abre uma primeira janela passiva de cinco minutos quando é publicado na main e outra a cada dez minutos, até **2026-11-01T04:16:01.000Z**. O agendamento do GitHub pode atrasar. Não é cobertura contínua: são amostras de cinco minutos a cada dez minutos. Ao vencer a janela, o próprio workflow se desativa; nenhum outro workflow é alterado.

Usa os Secrets Cloudflare existentes somente no Actions. Reutiliza o coletor que encerra a sessão temporária e descarta URLs completas, parâmetros, cabeçalhos, logs e textos de exceção. Guarda apenas rota agregada e resultado. Não gera tráfego sintético, consultas de população, alertas Telegram ou mudança de plano.

Resultados ficam no resumo de cada execução e no artifact `worker-resource-observation`, por 14 dias. Uma rota com `exceededCpu`, `exceededMemory` ou `exceededResources` identifica uma família de entrada para investigação; não identifica automaticamente a causa. Uma janela sem excesso não encerra o incidente. Na publicação inicial, uma leitura das métricas agregadas atualiza também o contexto do incidente, sem aumentar a frequência normal do monitor de cotas. Observação bloqueada ou encerramento não confirmado não é classificado como ausência de erro.

## Avisos privados de disponibilidade

O mesmo workflow verifica somente a presença de `UPTIME_TELEGRAM_BOT_TOKEN` e `UPTIME_TELEGRAM_CHAT_ID`, sem enviar mensagens. O monitor de disponibilidade já existente continua independente.

O dono já tem bot e chat privado. As credenciais não estão acessíveis neste ambiente, e a conexão GitHub desta tarefa não oferece escrita de Secrets. O cadastro deve ocorrer na interface privada do GitHub, sem publicar valores em conversa, commits ou imagens:

1. Pelo navegador do celular, abrir [Secrets do repositório](https://github.com/helbermoura2/Monitor-Global/settings/secrets/actions).
2. Em **New repository secret**, cadastrar `UPTIME_TELEGRAM_BOT_TOKEN` com o token do bot.
3. Cadastrar `UPTIME_TELEGRAM_CHAT_ID` com o identificador numérico do chat privado escolhido.
4. Usar **Homepage availability → Run workflow**, mantendo **configuration_only** marcado, para conferir presença sem mensagens.

Presença não prova validade do token, permissão do bot ou entrega. Não reaproveitar automaticamente o destino público dos eventos. Nenhum teste de mensagem foi enviado nesta etapa.

## Sessões físicas atuais

Não há aparelho conectado nem VPN configurada no ambiente. Os relatórios físicos históricos já analisados não comprovam a versão atual. Um ensaio de laboratório tampouco substitui o uso no aparelho.

**Celular ou DeX:** no site, abrir **Menu → Desempenho no aparelho → Iniciar diagnóstico** (no cabeçalho desktop, também está em **Mais**). Fechar apenas essa janela e usar normalmente por 2–4 horas com a página visível. Depois voltar e tocar em **Exportar relatório**. A coleta fica local e não exige computador. Ao enviar o JSON na conversa, será possível analisar a janela efetivamente observada, heap disponível, elementos, recursos gráficos e erros, sem somar medidas incompatíveis ou chamar memória ausente de zero.

**TV:** deixar a versão atual em monitoramento durante algumas horas. Abrir **Diagnóstico local · memória e desenho da tarja → Baixar diagnóstico pelo celular (QR Code)**. Ler o QR pelo celular conectado à mesma rede da TV, manter essa janela aberta até baixar e anexar o JSON na conversa. Usar o diagnóstico atual, e identificar separadamente qualquer arquivo anterior à atualização. [Instruções existentes](../android-tv/DIAGNOSTICO_PELO_CELULAR_1_0_20.md).

Esses arquivos são necessários para concluir a comprovação física. Até recebê-los, não afirmar estabilidade durante horas, ausência de vazamento ou economia percentual em produção.

