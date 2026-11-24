# Argos Orbis TV 1.0.147 — último aviso real, CAP ou celular

## Diagnóstico relatado
Após atualização para 1.0.146, o usuário tentou mostrar o último aviso novamente
e não viu nenhuma tarja. O aplicativo anterior mantinha quatro replays separados:
CAP Severe, CAP Extreme, Cell Broadcast do celular Severe e Extreme. Um replay
CAP não podia recuperar um aviso do celular, e vice-versa. Além disso, o replay
é agendado para 10 segundos após o clique, e fica indisponível se a TV já
apresenta outra tarja ou a permissão de sobreposição está desligada.

## Correção
- Na seção **DEFESA CIVIL · ÚLTIMO ALERTA REAL RECEBIDO**, o botão
  **Ver e reproduzir o ÚLTIMO ALERTA (celular ou CAP)** procura os quatro
  registros locais existentes, com retenção máxima de sete dias.
- O diálogo mostra gravidade, origem, data e mensagem. Só depois de confirmar
  inicia um replay histórico de 20 segundos sem som, dez segundos após o clique.
- Se não houver nenhum registro, o diálogo explica **imediatamente** que
  não há aviso salvo nesta TV, em vez de parecer que o botão não funciona.
- CAP e celular seguem em armazenamentos distintos. O replay preserva
  **NÃO VERIFICADO VIA CAP** para alertas capturados pelo telefone.
- A primeira identificação do telefone passa a ser conservada no registro
  local para futuros replays. Registros antigos sem nome exibem
  `Celular sem identificação`, nunca inventam o aparelho emissor.
- Os quatro botões antigos permanecem disponíveis para quem deseja
  pesquisar separadamente por origem e severidade.

## Segurança e limites
- Não recupera do Worker um aviso já expirado; não importa retroativamente
  boletins nacionais que só foram apresentados no site/celular.
- CAP nacional permanece informativo e separado dos alertas CAP da capital
  verificados pela TV. O replay só aceita registros anteriormente recebidos
  e gravados na TV.
- Nunca armazena simulações como alertas reais. Não ativa som de emergência,
  nem descreve o histórico como alerta atual.
- Não altera a deduplicação do Worker, a ordem de envio do Samsung/Nothing,
  os boletins geolocalizados, o monitoramento, nem a assinatura dos aplicativos.

## Validação e reversão
Testes `CivilLatestReplayTest` verificam seleção entre quatro históricos,
casos de registro ausente, simulações e preservação do nome do primeiro
celular. Manter os testes preexistentes do replay CAP e Cell Broadcast.
Reverter apenas a nova ação, UI, seletor e persistência do nome do aparelho
se necessário; não apagar os dados de histórico em SharedPreferences.
