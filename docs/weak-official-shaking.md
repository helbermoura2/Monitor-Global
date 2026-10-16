# Mapas oficiais fracos e exposição no catálogo bruto

O sismo da Nova Zelândia de 15/10/2026, 05:25 UTC (USGS `us6000u2ev`, GeoNet M5,7), reproduziu duas falhas independentes:

1. A grade oficial reduzida tem MMI entre 1,2 e 2,5. O renderizador descartava faixas abaixo de 3, produzindo mapa vazio apesar da existência do produto. Agora mantém faixas publicadas a partir de 1,5 (II arredondado), em tons azuis. Os valores não são aumentados e continuam recortados por terra, sem preencher NoData. As faixas PAGER usam limites de meia unidade (III+ começa em 2,5); contornos fracos e exposição III+ são informações distintas. A grade continua sendo uma estimativa publicada pelo USGS, sem confirmação de quem sentiu ou de danos.
2. Registros FDSN/GeoNet no catálogo bruto podem omitir `type`; a lista normaliza esse campo, mas o cartão recebe o registro bruto. A rotina de exposição exigia `type === 'earthquake'` e saía antes de consultar o serviço. Aceita agora a mesma identificação sísmica já usada no restante do site: tipo explícito ou magnitude válida sem outro tipo declarado.

O PAGER desse evento retornou 19.661 pessoas na faixa III+, zero nas faixas V+ e VI+. Esses são valores estimados de exposição publicados pelo USGS, não relatos individuais. As respostas reais de ShakeMap e PAGER foram preservadas em `tests/fixtures/shaking/` para reprodução, sem fixar esses números no aplicativo.

O resumo de exposição passa a aparecer após o horário do evento no cartão, com fonte nos detalhes e estados visíveis para consulta em andamento ou indisponibilidade. Não atribui zero a uma consulta fracassada. A consulta é pausada em segundo plano e retomada usando o registro selecionado atual.

Fontes: `https://earthquake.usgs.gov/earthquakes/eventpage/us6000u2ev/` e os produtos públicos USGS ShakeMap/PAGER. A fotografia/cartografia de fundo é independente da grade.
