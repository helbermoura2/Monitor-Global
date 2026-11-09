# Monitor Global + Alexa — skill privada em português (fase 1)

Objetivo: segurar o **botão físico do microfone** do Fire TV Stick 4K Max (ou falar à Echo), pedir **Brent**, **temperatura** ou **sismos no Brasil**, e o aplicativo **Monitor Global TV** mostrar **os seus cards existentes sobre o conteúdo da TV**, sem abrir a busca de voz do Google. A Alexa recebe a fala, a skill manda um comando autenticado ao Worker, e o aplicativo o executa.

## Status
- Código da skill: `alexa-skill/lambda/`.
- Modelo pt-BR: `alexa-skill/skill-package/interactionModels/custom/pt-BR.json`.
- Ponte: `worker/alexa-voice-bridge.mjs`, disponível somente **depois do deploy manual** do Worker.
- TV: opção **Vincular Alexa · mostrar código de 6 dígitos** e receptor em `MonitorService`, disponível somente **depois de instalar a versão assinada que incluir o PR**.
- Skill **não é criada automaticamente na sua conta Amazon** pelo merge do GitHub. Somente o proprietário pode iniciar a criação no Amazon Developer Console.
- O código de pareamento **é temporário**, não deve ser colocado no GitHub nem compartilhado.

## Preparar a skill pelo celular (sem computador)

1. Entre em [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) com **a mesma conta Amazon da sua Echo/Fire TV**. Se necessário, registre a conta de desenvolvedor.
2. Escolha **Create Skill** > nome `Monitor Global` > idioma **Português (Brasil)** > modelo **Custom / Personalizado** > hospedagem **Alexa-Hosted (Node.js)** > template **Start from scratch / Começar do zero**.
3. Em **Build → Interaction Model → JSON Editor**, substitua o modelo pelo conteúdo de `skill-package/interactionModels/custom/pt-BR.json`, salve e execute **Build Model**. O nome de invocação é **monitor global**.
4. Em **Code**, importe `monitor-global-alexa-import-code.zip` (gerado automaticamente pelo workflow **Alexa skill package** no GitHub Actions). O ZIP contém a pasta `lambda` na raiz com `index.js`, `commands.js` e `package.json`. Caso a interface não permita importar ZIP no celular, abra o navegador em **versão para computador**; também pode copiar os três arquivos separadamente pelo editor Code.
5. Clique **Deploy** para instalar as dependências e ativar a função Alexa-hosted. O script utiliza a tabela DynamoDB vinculada automaticamente à skill; não é necessário informar token AWS, senha da Amazon nem credencial Cloudflare.
6. Em **Test**, habilite **Development** e abra a skill. A Echo e Fire TV registrados na mesma conta devem poder usá-la em desenvolvimento; algumas versões da Alexa limitam quais dispositivos suportam skills.

## Pareamento da TV

1. Publique primeiro o Worker atualizado, depois instale a versão TV assinada com esta integração. Sem as duas partes, o pareamento exibirá erro.
2. Abra **Monitor Global TV**, escolha **Vincular Alexa** e **Gerar código**. O app mostra seis dígitos válidos por 10 minutos.
3. Diga à Echo (ou pelo microfone do controle): **“Alexa, peça ao Monitor Global para vincular código 123456”** — substitua os números pelo código atual. O reconhecimento dos dígitos pode exigir repetir a frase.
4. **Ative o monitoramento** na TV. A ponte recebe comandos em segundo plano somente quando esse serviço estiver ativo; o Fire OS pode suspendê-lo se a TV dormir.
5. Segure o microfone do controle e diga **“Peça ao Monitor Global para mostrar o Brent”**, **“Peça ao Monitor Global para mostrar a temperatura”** ou **“Peça ao Monitor Global para mostrar os sismos no Brasil”**. Os comandos invocam os mesmos botões/serviço existentes na TV. Dependem de dados reais, permissão de sobreposição e disponibilidade do Worker.
6. A entrega pode levar segundos até a próxima consulta da TV e até o atraso já existente de exibição do card. A skill confirma que o comando foi enviado, **não** que um preço ou terremoto tenha sido encontrado.

## Implantação do Worker
O código usa a instância `private-tv-alexa-v1` do Durable Object **existente** `EARTHQUAKE_ALERTS`; não foi criada outra classe, migração, namespace KV nem DO de terremotos. Faz consultas leves a essa instância a cada 8 segundos enquanto o monitoramento da TV estiver ligado e vinculado.

Após passar os testes e integrar o PR, no GitHub Actions execute **Cloudflare Worker maintenance** em `main`, no modo **deploy**. O modo **inspect** não publica as novas rotas. Esse workflow usa os segredos Cloudflare já configurados no seu repositório, sem revelar seus valores.

Não altere os dados sísmicos nem os alertas reais para tentar reparar a skill. Teste a skill e a ponte independentemente antes de atualizar a TV.

## Segurança e limitações
- Nenhum comando Alexa controla lâmpadas, trancas ou outros aparelhos: apenas `brent`, `weather`, `brazil`.
- Registro e vínculo exigem HTTPS; o PIN é de uso único e expira em 10 minutos; há limite de tentativas por origem. A skill guarda um token aleatório por conta na tabela privada da Amazon. O APK guarda apenas um token do dispositivo nas preferências privadas.
- O Worker não recebe gravações de voz nem dados da sua conta Alexa. Rejeita comandos sem credencial e não inclui credenciais no código público.
- O controle é escutado pela **Alexa do Fire TV**, não por um microfone próprio do Monitor Global. Ao segurar o microfone, não é necessário dizer “Alexa”, mas é necessário invocar “Monitor Global”; frases sem o nome da skill não são garantidas.
- O modo de voz local da 1.0.63 (Google SpeechRecognizer) é um teste separado; a integração da Alexa evita aquele campo de pesquisa.
- Serviço de monitoramento deve estar ativo. Se o Fire Stick interromper apps em segundo plano, será preciso testar o comportamento no aparelho real; o código não pode garantir execução com aparelho desligado.

## Testes
`node --test tests/unit/alexa-voice-bridge.test.mjs tests/unit/alexa-skill.test.cjs`

Os testes validam: credenciais, PIN, expiração, limites, apenas três comandos, consulta/ACK do aplicativo e o modelo pt-BR.
