# Atualização no Fire Stick — TV 1.0.37

O botão consulta o manifesto publicado em `android-tv/distribution/stable.json`. Código integrado em main ou uma execução de assinatura com sucesso não disponibilizam, por si só, um APK novo.

Na investigação de 02/11, o canal ainda indicava 1.0.30 e as execuções recentes tinham a etapa **Publish validated distribution** pulada porque usavam **verify**. O modo padrão do workflow passa a **publish**, mantendo execução manual, main, proprietário e ambiente de assinatura. **verify** continua disponível e agora explica no resumo que não publicou nenhum APK.

## Publicar uma atualização

No navegador do celular, abrir [Android TV official release](https://github.com/helbermoura2/Monitor-Global/actions/workflows/android-tv-release.yml), selecionar **Run workflow**, manter **main** e **publish**, e confirmar. A publicação valida assinatura, versão e hash, publica o APK/manifesto e solicita a atualização da hospedagem. Se main avançar durante a compilação, a proteção existente recusa a publicação: não se mistura um APK de uma versão com metadados de outra.

## No aplicativo

O clique mostra feedback imediato. A consulta termina em uma janela, mostrando versões instalada/publicada quando não há novidade, oferecendo download quando há APK novo, ou explicando uma falha. Após verificar o arquivo, o aplicativo oferece **Instalar agora**.

A autorização para solicitar instalações é diferente da permissão de sobreposição. O aplicativo abre a tela do sistema somente após escolha do dono. Ao retornar, se a autorização foi concedida e o arquivo continua no cache, oferece novamente a instalação sem outro download. Se o Fire OS não oferece a tela ou o instalador, uma janela exibe o endereço oficial para usar no Downloader.

A assinatura, o hash, a origem fixa, o pacote, a versão, o limite de tamanho e a recusa de APK depurável permanecem exigidos. Não existe instalação silenciosa ou concessão automática de permissões.

Se o app antigo não conseguir abrir o instalador, após publicar a 1.0.37 use o Downloader com `https://monitorglobal.top/downloads/monitor-global-tv-1.0.37.apk`. Instale por cima, sem desinstalar. Antes de a publicação terminar, esse endereço ainda pode não existir.

A validação Android usa respostas de canal e telas do sistema simuladas, sem instalar APKs nem acessar credenciais. Ela não substitui confirmar a instalação no Fire Stick real.
