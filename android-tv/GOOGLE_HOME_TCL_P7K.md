# Google Home + Monitor Global TV — TCL P7K (teste privado)

Objetivo: dizer "Ativar Temperatura Monitor Global" ao Google na TCL P7K e mostrar o mesmo boletim meteorológico que o Monitor Global já apresenta, sem abrir o aplicativo. Pode-se testar uma rotina pessoal para reconhecer "Mostrar a temperatura do Monitor Global".

Status: implementação em desenvolvimento; exige configurar o projeto Google Home e publicar o Worker. **Não é um produto certificado nem uma integração já ativa no Google Home.** O Google informa que uma integração formada somente por cenas virtuais não pode ser lançada oficialmente, mas permite testes privados.

## Arquitetura

TCL P7K / Google Assistente ou Gemini -> Google Home (cena privada) -> Cloudflare Worker -> mesmo Durable Object da Alexa (private-tv-alexa-v1) -> fila de comandos já existente -> MonitorService (WEATHER_NOW) -> tarja de meteorologia oficial.

O monitoramento do Monitor Global deve permanecer ativo em segundo plano; o aplicativo não precisa estar visível. A TV precisa estar ligada e na internet. Um alerta sísmico prioritário ainda pode impedir ou adiar a tarja solicitada. O Google não acessa áudio ou senhas do Monitor Global.

## Configuração pelo celular, sem PC

1. No Chrome, abra https://console.home.google.com/ e, se necessário, ative Versão para computador. Crie um projeto e uma integração Cloud-to-cloud de teste chamada Monitor Global.
2. Anote o Project ID da integração. Crie Client ID e Client Secret do OAuth (Client Secret forte/aleatório).
3. Configure as URLs na integração:
   - Authorization URL: https://black-sky-9ba0.terrestre.workers.dev/google-home/v1/authorize
   - Token URL: https://black-sky-9ba0.terrestre.workers.dev/google-home/v1/token
   - Cloud fulfillment URL: https://black-sky-9ba0.terrestre.workers.dev/google-home/v1/fulfillment
4. Na Cloudflare, no Worker atual, configure as variáveis/segredos:
   - GOOGLE_HOME_CLIENT_ID = Client ID configurado no Google Home
   - GOOGLE_HOME_CLIENT_SECRET = Client Secret; configure como SECRET, não texto público
   - GOOGLE_HOME_PROJECT_ID = Project ID exato da integração
   Não publique segredos no GitHub, em imagens, no chat ou no APK. Preserve os bindings e a classe Durable Object atuais.
5. Faça deploy do Worker atualizado que inclui worker/google-home-bridge.mjs e monitor-global-worker-7_7_0.js. Instalar apenas o APK não publica a Cloudflare.
6. Verifique https://black-sky-9ba0.terrestre.workers.dev/google-home/v1/health . Deve responder ready: true (sem revelar credenciais).
7. No Google Home Developer Console, habilite o teste da integração para a mesma conta Google usada no Google Home e na TCL P7K.
8. Instale o APK oficial Monitor Global TV 1.0.92. Abra uma única vez para vincular: Google Home -> Vincular Google Home -> Gerar código de seis dígitos. O PIN expira em dez minutos. Isso não desfaz o vínculo da Alexa.
9. No aplicativo Google Home do celular, escolha Adicionar -> Dispositivo -> Funciona com Google Home. Procure a integração de teste ([test] Monitor Global, se disponível). Na tela de autenticação aberta pelo próprio Google, informe o código da TV, leia e aceite o vínculo.
10. Deixe o monitoramento ativado, volte a qualquer programa e diga pelo microfone do controle: "Ativar Temperatura Monitor Global". Depois tente uma automação pessoal, com frase personalizada "Mostrar a temperatura do Monitor Global", usando a ação de ativar a cena.
11. Se a P7K permitir voz sem controle remoto, ative o microfone mãos-livres nas configurações do assistente. A disponibilidade exata varia por firmware, região e conta.

## Segurança

O Google Home usa OAuth com código de autorização, código temporário da TV, segredos só no Worker, tokens armazenados por hash SHA-256 no Durable Object e limites de solicitações. Os comandos são aceitos apenas depois do vínculo. O Google só pode ativar a cena de tempo; nenhum comando arbitrário nem autenticação da Alexa é transferido. A separação entre origem Google/Alexa é mantida no processamento.

A ordem das verificações é: teste Node.js -> build Android TV -> publicação assinada -> deploy Cloudflare -> registro Google Home -> vinculação -> teste real por voz. O backend pode responder PENDING quando o comando entra na fila: isso não confirma que a tarja já apareceu. Teste a exibição real na TV.

## Documentação oficial

- https://developers.home.google.com/cloud-to-cloud/project/authorization
- https://developers.home.google.com/cloud-to-cloud/guides/scene
- https://developers.home.google.com/cloud-to-cloud/traits/scene
- https://developers.home.google.com/cloud-to-cloud/test
- https://support.tcl.com/set-up-and-use-the-google-assistant-on-your-tcl-google-tv


## Frases alternativas para o Google Home (teste privado)

A cena virtual mantém o identificador original `Temperatura Monitor Global`, mas
a resposta `action.devices.SYNC` oferece também: `Tempo Monitor Global`,
`Clima Monitor Global`, `Meteorologia Monitor Global`,
`Boletim do tempo Monitor Global`, `Boletim meteorológico Monitor Global`,
`Previsão do tempo Monitor Global` e `Temperatura da Liberdade Monitor Global`.

Esses são **nomes alternativos de uma cena**, não comandos de linguagem natural
registrados no Assistente. Se o Google não reconhecer um comando falado, abra o
Google Home no celular, em **Automações → Rotinas pessoais → Nova** (a interface
pode usar nomes diferentes dependendo da versão), e configure uma ativação
**Quando eu falar com o Google Assistente** com frases como:

- Mostrar a temperatura do Monitor Global
- Como está o tempo no Monitor Global
- Boletim do tempo Monitor Global
- Temperatura da Liberdade no Monitor Global

Como **ação**, escolha ativar a cena/dispositivo `Temperatura Monitor Global`
se disponível no editor. A ação tem que ser a cena virtual, **não a previsão
do tempo nativa do Google**. Caso o editor só permita ações personalizadas,
tente a ação falada `Ativar Temperatura Monitor Global`. Nem toda cena é
disponibilizada pelo Google como ação em todos os editores: confirme se a
ação funciona ao iniciar a rotina manualmente antes do teste de voz.

Após publicar o novo Worker com os aliases, peça ao Google Assistente
`Sincronizar meus dispositivos` ou atualize os serviços vinculados pelo
Google Home para solicitar novo SYNC. Não precisa gerar PIN novo nem trocar
o APK só por causa das variações. A sincronização pode depender da
configuração/idioma da conta; não é garantido que o assistente aceite cada
variação diretamente. Sem `action.devices.EXECUTE` recebido na ponte,
nenhuma frase chega à TV, independentemente do APK.

Documentação:
- https://developers.home.google.com/cloud-to-cloud/intents/sync
- https://developers.home.google.com/cloud-to-cloud/traits/scene
- https://support.google.com/assistant/answer/7672035?hl=pt-BR
