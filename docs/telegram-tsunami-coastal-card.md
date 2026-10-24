# Imagem regional de tsunami no Telegram

A composição `tsunami-coastal-v1` é uma foto própria, complementar à foto do sismo: mapa costeiro e minimapa, situação por região com autoridade/horário, duas últimas atualizações, dados disponíveis e orientação oficial. Não modifica a câmera nem os efeitos do site.

A rotina usa o coletor oficial existente, dentro da fila serializada de `EarthquakeAlertDelivery`. Não há novo cron, binding ou escrita em KV. O estado de entrega fica em `telegram-tsunami-delivery-v1` no armazenamento desse objeto. Até 24 ocorrências são acompanhadas, com no máximo duas ações por execução. Avisos ativos recentes (até seis horas na primeira observação) podem iniciar uma foto; informativos, ausência de ameaça e cancelamentos isolados não geram uma nova foto de alarme. Após o envio, produtos relacionados e encerramentos revisam o mesmo ID durante a janela de 72 horas dos boletins. A configuração de destino é a mesma do Telegram existente.

A associação usa o identificador oficial ou origem explícita (até dois minutos e 100 km entre autoridades diferentes); a publicação ou a proximidade de uma área costeira, sozinhas, não associam ocorrências. Produtos distintos continuam independentes. Um cancelamento sem repetir os nomes herda apenas o último alcance do mesmo produto, marcado como encerrado. Falhas, desaparecimento de feeds e versões atrasadas não encerram um aviso.

O desenho usa as referências costeiras já publicadas no site. O raio explicitamente informado no boletim recorta essas linhas; não se acrescentam círculos sísmicos ou preenchimentos em terra. Polígonos publicados são identificados como referências do boletim. Nomes não reconhecidos e falhas cartográficas permanecem explícitos. As linhas não são previsão de inundação, altura ou alcance em terra.

Alturas são apresentadas por região quando a categoria publicada traz um intervalo numérico. Não são calculadas a partir da magnitude. Chegadas sem campo estruturado validado ficam como não informadas; não se usa velocidade constante ou ETA inferida. A imagem informa a situação na emissão do boletim e remete à fonte oficial.

O original Full HD mantém o mesmo link nas revisões. A reserva persistente acontece antes do envio: timeout incerto da foto inicial bloqueia reenvio automático, para evitar duplicação; recusas explícitas permitem nova tentativa. Edições podem ser repetidas com segurança no mesmo ID. Uma reserva incerta requer conferência operacional, não envio automático de outra foto.

Validação: testes offline com Telegram e fontes simulados verificam revisões/cancelamentos, autoridade independente, indisponibilidade, reinício, timeout, não duplicação, limite de 300 km e data limite internacional. PNG de 1080 × 1920 renderizado e inspecionado localmente; nenhuma mensagem real de teste é enviada.
