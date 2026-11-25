# Argos Orbis TV — Meteorologia avançada
Referência estável: 1.0.154 / 10154. Uma única publicação oficial depois das 20 etapas. Não alterar versionCode, stable.json ou assinatura durante as etapas intermediárias.
## Checklist
- [x] 01 Auditoria preliminar
- [x] 02 Validação operacional INPE — https://github.com/helbermoura2/Monitor-Global/actions/runs/45714844709
- [x] 03 Cobertura meteorológica — conclusão comunicada pelo usuário; relatório independente ainda não localizado. Não inferir cobertura efetiva nacional da bbox da coleção.
- [x] 04 Infraestrutura e custo zero — https://github.com/helbermoura2/Monitor-Global/actions/runs/45715671942; acesso direto HTTPS sem autenticação, 27.450 bytes de metadados, ativo 1.009.052 bytes, NETCDF3_64BIT_OFFSET (CDF-2), eixos monotônicos, 3,48 s para a prova. Decoder Android ainda não testado.
- [x] 05 Estrutura das camadas — WeatherMapLayer.java e teste Java 11 aprovado: https://github.com/helbermoura2/Monitor-Global/actions/runs/45715816642
- [ ] 06 Sobreposição de radar — leitor CDF-2 validado contra NetCDF4: https://github.com/helbermoura2/Monitor-Global/actions/runs/45715947484 (64.646 células válidas, pico 55,84 dBZ); cliente e sobreposição no visualizador existentes implementados, teste gráfico Android pendente.
- [ ] 07 Intensidade da precipitação
- [ ] 08 Legenda meteorológica
- [ ] 09 Consulta regional
- [ ] 10 Histórico
- [ ] 11 Animação
- [ ] 12 Controles temporais
- [ ] 13 Nowcasting espacial
- [ ] 14 Previsão espacial de seis horas
- [ ] 15 Movimento GOES
- [ ] 16 Tarja CNN
- [ ] 17 Efeitos de chuva
- [ ] 18 Refinamento visual e D-pad
- [ ] 19 Testes integrados
- [ ] 20 Publicação única
## Etapa 04: arquitetura proposta
Preferir acesso HTTPS direto da TV ao STAC INPE e aos ativos CAPPI, sob demanda quando o mapa estiver aberto. Sem Worker novo, chave, assinatura paga ou polling contínuo. A etapa 02 verificou três arquivos de 1.009.052 bytes e matrizes de 250.000 valores; lat/lon unidimensionais. Atrasos observados de 28–38 minutos; não confundir intervalo de aquisição com atraso. O valor -99 não tem interpretação validada; manter separado dos valores quantitativos, junto com fill -9999.9 e não finitos. Verificar documentação e atributos antes de decidir classificação. DBZ não é mm/h.
Limites de projeto, sujeitos a teste na TCL: máximo 2 radares selecionados simultaneamente no piloto, 6 quadros por radar, 12 MiB por ativo, 16 MiB de cache bruto total, 4 MiB de metadados, 1 consulta em andamento, atualização manual ou intervalo mínimo de 10 minutos com visualizador aberto; cancelamento ao sair. Não baixar toda a rede por quadro. Decodificar no máximo dois quadros de trabalho; arrays e bitmaps limitados. Usar cache local de disco limitado, sem apresentar cache vencido como atual. Idade operacional provisória >60 min indica dado vencido, sempre exibir tempo real de aquisição e idade. Áreas fora da cobertura, valores especiais e lacunas não são ausência de chuva. Se endpoint indisponível, preservar GOES existente e mostrar radar indisponível, nunca gerar manchas fictícias.
Prova de viabilidade: repetir somente consulta pequena à fonte oficial, inspecionar assinatura binária, formato NetCDF, esquema e atributos. Se NetCDF clássico, avaliar leitor Java restrito aos campos necessários; se HDF5, avaliar alternativas sem dependências nativas antes de aprovação. Não afirmar viabilidade de decodificação Android até a prova. Não usar GitHub Actions como servidor de radar permanente. 
