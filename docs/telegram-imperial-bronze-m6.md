# Telegram — alertas M6+ Imperial Bronze (16/11/2026)

## Referência aprovada

Modelo de 16/11/2026 fornecido pelo proprietário: placa grega em bronze envelhecido, com relevo metálico, borda meandro, carta sísmica ao centro e painel inferior de dados. A preferência final foi:

- Logo completo oficial **ΠΑΝΟΠΤΗΣ / CUSTOS ORBIS** reduzido à esquerda de **ARGOS ORBIS**, sem substituir por logo compacto.
- Nome completo do local, **bandeira imediatamente após o nome do país** (ex.: “Indonésia 🇮🇩”), somente quando o país for reconhecido com segurança.
- Uma única magnitude grande na caixa superior, sem a linha repetida “Tanimbar · M6,7” e sem rótulo “EPICENTRO · M6,7” sobre o mapa.
- Mapa **variável conforme latitude e longitude** do evento, colorido em bronze, anéis concêntricos meramente indicativos e nomes de cidades apenas quando a fonte geográfica fornecer os locais. O mapa indonésio do conceito não é congelado no código.
- Painel: data e hora BRT, profundidade, fonte, revisão e intensidade, sempre com ressalva de que **estimativa não confirma danos**.
- Rodapé com site **argosorbis.com.br**, ícone Telegram e identificador contínuo **@argosorbis**.

## Produção e limites

A versão `telegram-imperial-bronze-v1` é aplicada apenas a eventos com magnitude **M6,0 ou superior**. Registros brasileiros abaixo de M6 mantêm o layout anterior `telegram-glass-v19`. A imagem é PNG **1080 × 1920**, construída pelo Worker em `js/quake-telegram-bronze.js` com composição e letras dinâmicas e pelo tom cartográfico `worker/telegram-bronze-tone.mjs`. Não há valores, países, datas ou epicentros fictícios fixos no código. O relevo é uma interpretação procedural do modelo aprovado — não é a pintura estática colada sobre novos países.

Aviso oficial de tsunami é acrescentado somente com warning/watch/advisory ativo, e cancelamentos usam a cópia das imagens originais em arquivo para restaurar o mesmo mapa sem recarregar a fonte. Os IDs do Telegram, credenciais, regras de deduplicação e horários de coleta/envio não são alterados. Revisões e novos alertas usam a mesma seleção de versão do cartão. Testes são simulados, nunca postados no canal real.
