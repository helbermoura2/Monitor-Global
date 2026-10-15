# Globo — teste

A versão plana anterior está preservada no Git em `backup/mapa-plano-20261015` (commit `4038b00`). A referência foi enviada ao repositório remoto antes das alterações.

O menu do desktop e do celular abre **Globo — teste**, com escolhas explícitas de globo ou mapa plano. Não há preferência persistida: recarregar sempre inicia o mapa plano. No globo, o controle **Voltar ao mapa plano** permanece disponível. **Ver planeta** abre o zoom como uma ação manual; não impede a entrada prioritária de eventos novos.

A troca usa `map.setProjection` do MapLibre 5.13 na mesma instância. Não recria fontes, polígonos, marcadores, eventos ou cartões. A atmosfera de teste é removida ao voltar, restaurando a configuração anterior. A câmera não muda apenas por trocar a projeção; o usuário pode abrir o zoom com o controle separado. O cache do enquadramento sísmico inclui a projeção.

Os marcadores HTML continuam posicionados pelo MapLibre. Nesta versão, o motor marca marcadores cobertos pela esfera com opacidade 0,2; o CSS do teste os oculta para não mostrar pins através da Terra. A etiqueta de consulta também usa a opção nativa de oclusão. Não há construções ou relevo 3D acrescentados.

Testes: alternância pelos menus, retorno ao padrão ao recarregar, mesma instância/fontes/dados, projeção dos pins inclusive em latitude alta, ocultação do hemisfério oposto, arrasto nativo de mouse/toque, grade oficial histórica do USGS e polígonos de tsunami. As capturas locais podem usar o tile global da Esri em resolução baixa apenas como fundo de teste; a produção mantém suas fontes de satélite existentes.
