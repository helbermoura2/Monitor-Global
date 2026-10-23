# Guia do dono — Monitor Global

Site: https://monitorglobal.top · Repositório: https://github.com/helbermoura2/Monitor-Global

## Antes de mudar algo

Faça uma alteração por vez. Enquanto estiver rodando o diagnóstico de desempenho, termine e exporte o JSON antes de recarregar o site. Publicar uma versão não atualiza automaticamente uma aba que já está aberta.

## Mudar textos e cores pelo GitHub

1. Abra o repositório e consulte [o mapa dos arquivos](MAPA_DOS_ARQUIVOS.md).
2. Abra o arquivo e toque no lápis **Edit this file**. Texto da página costuma ficar em `index.html` ou em `js/`; aparência fica em `css/`. Não substitua dados científicos ou nomes oficiais para ajustar o visual.
3. Faça uma mudança pequena. Toque em **Commit changes** e escolha criar uma nova branch e abrir um **pull request**. Dê um nome que explique a mudança.
4. Na aba **Files changed** do pull request, confira o que foi alterado. Aguarde as verificações e revise antes de tocar em **Merge pull request**.
5. Em **Actions**, acompanhe a publicação. Quando ela terminar, recarregue o site e confira em celular e tela maior. Um teste aprovado não comprova, sozinho, que a versão já chegou ao domínio.

Os nomes e a posição dos botões do GitHub podem variar no celular. O menu de três pontos pode reunir ações que aparecem abertas no desktop.

## Emergência: desfazer uma alteração

Não apague o repositório, não use force push e não desative as proteções da branch.

1. Abra **Pull requests → Closed** e localize o pull request que introduziu o problema. Atualizações automáticas de dados podem aparecer depois dele; nem sempre o último commit é a mudança a desfazer.
2. Abra o pull request integrado. Perto da informação de que ele foi merged, procure **Revert**.
3. O GitHub prepara uma alteração inversa. Abra o novo pull request, confira **Files changed**, aguarde as verificações e faça o merge.
4. Acompanhe **Actions** e a publicação. Confira o site após recarregar.
5. Se **Revert** não estiver disponível ou houver conflito, pare e peça ajuda indicando o link do pull request. Não cole uma cópia antiga de todos os arquivos: ela pode apagar melhorias posteriores.

Isso desfaz código. Não desfaz mensagens já enviadas ao Telegram, dados gravados, migrações ou configurações externas da Cloudflare. Uma reversão que envolva esses serviços precisa de análise própria. O procedimento começa em poucos cliques; o tempo de publicação pode ultrapassar um minuto.

## Saber se está funcionando

- **Site:** confira se abre, carrega o mapa e apresenta horários recentes. Use **Situação das fontes** para distinguir falha de um provedor de falha geral.
- **Actions:** uma execução verde passou; vermelha falhou; amarela ainda está rodando. Abra a execução e a etapa com erro. Não publique logs contendo credenciais.
- **Desempenho:** use o diagnóstico local para sessões longas. Ele não envia um alarme externo de queda.
- **Consumo:** Actions tem auditorias de Durable a cada seis horas e relatório diário de KV. Os horários são UTC; as execuções agendadas podem atrasar. Falha de consulta não significa consumo zero.
- **Disponibilidade:** veja [como funciona o alarme](docs/alarme-disponibilidade.md). Ele verifica a página inicial; não confirma que todas as fontes ou o Telegram de eventos estejam atualizados.

## Credenciais

Use **Settings → Secrets and variables → Actions → New repository secret** para Secrets das automações. Os Secrets dos Workers ficam na Cloudflare, no Worker correspondente, em **Settings → Variables and Secrets**. Nunca cole tokens no código, nas conversas, em prints ou no README.

Se uma chave tiver sido publicada, revogue e gere outra no serviço de origem. Apagar a linha ou mover o valor para Secrets não elimina a exposição anterior no histórico.
