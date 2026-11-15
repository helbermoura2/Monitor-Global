# ARGOS ORBIS — migração da marca (14/11/2026)

## Identidade oficial
- Marca pública: **ARGOS ORBIS**.
- Domínio adquirido pelo proprietário: **argosorbis.com.br**.
- Logotipo aprovado: `img/argos-orbis-vigilante.svg` (olho de bronze, inscrições, quatro ornamentos e ponteiro 360° com piscada). Use `img/argos-orbis-vigilante-static.svg` nos PNGs e em movimento reduzido. O mini olho é `img/argos-orbis-source-eye.svg`.
- Identificadores técnicos históricos no repositório podem continuar como `monitor-global` para compatibilidade.

## Alterações no código
- Site: cabeçalho, PWA e imagens de compartilhamento passam a usar a marca Argos Orbis.
- Telegram: renderizadores dos alertas e resumos adotam nome/domínio e o símbolo olho em vez de textos `MONITOR GLOBAL`. Mensagens de teste NÃO devem ser enviadas ao canal real.
- TV: rótulo do aplicativo, banner, selo de voz e identidade visível.
- Celular: rótulo, ícone, cabeçalho e telas de mapas.
- O Worker continua com o MESMO nome, bindings, crons, tokens, chat ID e regras de deduplicação; a marca muda, não a infraestrutura.

## Pendências externas — NÃO fingir que já foram concluídas
1. **DNS/HTTPS:** comprovar que `argosorbis.com.br` e `www.argosorbis.com.br` resolvem para a hospedagem certa, possuem certificado válido e carregam o site. Registrar o domínio não configura DNS automaticamente. Atualizar URL canônica, cards OG e links funcionais somente após a prova; manter `monitorglobal.top` ativo para redirecionamento compatível.
2. **Canal do Telegram:** o proprietário altera no canal EXISTENTE o nome, foto e descrição. Migrar o username público se `@argosorbis` estiver disponível, preservando membros e histórico; sem confirmação NÃO colocar um username inexistente em PNGs ou links. O bot conserva token e `TELEGRAM_CHAT_ID` numérico.
3. **Publicação do Worker:** publicar os geradores do repositório pelo workflow seguro **Cloudflare Worker maintenance** com `mode=deploy`, apenas depois dos testes, sem mexer em Secrets, DO/KV e agendamentos; verificar health e alertas em modo offline/fixture. O simples merge de código não publica o Worker automaticamente.
4. **APKs:** criar e testar releases assinadas para TV e celular; alterar o nome exibido NÃO altera package IDs nem atualiza APKs já instalados. Verificar os fluxos de atualizações in-app.
5. **Integrações de voz:** nomes de invocação e account linking de Alexa/Google exigem atualização e testes nos consoles desses serviços. Não quebrar os comandos antigos até os novos responderem.
6. **OG social e vídeo:** checar thumbnails e rotas em todos os destinos, sem publicar imagens de exemplo como eventos reais.

## Regra de continuidade
NUNCA renomear `top.monitorglobal.*`, tópicos FCM `monitor_global_*`, identificadores DO/KV ou Workers por estética. Não trocar URLs de API/download/serviço por `argosorbis.com.br` antes de confirmar hospedagem, DNS, redirecionamento e TLS.

## Validações
- Site mobile 320/390/412 e desktop.
- PNGs: magnitude, país, hora, profundidade e alertas oficiais preservados.
- Worker: testes de deduplicação Telegram, revisões e resumos diários sem rede real, especialmente atualização de mensagem.
- Aplicativos: build, assinatura, abertura, atualizador e notificações.
- Domínio: verificação externa (DNS + HTTPS) e rotas antigas.
