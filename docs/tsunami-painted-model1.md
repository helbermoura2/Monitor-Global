# Modelo 1: costas pintadas

A pintura acompanha a costa com preenchimento, núcleo mais visível e reforço
cartográfico legível quando o globo está afastado. Os níveis vêm do boletim:
mais de 3 m em vermelho; 1–3 m em laranja; 0,3–1 m em amarelo; menos de 0,3 m
em verde-água. Avisos, atenção e vigilância sem amplitude usam sua categoria
oficial, sem calcular níveis a partir da magnitude ou da distância.
Informativos ficam discretos em azul e encerramentos em cinza.

Polígonos da autoridade continuam preservados. Quando a fonte publica nomes
de regiões, as faixas são referências costeiras do Natural Earth; a legenda
explica a diferença. Regiões desconhecidas não são substituídas por países
vizinhos nem pela origem do sismo. A faixa não prevê o alcance da água em terra.

A moldura e o aviso no topo identificam a apresentação. O passeio enquadra
primeiro a origem e a visão geral, depois percorre as regiões. O enquadramento
é calculado a partir da geografia, independentemente da orientação atual do
globo, e considera a linha de data. Nos boletins sem sismo correlacionado, o
passeio começa depois da chegada e da pausa de seis segundos; a permanência
pode aumentar até três minutos para visitar as costas. A prioridade M6+ é
preservada. Arrastar o mapa interrompe o passeio sem travar o gesto nativo.

Menu → Efeitos → Tsunami · modelo 1 · costas pintadas → Modelo 1 · Rússia /
Pacífico. O teste dura 120 segundos: origem fictícia em Kamchatka, visão geral,
cinco regiões com níveis demonstrativos e visão geral final. É possível pausar
ou reiniciar. Não cria registros, avisos, sons ou publicações externas. Parar
restaura a câmera e retira faixas, moldura, aviso e marcador demonstrativo.
O cartão demonstrativo mantém conteúdo visível e rolável no celular. No celular a legenda fica em “Ver legenda” para preservar espaço no mapa.

Validação: geometria e cores, preservação de polígonos oficiais, Aleutas dos
dois lados da linha de data, extensão limitada da permanência, teste completo
no celular/desktop, cancelamento e restauração, câmera independente da
orientação e prévia visual com satélite.

## Boletins reais: texto e posição (20261020)

A classificação compartilhada `TsunamiMapModel.status` é usada pelo painel e
pelo cartão complementar na lista. “Sem ameaça”, informativo, aviso e encerrado
são estados distintos. Uma declaração de ausência de ameaça em boletim
informativo não pinta costas, não oferece navegação de regiões e não gera
moldura de alerta. A mensagem se limita às áreas avaliadas pela autoridade.
Não se deduz ameaça a partir da magnitude do sismo.

Nas apresentações reais, o aviso complementar aparece imediatamente abaixo do
registro do boletim, no mesmo espaço dos cartões de chegada, por 60 segundos.
Cada boletim tem sua própria permanência. Reabrir ou selecionar não renova o
prazo. No desktop em Tudo, o registro de tsunami também permanece 60 segundos.
Os antigos pop-ups centrais/sobre o mapa não são apresentados para eventos reais.
No celular, o aviso fica junto ao respectivo registro na lista de eventos.

Avisos oficiais com regiões reconhecidas ou polígonos publicados continuam
pintando essas costas e usando o passeio existente; sua moldura permanece.
Sem contornos identificáveis, a interface explica a limitação, sem inventar uma
área. As demonstrações mantêm legenda e controles de teste. Nenhum efeito
JULES ou onda de tela inteira foi ativado. Não há mudança no Worker/Durable.
