# Efeitos de tela inteira ativos

Os efeitos aprovados compartilham o renderizador dos testes e não consultam APIs, mudam coordenadas, criam registros ou disparam áudio.

- Lava: 10 s, junto do cartão após a chegada, quando o perfil indica lava ou a fonte reporta explosão vulcânica. Monitoramento rotineiro e cor de alerta isolada não acionam o efeito. Reconfirmações do mesmo boletim não o reiniciam.
- Chuva: 10 s quando o Rainbow Nowcast local válido passa a indicar chuva **agora**. “Chuva chegando” mantém seu aviso, sem antecipar a animação. A densidade visual acompanha a taxa prevista. Clarões ao vivo exigem código de trovoada de condições atuais válidas ou evidência meteorológica próxima. A demonstração continua mostrando clarões ilustrativos. Há um disparo por episódio e uma janela seca de 20 min para rearmar. Sismos fortes, tsunami selecionado e apresentações protegidas têm prioridade.
- M8+: apresentações novas/manuais duram 24 s e usam a magnitude real, com queda escalonada dos registros visíveis. No celular, registros entram apenas se sua janela estiver aberta. O modo aleatório conserva a apresentação discreta existente. O canvas adicional de fissuras não inicia um sismo fictício nem reinicia o cartão.
- Tsunami: removida a opção de tela inteira e recusado seu acionamento direto. Os avisos, mapas e passeios existentes de tsunami continuam separados dessa camada.

Troca de evento, Escape, movimento reduzido e saída da aba interrompem as cenas e restauram os elementos. Respostas tardias do carregamento opcional não ressuscitam uma cena cancelada. Deduplicação e estado são locais à página, sem Workers KV.

“Ruptura alongada fictícia” é uma grade sintética usada para testar pintura e câmera ao longo de uma falha simulada. Não confirma direção, extensão ou mecanismo de falha de um evento real. “Mapa oficial USGS” usa a grade histórica publicada para o sismo da Turquia de 06/02/2023.
