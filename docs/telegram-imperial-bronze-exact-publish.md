# Publicação única do PNG exato Imperial Bronze — 16/11/2026

Este procedimento implementa uma postagem de **prévia visual do M6,6 da Indonésia** pelo bot existente do Argos Orbis, sem alterar a rotina dos alertas reais. O PNG fornecido pelo proprietário **não** é redesenhado, aproximado, recolorido nem recomprimido antes de ser enviado ao Telegram. O Telegram pode otimizar a apresentação de fotos, mas o Worker entrega os bytes originais ao endpoint `sendPhoto`.

## Arquivo aceito

- Nome fornecido na conversa: `alerta_sísmico_em_bronze_tual_indonésia.png`
- Dimensões: **1024 × 1536**
- SHA-256: **`ed3cf9da86aa041673d98a40172649b498e879137da9a2b8a40810f6fe699a75`**
- Representa o exemplo M6,6 de 16/11/2026, às 18:11 BRT, próximo de Tual, Indonésia; legenda do canal indica claramente **republicação de referência**, não um novo evento.

## Publicação

1. Abra `argosorbis.com.br` e, no menu, **Histórico do Telegram**.
2. Informe o `ADMIN_TOKEN` já configurado no Worker (apenas em memória).
3. Abra a seção **Sismos M6+ e Brasil**.
4. Em **Publicar a imagem Imperial Bronze aprovada**, selecione o PNG exato e toque no botão de publicação.
5. Aguarde a confirmação com `messageId` da API. Após um envio confirmado, qualquer repetição retorna o registro anterior, sem disparar duplicata. Em caso de resposta ambígua, o sistema bloqueia novas tentativas.

A mesma operação pode ser realizada com a página HTML autocontida preparada na conversa, que já incorpora os bytes exatos e não exige selecionar o arquivo. Essa página só comunica com o Worker HTTPS do projeto. Não cole sua chave administrativa em serviços externos.

## Segurança e limites

- `POST /telegram-imperial-preview` exige `X-Admin-Token`, o mesmo mecanismo do histórico existente.
- O Durable Object privado valida cabeçalho PNG, dimensões e hash de todos os bytes antes de qualquer envio.
- Reserva uma única publicação para evitar duplicações em cliques repetidos, timeout ou erro ambíguo.
- Fecha a autorização em 18/11/2026, 00:00 BRT; depois disso não envia a prévia antiga.
- Não usa `TELEGRAM_BOT_TOKEN` no navegador; a credencial permanece somente no Worker.
- Não modifica o serviço de alertas M6+, fontes sísmicas, design `telegram-imperial-bronze-v1`, crons, id do canal ou histórico sísmico.
- A imagem aprovada **ainda não é um template editável e georreferenciado** para futuros terremotos. Não se devem reutilizar Tual, Indonésia, magnitude M6,6 ou data de 16/11 em outros eventos.

## Arquivo no repositório

O módulo `worker/telegram-imperial-preview.mjs` documenta a identidade criptográfica do arquivo e realiza o envio. O repositório **não contém automaticamente** o PNG completo até que os bytes sejam importados como arquivo binário. Não anunciar a existência do arquivo `assets/telegram/m6/imperial-bronze-master.png` sem verificar sua presença e SHA.

## Sincronizar os bytes do PNG para o GitHub após o envio

A partir da versão com sincronização, o upload administrativo grava uma cópia temporária e intacta no namespace KV **TTS_USAGE** (TTL de 14 dias), sob uma chave fixa. O endpoint público de leitura está restrito ao SHA-256 exato do cartaz já destinado à publicação pública no Telegram:

`GET /telegram-imperial-preview-source/ed3cf9da86aa041673d98a40172649b498e879137da9a2b8a40810f6fe699a75.png`

O fluxo diário já existente `.github/workflows/cloudflare-kv-daily-report.yml` executa um **job separado e sem credenciais Cloudflare**, com permissão `contents: write` limitada a esse job. Ele chama `tools/import-telegram-imperial-preview.py` e confere assinatura, dimensões e SHA-256 do arquivo antes de colocá-lo em `assets/telegram/m6/imperial-bronze-preview-2026-11-16-m6-6.png`. Se o upload ainda não aconteceu, a etapa faz nada. Se o arquivo existe com bytes diferentes, o job falha e não sobrescreve.

A importação só é considerada concluída quando o commit do arquivo real aparecer no GitHub; o manifesto JSON sozinho não prova presença do PNG. A foto fixa do exemplo M6,6 não substitui o renderizador dinâmico de futuros eventos e não deve ser enviada como um terremoto novo.
