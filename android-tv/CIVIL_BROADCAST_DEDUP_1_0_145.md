# Argos Orbis TV 1.0.145 — mesmo Cell Broadcast não pode gerar duas tarjas

## Observação de 23/11/2026
A captura do S25 Ultra às 17:10 mostrava "duplicação evitada; primeiro
Nothing Phone 1 às 17:08:28". A TV, porém, chegou a exibir uma tarja
identificada como Nothing e outra identificada como S25.

**Isso não prova que eram duas cópias da mesma mensagem.** O Worker
anterior só comparava o texto normalizado por caixa/acentuação/espaços,
então uma interface que repetisse "Alerta severo", acrescentasse "OK"
ou pontuação poderia receber outro ID para o mesmo corpo do aviso.
Avisos oficiais genuinamente diferentes (área, risco, instruções,
nível) **precisam** continuar aparecendo separadamente.

## Correção da ponte / Cloudflare
- Extrai-se uma representação conservadora da mesma mensagem, retirando
  apenas cabeçalhos redundantes de severidade/Defesa Civil no início,
  pontuação e botão OK no fim. Mantêm-se todas as palavras do conteúdo.
- Identidade do alerta inclui **tipo (teste/real), nível e conteúdo**.
  Aviso com outra região, risco ou instrução tem hash distinto.
- Janela existente de 150 s permanece; não há supressão de alertas
  posteriores fora da janela.
- Uma transação do Durable Object lê o estado atualizado antes de
  escolher entre criar um ID ou registrar um segundo telefone.
  Isso impede disputa entre duas requisições simultâneas.
- O Worker continua armazenando temporariamente por 5 minutos e
  não muda alertas oficiais CAP nem sua autenticação.

## Diagnóstico da TV
- A TCL P7K preserva nome do primeiro e do segundo telefone no Worker.
- A seção **Defesa Civil → Diagnóstico · celular → Worker → TV** apresenta
  IDs curtos das **duas últimas tarjas reais distintas** (sem texto,
  localização ou tokens). Se houve duas tarjas, podemos distinguir se o
  servidor criou dois registros, o que não prova automaticamente duas
  emergências.
- Simulações não entram nesses registros de tarjas reais.
- Nenhum celular precisa ser desvinculado ou desinstalado.

## Testes
- `civil-phone-relay.test.mjs`: dois aparelhos com acessibilidade e
  textos equivalentes entre Android distintos geram só um ID, inclusive
  envios concorrentes; mudanças de região continuam gerando dois.
- `CivilPhoneAttributionTest` e demais testes gráficos da TV devem
  continuar passando.
- A implantação do Worker deve ser validada antes de anunciar que
  a correção está operacional; somente instalar o APK não muda o servidor.

## Limite
Sem os dois textos completos e IDs do evento das 17:08 não podemos
confirmar retroativamente qual foi a causa de cada tarja.
Não suprima alertas por similaridade ampla, intervalo de minutos ou
proximidade geográfica: isso ocultaria avisos reais distintos.
