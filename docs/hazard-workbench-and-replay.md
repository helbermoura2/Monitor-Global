# Contexto vulcânico, riscos brasileiros e reprodução

## Vulcões

Cartão → Atividade apresenta a classificação do boletim, mudanças recebidas,
horário do registro, cinzas, movimento publicado da pluma, alertas e observatório.
Usa os campos já recebidos de VAAC/USGS; não transforma uma menção em erupção.
Distingue cinzas ressuspensas, encerramento do boletim e atividade reportada.
Campos ausentes permanecem não informados. FL é altitude de pressão em centenas
de pés; não é altura sobre a cratera. O link Smithsonian é contexto semanal.
Nenhuma fonte nova depende de credencial ou implantação do Worker.

## Riscos no Brasil

Menu → Riscos no Brasil consulta `data/cemaden-alerts.json`. O gerador lê o mesmo
catálogo público do painel oficial (`https://painelalertas.cemaden.gov.br/wsAlertas2`)
e mantém apenas status 1 (vigente). Valida todo registro ativo e preserva a versão
anterior em caso de falha. O arquivo fica atribuído ao Cemaden e retém código IBGE.
As datas de emissão/atualização sem fuso permanecem como publicadas; somente a
consulta do catálogo possui instante UTC verificável. Não assume BRT para esses
campos nem anuncia o horário da consulta como emissão de novo alerta.

Workflow `cemaden-alerts.yml`: programado a cada 15 minutos, com publicação pelo
GitHub Pages. O agendador e a publicação podem atrasar. O frontend rejeita catálogos
com mais de 45 minutos, retira pontos expirados e mantém links para a fonte. Não
usa proxy público nem acrescenta operações no Workers KV. A consulta do catálogo
estático é sob demanda, compartilhada por cinco minutos.

Os pontos são referências municipais publicadas, não locais exatos de ocorrência
ou polígonos de inundação/deslizamento. Filtros por município/UF e lista INMET
complementam a leitura. Em Meus lugares, a associação Cemaden exige código IBGE
confirmado; não usa município vizinho ou distância ao centro para atribuir aviso.
Não injeta um alerta antigo no ciclo como se tivesse acabado de ser emitido.

## Rever evento

Botão no cartão e entrada do menu. Revisita o evento selecionado em quatro etapas
(foco, área/região, foco, visão geral), com pausa, avanço/retorno e 0,5×/1×/2×.
O rótulo REPRODUÇÃO mantém a origem/publicação original. Usa produtos disponíveis
agora e informa isso; não reconstrói versões históricas que não foram arquivadas.
É uma apresentação visual, não uma reconstituição física no tempo.

Não altera registros, datas, estado NOVO, filas ou áudio. Bloqueia apenas rotação
aleatória. Outra seleção encerra a reprodução sem restaurar a câmera antiga.
Arrastar pausa sem chamar map.stop dentro do gesto. Encerrar retorna à câmera
anterior apenas se o evento continua selecionado e libera o ciclo normal.

Verificações: modelos de contexto, datas sem fuso, estados/expiração, falhas do
catálogo, desktop/mobile, menus, origem preservada, silêncio, controles, arrasto,
troca de evento e pontos municipais/locais salvos. Dados reais foram consultados
no serviço público do Cemaden; não foram enviadas mensagens externas.
