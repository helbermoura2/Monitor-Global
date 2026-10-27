# Monitor Global TV 1.0.14 — ciclo regional de tsunami

O mesmo cenário fictício é produzido pelo Worker, consumido pelos testes do site e decodificado pelo aplicativo. São 15 etapas: referência silenciosa; avisos para Vanuatu e Fiji e “sem ameaça” no Alasca; republicação sem mudança; revisão M7,2→M6,9 e da previsão; indisponibilidade sísmica; correção da origem; encerramento em Vanuatu mantendo Fiji; “sem ameaça” em Fiji; repetição; falha/recuperação de boletins; nova escalada em Fiji; falha durante aviso ativo; recuperação e encerramento final.

## Correções

- A versão de significado regional independe da disponibilidade do catálogo sísmico, do ID do boletim e da hora de republicação. Falha/recuperação de uma consulta não reapresenta uma situação idêntica.
- Quando a origem é corrigida e o ID derivado muda, a TV acompanha o mesmo produto oficial. A identificação usa o produto, ID oficial do evento quando disponível, associação sísmica precisa ou origem com até dez minutos e 100 km, nas mesmas condições conservadoras do modelo compartilhado. Produtos diferentes não se cancelam; correspondências ambíguas não são escolhidas.
- A identidade compacta é preservada no rastreamento entre reinícios. O limite de 256 registros permanece; não há histórico ilimitado ou novas consultas por televisão.
- Encerramentos substituem apresentações pendentes/ativas do mesmo produto, inclusive durante falha do catálogo sísmico. A fila recalcula o contexto a partir dos outros boletins ativos para não apagar Fiji junto com Vanuatu nem ressuscitar um aviso encerrado.
- O significado integral do boletim é comparado por SHA-256 no cliente, evitando ignorar mudanças em regiões depois do limite de texto visível. A versão anterior permanece disponível no protocolo para migração silenciosa e compatibilidade com APKs antigos.
- “Sem ameaça” pode passar a elegível quando chega a associação precisa; aparece uma vez, sem som. Sismos anteriormente M6+ continuam relevantes mesmo se revisados abaixo de seis.

Tamanho, animações, troca de oito segundos, radar, fontes, canais e permissões não foram alterados. Nenhum serviço novo, permissão remota ou canal Telegram é necessário.

## Verificação

`node tools/tsunami-lifecycle-fixtures.mjs --check` confirma que `app/src/test/resources/tsunami-lifecycle.json` corresponde ao Worker atual. `TsunamiLifecycleTest` passa esses JSONs pelo codec, rastreador, associação, fila e temporização reais do APK. Também verifica persistência, migração, escopos diferentes, origens incompatíveis e ambiguidade.

O navegador testa painel e mapa com as mesmas etapas em 390 e 1280 px, mantendo o sismo selecionado para isolar o conteúdo; a apresentação automática nativa tem suíte separada. Não houve envio de alerta, mensagem Telegram ou teste físico remoto. O retorno após desligar/ligar já foi confirmado pelo proprietário e não é reclassificado como pendente.
