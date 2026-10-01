# Chuva de curto prazo

A barra mostra previsão de chuva por modelos. Alagamentos permanecem separados no painel meteorológico, com consulta CGE identificada.

Fontes: ECMWF, NOAA/GFS e DWD/ICON, consultados via API Open-Meteo. As previsões de precipitação são acumulados da hora anterior ao timestamp. A janela de chuva engloba as horas onde os modelos indicam >=0,2 mm/h; não é uma previsão de minuto exato. Se modelos divergem sobre chuva ou o início varia por mais de uma hora, o sistema não apresenta chegada consensual. Um modelo sozinho não produz chegada consensual. Valores nulos, negativos, desatualizados ou de outra localização não são utilizáveis.

O acumulado exibido refere-se à próxima faixa horária completa, identificada no painel em BRT. Não se rateia um total horário para inventar milímetros dos próximos minutos. Consultas expiram em 20 minutos.

Verificação em 01/10/2026: o endpoint público RainViewer retornou radar.past e radar.nowcast vazio. O relatório SAISP em https://www.saisp.br/online/ correspondia a 07–08/09/2026, então não foi usado como medição atual nem ETA. CGE oferece consulta visual de radar em https://www.cgesp.org/v3/mapas.jsp?arq=precipitacaoradar. Os links oficiais permitem consulta, sem atribuir a eles a previsão automática do site. Integração automática de nowcasting institucional ainda requer um feed atual documentado.
