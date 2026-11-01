# Liberar a faixa do Monitor Global no Fire Stick pelo celular

A mensagem “Sobreposição não permitida” vem da permissão do sistema. Instalar outra versão do APK não concede essa permissão. No Fire Stick, a tela padrão do Android pode não existir ou voltar sem permitir nada. A Amazon informa que essa permissão não tem suporte oficial no Fire TV; a autorização manual abaixo depende de o Fire OS do aparelho aceitar o comando.

Este procedimento pode ser feito com um celular Android e também atende à versão 1.0.29 já instalada. Não desinstale o Monitor Global.

## 1. Preparar o Fire Stick

1. Na TV, abra **Configurações → Meu Fire TV → Sobre**.
2. Se **Opções do desenvolvedor** não aparecer, selecione o nome/modelo do Fire Stick sete vezes com o botão central do controle. Volte uma tela.
3. Abra **Opções do desenvolvedor → Depuração ADB** e ative.
4. Em **Meu Fire TV → Sobre → Rede**, anote o endereço IP do Fire Stick.

## 2. Conectar pelo celular

1. Conecte o celular à mesma rede Wi-Fi do Fire Stick.
2. No celular, instale [atvTools pela Google Play](https://play.google.com/store/apps/details?id=dev.vodik7.atvtools). É um aplicativo externo ao Monitor Global; [site do desenvolvedor](https://atvtools.app/).
3. Abra o atvTools, escolha o Fire Stick encontrado na rede ou informe o IP anotado.
4. Quando a TV perguntar se permite a depuração/conexão, autorize a conexão deste celular.
5. No dispositivo conectado, abra a função **Shell / Terminal** (o nome depende do idioma e da versão do atvTools).

O aplicativo deve estar no celular, e o dispositivo conectado deve ser o Fire Stick. Não é necessário instalar uma ferramenta ADB dentro da TV.

## 3. Autorizar somente o Monitor Global

Na função Shell / Terminal do celular, cole e execute:

```sh
appops set top.monitorglobal.tv.preview SYSTEM_ALERT_WINDOW allow
```

Esse é o identificador do aplicativo oficial, mesmo que tenha “preview” no nome técnico. Dentro de um terminal remoto já conectado, não acrescente `adb shell` ao início.

Depois, confira:

```sh
appops get top.monitorglobal.tv.preview SYSTEM_ALERT_WINDOW
```

A resposta precisa indicar **allow**. Nenhuma resposta no primeiro comando, por si só, comprova autorização.

Se houver erro de permissão, comando desconhecido ou outra recusa, não considere liberado. Registre o texto do erro e a versão do Fire OS em **Meu Fire TV → Sobre** para investigar o aparelho específico.

## 4. Conferir no Monitor Global

1. Volte ao Monitor Global na TV, sem desinstalar nem apagar dados.
2. Confira se aparece **Sobreposição permitida**. Na versão 1.0.31, também existe **1 → Já autorizei · verificar novamente**.
3. Use **Testar sismo com indicação de tsunami (fictício)** e volte à tela inicial para conferir a faixa fora do aplicativo.
4. Depois da conferência, você pode desligar a **Depuração ADB** no Fire Stick.

A atualização 1.0.31 acrescenta ajuda acessível pelo controle, alternativas para abrir configurações, nova conferência da permissão e este guia por QR Code. Ela não concede privilégios sozinha e mantém a recusa do sistema quando a autorização não existe. Se uma atualização do Fire OS ou política do aparelho voltar a bloquear a permissão, essa situação precisa ser verificada no próprio sistema. Alguns aplicativos também podem restringir sobreposições sobre seu conteúdo.

## Referências

- [Amazon: conectar ao Fire TV por ADB](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html).
- [Amazon Developer Community: limitação de sobreposição no Fire TV](https://community.amazondeveloper.com/t/firetv-overlay-permissions/6053/2).
- [Android: permissão SYSTEM_ALERT_WINDOW](https://developer.android.com/reference/android/Manifest.permission#SYSTEM_ALERT_WINDOW).

Não há aparelho físico conectado ao ambiente de desenvolvimento; uma aprovação da compilação não comprova autorização no seu Fire Stick.
