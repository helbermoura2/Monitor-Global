# Imagens sísmicas: contornos vazados e contexto regional

As imagens de alerta do Telegram e as imagens sísmicas compartilhadas pelo site usam o mesmo traçado de isolinhas MMI, sem preencher as áreas. Um contorno escuro melhora o contraste sobre o satélite. As etiquetas laterais ligam cada linha ao seu nível e significado: II/III fraca, IV leve, V moderada, VI forte, VII muito forte, VIII severa, IX violenta, X extrema. Apenas linhas efetivamente visíveis recebem etiquetas; não são faixas de danos.

Quando disponível, a grade oficial USGS ShakeMap define os contornos irregulares. Lacunas e bordas da grade não são fechadas com linhas inventadas. Na ausência da grade, utiliza-se o modelo geodésico já existente, explicitamente identificado como estimado. O indicador MMI estimado da imagem agora usa os mesmos limiares PGA dos contornos. O recorte terrestre é preservado.

O minimapa tem os mesmos limites e epicentro nos dois geradores. A imagem do site busca esse mapa somente ao gerar o compartilhamento; não há novas consultas periódicas nem chamadas a Durable Objects para o minimapa. No Telegram, reaproveita-se a consulta regional existente. O mapa principal prioriza satélite e mantém a alternativa topográfica se o provedor falhar.

Versão de imagem: `hollow-v13-context`. A fila normal existente pode editar fotos recentes elegíveis, sem publicar mensagens duplicadas. Não se executam testes sintéticos contra o Telegram de produção.

Validação: testes locais de costa/lacunas, preservação dos pixels interiores, níveis e etiquetas MMI, paridade de imagens, suíte de serviços Worker e exportação Story com provedores simulados. A prévia local da China usa a estimativa quando a grade oficial não é fornecida ao renderizador; não deve ser confundida com a versão oficial do evento.
