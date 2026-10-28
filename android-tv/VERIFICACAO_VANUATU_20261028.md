# Vanuatu: revisão e título completo — 28/10/2026

Relato: site mostrou M6,1 após M6,0, sem nova tarja na TV; nome do país teria sido cortado. A imagem mencionada pelo dono não ficou disponível nesta etapa e a versão instalada ainda não foi confirmada.

Evento consultado: **USGS us7000ttlm**, 214 km a noroeste de Port-Olry, origem 28/10 às 02h21m45 UTC (27/10 às 23h21m45 de Brasília). No momento da verificação, USGS FDSN, detalhe e resumo horário retornavam **M6,0**, com publicação revisada às 02h35m12 UTC. O endpoint público da TV tinha o mesmo M6,0, identificador e atualização; todas as fontes do endpoint estavam disponíveis. EMSC retornava M6,0 e GEOFON 5,93. GeoNet não retornou correspondência na consulta realizada.

Esses dados atuais não provam que nenhuma agência ou resposta anterior tenha mostrado M6,1. O site consolida várias agências; a TV usa USGS nos sismos globais e catálogos adicionais para o Brasil. Uma troca de solução no site não equivale necessariamente a uma revisão do USGS que a TV deva repetir. A causa do episódio relatado continua sem confirmação.

## Validação offline

- Catálogo/serviço: simulação M6,0 → M6,1 conserva o identificador, muda a versão enviada, mantém elegibilidade e preserva o país. Os 18 testes de catálogo, endpoint e contexto passaram.
- Aplicativo: M6,0 → M6,1 gera uma única revisão com magnitude anterior e atual; repetição do mesmo snapshot não dispara outro aviso. O evento novo não é confundido com a primeira fotografia silenciosa de uma fonte.
- Renderização Android/Skia: o título chega ao fim, incluindo Vanuatu, em alerta real, revisão, resumo e tsunami, usando o caminho real de desenho da versão 1.0.22. Comparação de pixels no ponto final do movimento, com bandeira fixa e a duração já existente.
- Suíte Android completa: 64 testes aprovados. Isso não substitui a verificação da versão e do estado do aparelho físico.

Não houve alteração de fonte, corte de magnitude, frequência, regra de revisão ou execução do app. Foram adicionados testes de regressão, sem novo APK e sem mensagens no Telegram. Para concluir o diagnóstico do episódio específico, falta identificar a fonte mostrada no cartão M6,1 e a versão instalada no aparelho.

[Estado público consultado](../docs/audits/vanuatu-revision-20261028.json).
