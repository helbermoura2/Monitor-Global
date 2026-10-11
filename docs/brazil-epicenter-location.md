# Município do epicentro no Brasil

O Telegram (imagem e legenda) e os sismos brasileiros do resumo diário usam o município que contém as coordenadas publicadas pela rede sísmica. A cidade mais próxima e a sede municipal não são usadas para determinar onde o epicentro caiu.

`brazil-epicenter-location.mjs` faz ponto-em-polígono nas malhas do IBGE, com suporte a polígonos múltiplos e buracos. A malha estadual está no pacote do Worker; as municipais são consultadas por estado e mantidas em cache por 24 horas (máximo quatro estados, requisições simultâneas deduplicadas, timeout de cinco segundos, falhas por um minuto). A nomenclatura vem do catálogo de municípios já usado pelo projeto. Nenhuma chave de geocodificação é necessária.

Fonte dos limites estaduais, obtidos em 11/10/2026:
https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF

Limites municipais:
https://servicodados.ibge.gov.br/api/v3/malhas/estados/35?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio

As malhas são simplificadas. Pontos sobre a linha ou com mais de uma correspondência não recebem um município presumido. Fora do Brasil, no mar ou se o IBGE estiver indisponível, permanece a descrição da fonte. Essa identificação corresponde às coordenadas publicadas; não elimina a incerteza do epicentro calculado pela rede.

O evento guarda `originalPlace` e `epicenterMunicipality` (código IBGE, nome, UF, coordenadas e provedor). Mudanças de coordenadas exigem nova identificação. A versão da mensagem inclui a localização para permitir correção da legenda nas revisões. Fotos recentes entram na migração existente, preservando estimativas de população já disponíveis.

Regressão real: USP `usp2026twuv`, 10/10/2026 17:41:54 BRT, latitude -20.710712432861328 e longitude -47.66289138793945, pertence a Nuporanga/SP (3533601). O mesmo resultado vale para as coordenadas EMSC arredondadas (-20.71, -47.66), cuja descrição regional era Minas Gerais–São Paulo.
