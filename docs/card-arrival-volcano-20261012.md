# Efeitos na chegada e boletins vulcânicos de 12/10/2026

O cartão é preenchido na seleção, mas seus efeitos começam ao concluir a aproximação final da câmera: 6 segundos na primeira entrada e 18 segundos na viagem entre eventos. A consulta opcional de recursos pode começar antes, sem iniciar animações. A chegada usa o registro atual do store. Selecionar outro evento ou interagir com a câmera cancela os efeitos aguardando; uma revisão silenciosa não reinicia o voo ou a cena. Sons e prioridade de alertas permanecem independentes desse atraso visual.

A interpretação vulcânica usa uma cópia dos campos originais do boletim, mesmo enquanto o texto de apresentação aguarda tradução. A abreviação VAAC `ERUPTION REP AT` identifica erupção relatada e tem tradução local. Monitoramento, negações e ausência de lava continuam com perfis distintos. O parser conserva a nuvem estimada (`EST VA CLD`) e as observações (`RMK`). O status atual do USGS também deixa de ser substituído por um VONA mais antigo, preservando esse VONA como referência.

Registros verificados nas fontes oficiais:

- Ibu, VAAC Darwin 2026/1161: boletim de 13/10, 01h00 UTC, relatando erupção de 12/10, 22h52 UTC (19h52 BRT). O boletim menciona emissões informadas pelo CVGHM; a nuvem do produto é estimada. Fonte: https://www.bom.gov.au/products/Volc_ash_latest.shtml
- Great Sitkin: boletim USGS/AVO de 12/10, 19h02 UTC, confirmando continuidade de erupção lenta de lava. Não representa uma nova explosão. Fonte: https://volcanoes.usgs.gov/hans-public/notice/DOI-USGS-AVO-2026-10-12T18:56:41%2B00:00
- Shishaldin: o mesmo boletim informa instabilidade baixa. Esse texto não justifica efeito de lava.

Os dados atuais permitem reproduzir falhas de classificação e duração; não comprovam quais telas foram exibidas na sessão do usuário no dia 12.

Os testes de chegada cobrem o caminho real da seleção, as transições, cancelamento e os boletins acima. Os testes exclusivos do renderizador isolam a câmera e os prazos de rotação para avaliar materiais e controles de modo determinístico.

A suíte de materiais do cartão verifica que as demonstrações não movem a câmera. O tsunami fica na suíte própria do mapa, pois seu passeio move a câmera intencionalmente e deve restaurar a vista ao parar.
