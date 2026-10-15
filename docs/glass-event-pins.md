# Selo de vidro — modelo 12

O marcador selecionado recebe o selo escolhido no estudo visual: superfície
escura com brilho interno, reflexo suave e sublinhado luminoso em ciclo de três
segundos. Uma linha fina liga o selo ao ponto real. Funciona em desktop, celular,
mapa plano e globo, inclusive para sismos fracos e quando há pintura de tremor.

Sismos mostram magnitude com vírgula e cor correspondente. Avisos de vento e
ciclones mostram vento arredondado quando informado; os demais mostram o tipo
em português. Nunca se atribui magnitude a outros eventos. Os pontos secundários
continuam discretos e a consulta de sismos usa o mesmo selo na magnitude.

O antigo rótulo sísmico isolado deixa de ser criado quando o componente está
disponível, evitando duplicidade. Quando uma sequência de possíveis réplicas
já fornece uma etiqueta para o selecionado, essa etiqueta recebe o acabamento
e a animação, mantendo seu texto e sua ação existentes. Réplicas, testes do menu
e a origem verificável do boletim de tsunami compartilham a superfície de vidro.
O botão de agrupamento de réplicas fica abaixo do ponto, separado da área de
toque do pin principal, e continua ampliando o grupo sem selecionar outro sismo.

A animação atua somente no reflexo e no sublinhado; os wrappers e as coordenadas
continuam sob controle do MapLibre. O selo comum não intercepta ponteiro, e a
área de toque do pin permanece intacta. Movimento reduzido deixa tudo estático.
Não se fazem consultas de pintura a cada frame nem chamadas novas a serviços.
Não se cria um epicentro para boletins sem origem verificável.
