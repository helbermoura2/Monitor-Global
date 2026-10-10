# Áreas de avisos INMET no mapa

O mapa utiliza os polígonos oficiais (`poligono`) de cada aviso ativo, recortados pelo território brasileiro. A malha do Brasil vem da API de malhas do IBGE, país BR, qualidade intermediária, consultada em 9/10/2026: https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria

As cores seguem a gravidade do INMET. Nas sobreposições, o preenchimento de maior gravidade prevalece: a geometria dos avisos inferiores é subtraída, evitando somar opacidades e inventar uma gravidade visual diferente. Baixa umidade recebe linhas diagonais; outros avisos têm preenchimento contínuo. O polígono representa a área de abrangência do aviso, não uma previsão de impacto uniforme em todos os pontos.

Ícones aparecem somente para o aviso em apresentação (novo, manual ou automático), com um único ícone por aviso. As sedes municipais continuam disponíveis para a lista, busca e identificação no zoom próximo, sem centenas de ícones. A seleção de outro evento remove o ícone e os nomes do aviso anterior. Avisos sem polígono válido mantêm pontos pequenos nas sedes verificadas, sem inventar contornos a partir das cidades.

Filtros de tipo, gravidade, região e validade continuam aplicados. Os limites de geometria de maior gravidade são calculados apenas quando os dados ou filtros mudam; selecionar outro aviso atualiza o destaque. O efeito do cartão não foi alterado nesta mudança.

Validação: cenários no desktop e celular com sobreposição real de geometrias de teste, gravidade, seleção manual/automática/nova, um único ícone, remoção do destaque, ocultação por tipo, expiração e regressões de municípios/cores.
