# Saúde das fontes e cobertura regional

A saúde é preenchida pelas consultas reais dos catálogos/produtos, não por pings a páginas iniciais ou endpoints de versão. GDACS tem estados independentes para enchentes, ciclones, incêndios e vulcões. Falha de consulta não significa que o instituto inteiro esteja offline.

GEOFON: FDSN `format=text`, com cabeçalho e campos validados. O formato GeoJSON antes solicitado não é suportado. O proxy aceita texto somente nesse catálogo e aceita DOCTYPE HTML nos institutos que fornecem catálogos HTML; isso permite OSC-BOL e CGE sem tratar páginas arbitrárias como JSON.

OVSICORI Costa Rica: mapa público oficial com o último sismo; campos e coordenadas extraídos sem executar scripts; hora local UTC−6. Esse produto não é um catálogo completo.

MARN El Salvador: tabela pública dos últimos dez sismos reportados, inclusive eventos de países vizinhos; hora local UTC−6. País não é fixado como El Salvador quando o evento está fora dele.

Os dois canais entram no mesmo ciclo, deduplicação multiagência, atualização e prioridade de câmera existentes. Eventos fora de 36 horas ou mais de 5 minutos no futuro são descartados.

Peru mantém IGP, Bolívia mantém OSC, Venezuela mantém FUNVISIS via espelho comunitário identificado; USGS e EMSC complementam essas regiões. SGC Colômbia ainda precisa de um canal de consulta validado: os endereços pesquisados não responderam com catálogo utilizável neste ambiente. SSN México respondeu HTTP 503 na verificação: falha real mantida visível, sem fingir sucesso.

ANA: API pública legada pausada e explicitamente marcada como PAUSADA; integração atual depende de credenciais. Chuva SP baseada no Open-Meteo tem esse nome no diagnóstico, sem atribuição ao CEMADEN.


A tela “Situação das fontes” e o indicador de atualização abrem o mesmo diagnóstico. Cada produto conserva a última tentativa, a última consulta válida e o erro mais recente. Falhas ou respostas parciais não renovam o horário de uma consulta válida. Quando o serviço intermediário informa o horário original de consulta de um catálogo em cache, esse horário é preservado. Consultas com zero eventos são válidas; não se exige um número mínimo de registros.

Prazos de atraso respeitam o produto: sismos 2 minutos, fontes horárias de ciclones/vulcões 75 minutos e incêndios com ciclo de 6 horas até 7 horas. Radar desligado, ANA pausada, ausência de conexão e fontes ainda não consultadas têm estados próprios. O indicador principal continua referente a sismos e lista nominalmente as fontes sem atualização recente; pendências nas demais categorias ficam separadas no diagnóstico. PTWC e NTWC informam resposta parcial quando alguns produtos oficiais falham. A atualização visual usa o agendador existente e pausa com a aba oculta.
