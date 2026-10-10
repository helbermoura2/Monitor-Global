# Aviso local de chegada da chuva

O aviso usa exclusivamente o Nowcast Rainbow validado que já alimenta a barra meteorológica. Não consulta outra API nem aumenta a frequência das consultas.

- Quando a chuva está prevista para os próximos 20 minutos, ou já aparece na previsão atual, o desktop vira o cartão principal por 12 segundos. No celular, um aviso sobe da parte inferior por até 20 segundos.
- Mostra o tempo estimado, intensidade máxima na próxima hora, acumulado previsto em milímetros e gráfico em mm/h. Não representa medição de chuva observada.
- Fechar, voltar ao evento ou abrir a previsão encerra o aviso. O evento selecionado e a câmera permanecem preservados.
- Sismos M5+, tsunami, apresentação de evento prioritário, verso de população e detalhes manuais impedem a abertura. A chegada de um evento prioritário fecha o aviso imediatamente. Avisos pendentes são reavaliados a cada 15 segundos, usando apenas o cache existente.
- Um episódio é avisado uma vez por localização e sessão, inclusive após recarregar. Só uma previsão seca contínua por 20 minutos, ou um intervalo superior a seis horas sem chuva elegível, rearma o aviso. Falha de consulta não rearma.
- Mudança de localização e página oculta encerram o aviso. Dados de outro local, vencidos, neve e previsão acima de 20 minutos não abrem o aviso.

Validação: `PLAYWRIGHT_BROWSER_CHANNEL=chromium npx playwright test tests/rain-arrival-notice.spec.js tests/rainbow-nowcast.spec.js --workers=1`.
