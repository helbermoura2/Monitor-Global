# Argos Orbis TV 1.0.141 — Padrão editorial com divisórias vermelhas

A tarja da Defesa Civil foi usada como referência para um único estilo nativo
de separação entre blocos. O mesmo acabamento é agora desenhado nos três
renderizadores oficiais, em todas as categorias, inclusive replay:

- `NewsBannerView`: sismos M6+ globais, regionais, tsunamis, replays e resumo diário.
- `BrazilNationalBannerView`: sismos do Brasil e replays.
- `TvBroadcastInfoView`: clima, chuva, satélite, Brent, Dólar, consulta por voz e Defesa Civil.

## Geometria compartilhada

A classe `BroadcastVisuals` é a autoridade das divisórias verticais
sobre a faixa preta OLED (coordenadas virtuais de largura 960):
- Fonte/categoria comum: x=119.
- Defesa Civil, cuja categoria é mais larga: x=178.
- Conteúdo/logotipo oficial: x=827.
- Mercado: uma divisória adicional em x=485 entre Brent e USD/BRL.

Todas têm y=39..87, vermelho imperial `#bb243d`, 1,6 unidade de
espessura e bordas discretamente arredondadas.

As divisórias ficam fixas enquanto o conteúdo muda entre páginas e são
desenhadas depois dos dados (não entram na animação ou no rodapé).
Os blocos de texto do Brasil reservam espaço antes da regra vermelha.

## Preservado
- Tarja OLED, logo oficial animado, abas AO VIVO / REPLAY / SIMULAÇÃO.
- Alinhamento do mapa x615..925 aprovado na versão 1.0.140.
- Mesma largura e altura das tarjas.
- Horário, ticker e seus efeitos.
- Captura e retransmissão da Defesa Civil via celular e Worker.
- Timers, prioridades de alertas, sons e rede, sem mudanças.

## Verificação
`NewsroomDividersTest` desenha as 11 categorias em Canvas nativo, verifica
divisórias junto à fonte e ao logo e regra extra do mercado. Também
verifica que nenhuma regra invade abas superiores ou rodapé.
O APK só deve ser instalado quando compilado, testado, assinado e publicado.

## Reversão
Reverter apenas as chamadas de `newsroomDividers` nos três renderizadores,
as constantes/desenho em `BroadcastVisuals`, a substituição da antiga linha
cinza de mercado e o pequeno recuo no texto da tarja Brasil. Os alertas e
a correção dos mapas da 1.0.140 devem permanecer intactos.
Para publicar uma versão revertida é necessário incrementar `versionCode`.
