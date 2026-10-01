# Meteorologia com evidências separadas

O indicador de alagamento não usa score de chuva, umidade ou proximidade de alertas. Apresenta apenas contagem ativa do CGE na capital paulista, consultada há até 20 minutos. Contagem desconhecida, falha de consulta e falta de cobertura não significam zero. O parser exige referência explícita a pontos ativos; totais genéricos e históricos não servem.

A chuva observada vem de METAR recente (até 75 minutos), limitado a estações até 35 km do ponto selecionado. REDEMET continua disponível; a rota `/metar-observed` acrescenta distribuição pública do NOAA Aviation Weather Center para SBSP, SBGR e SBMT. A observação vale para o aeródromo, não para todos os bairros. Não mede acumulado em mm nem prova alagamento.

A previsão compara acumulados horários de ECMWF IFS, GFS e ICON via Open-Meteo, nas próximas aproximadamente seis horas. Consulta a cada cinco minutos; validade de exibição de 20 minutos. Com pelo menos dois modelos, mostra concordância ou divergência pelo limiar de 1 mm acumulado; esse limiar é apenas descritivo, não uma probabilidade calibrada ou alerta hidrológico. Valores ausentes não são convertidos em zero. Nenhum modelo disponível implica comparação indisponível.

O site mantém o radar visual e avisos oficiais INMET. Não infere horário exato de chegada de chuva lendo pixels de tiles, nem alagamento a partir de chuva prevista. Avisos locais de chuva/tempestade gerados por modelo foram removidos da lista de eventos e do áudio. Critérios locais de calor, vento e umidade não são avisos oficiais da Defesa Civil.

Limites: não há integração de pluviômetros físicos CEMADEN, nível de rios urbanos nem radar quantitativo validado. Portanto o site não prevê inundação em uma rua ou bairro. A consulta CGE indica quando o portal foi consultado, e não comprova atualização do próprio portal.
