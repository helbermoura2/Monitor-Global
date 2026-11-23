# Argos Orbis — Identificação do celular de origem (TV 1.0.144 / Celular 0.1.59)

## Objetivo
Depois de dois telefones capturarem o mesmo alerta da Defesa Civil, informar
**qual telefone chegou primeiro ao Worker** e se o outro também enviou o
mesmo texto, sem duplicar a tarja de emergência.

## Implementação
- Celular envia apenas `deviceLabel` voluntário, com valores válidos:
  `Galaxy S25 Ultra`, `Nothing Phone 1` ou `Celular Android`.
  Usa `Build.MANUFACTURER`/`Build.MODEL` somente para escolher esse nome;
  pode ser corrigido em **Identificar este celular** nas informações técnicas.
  Não coleta IMEI, serial, número ou geolocalização.
- Worker autentica os dois telefones com as credenciais **já vinculadas**.
  Ao receber um alerta ainda não visto, grava `firstDevice` e
  `firstReceivedAt` (horário do servidor).
  Se o segundo telefone entregar **mesmo texto e severidade**, o Worker
  registra `secondDevice` e `secondReceivedAt`, preservando ID e
  primeira hora. O segundo envio permanece identificado como
  `duplicate=true` e **não cria segundo alerta**.
- Repetições do mesmo telefone são descartadas sem mudar a ordem.
  A detecção local (observedAt) também é conservada separadamente.
  A ordem de entrega é baseada na chegada ao Worker, não em suposta
  precisão de relógios dos celulares.
- TV 1.0.144 lê esses campos no polling autenticado, usa o primeiro
  nome no rodapé da tarja e registra ambos no menu
  **DEFESA CIVIL → Diagnóstico · celular → Worker → TV**.
  Se a segunda entrega ocorrer depois da apresentação, o diagnóstico
  se atualiza no próximo polling, sem reapresentar aviso expirado.
- Replay de até sete dias e a classificação NÃO VERIFICADO VIA CAP
  permanecem separados de registros oficiais CAP.

## Compatibilidade
A ponte continua compatível com telefones 0.1.58 e TV 1.0.143:
aparelhos não identificados exibem `Celular sem identificação`.
Para visualizar ambos corretamente, atualizar **os dois celulares**
para 0.1.59 e a **TV** para 1.0.144 depois que forem publicados.
O vínculo e o estado de envio automático são preservados na atualização.

## Segurança e confiabilidade
- Envio automático exige o diagnóstico experimental e a permissão Android.
- Rastreio só disponível no Worker autenticado e na TV pareada.
- Nenhuma cópia pública dos tokens ou IDs internos das credenciais.
- As duplicações são guardadas dentro da janela original de cinco
  minutos do aviso; o Worker não vira arquivo permanente.
- Se os dois celulares estiverem com tela bloqueada, a captura ainda
  depende das permissões/gestão de energia do Android.
- O sucesso do Worker **não comprova** que a TV exibiu a tarja;
  o diagnóstico diferencia consulta, recebimento e exibição.
- Os nomes são fornecidos por aparelhos pareados e não devem ser usados
  como autenticação de identidade de hardware.

## Testes
- `tests/unit/civil-phone-relay.test.mjs` valida 2 aparelhos, ordem real,
  horário, mesmo ID, no máximo uma tarja, repetição do primeiro e sem
  vazamento dos hashes de token.
- `android-tv/app/src/nativeMapTest/java/.../CivilPhoneAttributionTest.java`
  verifica nomes admitidos, ordem e advertência NÃO CAP.
- Fluxos CI do Worker/TV/celular incluem testes, assinatura e publicação
  apenas se as etapas de validação passarem.

## Reversão
Reverter apenas `deviceLabel`, informações first/second do Worker,
renderização do nome na tarja e os campos de diagnóstico na TV.
Manter todo o transporte existente de alertas, o replay do celular
e o histórico CAP. A versão seguinte precisa incrementar
`versionCode`, sem desinstalar as versões instaladas.

**Não reativar nem simular alertas reais.** Os testes manuais têm a
etiqueta fictícia e não servem de confirmação de recepção Cell Broadcast.
