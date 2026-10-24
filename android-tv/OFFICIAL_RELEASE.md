# Publicação oficial do Monitor Global TV

“Oficial” aqui significa **distribuído pelo próprio projeto**, com assinatura própria e canal controlado. Não significa homologação da Amazon, TCL ou loja Google Play.

## Quem pode atualizar

A conta `helbermoura2` é a proprietária do canal. IAs não têm uma identidade de sistema universal: uma IA pode preparar alterações e publicar apenas usando um acesso que o proprietário autorizou no GitHub. Ler ou copiar o repositório público não fornece a chave de assinatura nem permite atualizar a instalação oficial.

A ação **Android TV official release** só executa para este repositório, em `main`, quando acionada por `helbermoura2`. A chave privada fica nos Secrets do ambiente `android-tv-release`, fora do código e do APK. Builds de PR não recebem esses Secrets. O ambiente deve permitir apenas a branch `main`; revisão obrigatória do proprietário pode ser ativada, se ele quiser aprovar cada uso da chave. O dono pode revogar os acessos de uma IA nas configurações do GitHub.

Ter acesso às credenciais do proprietário equivale a agir como ele. Nenhum mecanismo distingue automaticamente uma IA autorizada de uma pessoa usando as mesmas credenciais. Por isso não se promete proteção contra comprometimento da própria conta proprietária.

## Configuração única do proprietário

O acesso do assistente ao GitHub recebeu HTTP 403 para criar o ambiente ou gerenciar Secrets. O proprietário precisa concluir esta etapa pela interface:

1. Em **Settings → Environments**, crie `android-tv-release`.
2. Em **Deployment branches and tags**, selecione as branches escolhidas e permita somente `main`.
3. Em **Environment secrets**, cadastre:
   - `TV_RELEASE_KEYSTORE_B64`: conteúdo do arquivo privado `TV_RELEASE_KEYSTORE_B64.txt` fornecido no backup privado.
   - `TV_RELEASE_PASSWORD`: conteúdo do arquivo privado `release-password.txt`, fornecido separadamente.
4. Guarde o backup cifrado e a senha em locais seguros e separados. Não o envie a issues, PRs, arquivos do repositório ou mensagens públicas. A senha e a chave não devem ser solicitadas em texto público.
5. Em **Actions → Android TV official release → Run workflow**, use `main` e modo `verify`. Isso comprova a assinatura com os Secrets sem publicar outra versão.

O backup privado e a chave não estão neste repositório. `signing/release-certificate.der`, `identity.json` e `lineage.bin` são apenas materiais públicos de verificação/migração e podem ser versionados.

## Da prévia para 1.0.0

O identificador técnico `top.monitorglobal.tv.preview` foi preservado para não criar um aplicativo paralelo nem perder as configurações. O nome exibido é **Monitor Global TV**. A retomada do monitoramento é tentada após substituir o pacote, e abrir o aplicativo retoma o serviço se o usuário o havia deixado ativo. A assinatura permanente usa RSA de 3072 bits e um certificado próprio do projeto. Uma prova de rotação assinada pela chave da prévia liga o certificado antigo ao novo.

O APK oficial usa assinatura v3 com essa prova, a partir de Android 9/API28, abrangendo as versões Android do Fire Stick 4K Max e Google TV citados pelo proprietário. As verificações criptográficas passaram em SDK28/30/34/35 e o certificado inicial da prova coincide com o da prévia publicada. A preservação dos dados e da permissão é prevista pelo mecanismo Android, mas a atualização sobre a instalação existente ainda precisa ser confirmada no Fire Stick real. **Não desinstale a prévia antes de tentar a atualização normal.**

Builds `debug` agora usam o sufixo `.dev` e outro nome, para não substituir a instalação oficial.

## Próximas versões

1. A IA autorizada faz a alteração em uma branch e abre PR.
2. Compilação, lint e verificações de estado/confiança executam sem chave privada.
3. Após integrar em `main`, incremente `versionCode` e `versionName` antes de publicar uma versão nova.
4. Acione **Android TV official release**, modo `publish`. A ação compila, assina, verifica certificado/SDK, recusa versões repetidas ou antigas e publica APK/checksum/manifesto. A publicação falha se `main` avançar durante o build, evitando misturar versões.
5. O aplicativo oferece **Verificar atualização oficial**. O download precisa ser HTTPS no domínio/caminho fixos do projeto, corresponder ao SHA-256, pacote, versão e certificado esperados, além de não ser depurável. O instalador Android também verifica a assinatura e exige a confirmação do proprietário da TV.

Se o Fire OS não oferecer a tela para autorizar o aplicativo a solicitar instalações, pode ser necessário usar o Downloader com o endereço oficial apresentado. Não há instalação silenciosa ou comando remoto genérico de administração.

## Ajustes visuais sem novo APK

Edite somente `theme` em `distribution/stable.json`, aumente `theme.version` e publique em `main`. O aplicativo consulta o canal a cada 15 minutos e ao verificar atualização. Cores, tamanho de letra, cantos, largura e posição superior/inferior são validados e limitados no cliente. Não são aceitos scripts, layouts executáveis, hosts arbitrários ou comandos ADB. Som, duração e ativação do monitoramento continuam sob controle local do usuário.

Uma indisponibilidade desse arquivo mantém o tema salvo e não para a recepção dos alertas. O feed de sismos/tsunami e o Telegram existentes permanecem independentes.
