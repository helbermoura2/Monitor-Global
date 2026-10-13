# Reserva populacional nas imagens do Telegram

A imagem inicial consulta USGS PAGER e WorldPop. Se não houver resultado em 2,5 segundos ou a consulta falhar, calcula uma reserva por localidades GeoNames. Não são enviados alertas de teste; alterações posteriores usam o ID da foto existente.

A reserva soma as populações cadastradas cujos centros ficam na área modelada de MMI III+, V+ e VI+. Usa os valores do ShakeMap quando há grade oficial compatível, sem extrapolar a cobertura ou os pixels sem dados. Sem grade, usa a equação de intensidade Allen/Wald/Worden já utilizada pelo projeto, limitada a M3–8,5, até 70 km de profundidade e raio máximo de 500 km. Sem localidades encontradas, retorna desconhecido; não presume população zero.

O número principal é arredondado para dois algarismos significativos. A imagem identifica **estimativa preliminar**, **GeoNames**, **cobertura parcial**, população rural incompleta e possível sobreposição de áreas urbanas. Não representa relatos, feridos ou danos. As faixas cumulativas não são somadas. Faixas sem localidades cadastradas ficam desconhecidas, não viram zero.

Prioridade dos dados: PAGER → WorldPop → reserva GeoNames. Uma reserva parcial ou falha não substitui dados melhores já publicados. Verificações de M5,5+ ocorrem a cada minuto na primeira hora da origem; depois, a cada cinco minutos, até 24 horas. A fila é limitada e ordenada pelo vencimento para não deixar fotos antigas esperando indefinidamente. Apenas diferenças efetivas geram edição.

O catálogo vem do snapshot GeoNames cities500 indicado em `assets/population/geonames-localities-v1.json`, com licença CC BY 3.0, origem e SHA-256. São 177.708 localidades com população positiva; populações têm datas cadastrais variadas, sem alegação de censo atual. Nomes iguais no mesmo país a até 2 km são consolidados pela maior população cadastrada, mas isso não elimina toda possível sobreposição urbana.

O binário de 2,8 MB é carregado somente pelo Worker, compartilhado em memória e validado. O cliente do mapa não baixa esta base. Os registros são ordenados por latitude para limitar a busca; resultados físicos ficam em cache limitado.

Reprodução: obtenha o JSON da URL fixada nos metadados e rode `python3 tools/build-geonames-localities.py /caminho/cities500.json`. Não publique o JSON bruto na aplicação.

Verificações: `node --test tests/unit/telegram-population-reserve.test.mjs tests/unit/quake-card-layout.test.mjs` e `node tests/unit/telegram-revision-check.mjs` (Telegram simulado).
