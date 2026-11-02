# TV 1.0.43 — encaixe nas bordas

Radar mantém 72 unidades e varredura original, movido para o centro x922: termina a duas unidades da borda direita. Site e Telegram passam a compartilhar alinhamento à direita em x954, com seis unidades de margem.

Caixa principal, recorte de fundo e contorno da animação de entrada usam retângulos, sem curvas. O bloco da magnitude/tsunami ocupa x0..112 e y24..100, sem margem ou cantos arredondados. Seu fundo opaco é desenhado uma vez, fora dos fades de texto, para não reaparecer o azul durante trocas de página.

Preserva cores, fontes, mapas, tempo de exposição, horário de Brasília sem legenda e movimento reduzido. Prévia atualizada em docs/previews/tv-tarja.html?v=1043. Os testes gráficos verificam os encaixes, alinhamento de site/Telegram e a transição entre páginas. Não equivale a teste em TV física. APK assinado permanece no lançamento oficial.
