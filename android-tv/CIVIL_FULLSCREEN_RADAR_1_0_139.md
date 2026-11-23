# Argos Orbis TV 1.0.139 — Radar de emergência em tela inteira

## Visão geral
A apresentação aprovada da Defesa Civil (refino 1.0.138) é complementada por
uma **atmosfera nativa transparente de tela inteira**, usando o mesmo padrão
técnico da chuva: janela `TYPE_APPLICATION_OVERLAY` atrás da tarja oficial.

- Severo: linhas de borda em **âmbar/bronze**, arco de radar nos cantos e
  varredura única muito discreta da esquerda para a direita.
- Extremo: mesma geometria em **vermelho profundo**, sem piscar nem repetir flashes.
- Simulação: intensidade reduzida e indicação **SIMULAÇÃO / TESTE FICTÍCIO**
  mantida exclusivamente na tarja principal. Não se confunde com aviso real.
- Modo Completo: 4,3 s de animação; Modo Suave: 2,2 s com somente bordas;
  Sem efeitos/Animações do Android desativadas: não cria a janela.
- A janela usa `FLAG_NOT_TOUCHABLE`, `FLAG_NOT_FOCUSABLE` e transparência,
  sem bloquear o controle remoto ou ler/capturar pixels do vídeo.
- A janela temporária é adicionada **antes** da tarja para não cobrir seus textos
  e removida automaticamente por tempo ou imediatamente ao ocultar a tarja.
- Não modifica duração do aviso, dados CAP, Cell Broadcast, Worker, ligação dos
  dois celulares, timeout da ponte nem os eventos sísmicos e meteorológicos.

## Referências de design
Taste Skill (hierarquia visual), Transitions.dev (entradas suaves),
React Bits (luz/linhas): apenas referências de movimento, sem JavaScript,
WebGL, CDN, pacotes pagos ou dependências externas no APK.

## Testes
Os testes Robolectric de efeitos incluem a nova categoria CIVIL em todos os
modos; o conjunto foi ajustado para contar categorias dinamicamente e utilizar
a geometria sem mapa dos avisos da Defesa Civil. Um teste novo valida o efeito
de tela inteira nos modos Completo, Suave e Sem efeitos.

Na TCL P7K, verificar:
1. Avisos locais SEVERO / EXTREMO simulados: animação é discreta, não cobre a
   mensagem e some antes da tarja.
2. Teste enviado pelo Nothing Phone 1 e Galaxy S25 Ultra: apresentação idem,
   com indicação **CELULAR** e **SIMULAÇÃO**.
3. Desativar efeitos: sem janela adicional.
4. Um alerta Cell Broadcast real, quando ocorrer, será usado para validar a
   captura automática (teste manual não equivale a alerta real).
5. Depois de finalizar, botão de atualização do app TV deve reconhecer versão
   oficial assinada, preservando configurações anteriores.

## Reversão
Reverter apenas:
- `android-tv/app/src/main/java/top/monitorglobal/tv/CivilScreenEffect.java`
- No `Banner.java`: campo, instalação e remoção do efeito.
- No `TvBroadcastInfoView.java`: os três métodos civilIsExtreme, civilIsReplay
  e civilIsSimulation.
- No `TvEffectsDemo.java`: cenário visual CIVIL (se o efeito não estiver presente).

Os ajustes da tarja de 1.0.138 e toda a ponte celular/Worker continuam intactos.
Ao publicar outra versão, incrementar sempre versionCode; não fazer downgrade.

## Estado da publicação
Código-fonte da 1.0.139 só é instalável após passar compilação, testes gráficos,
assinatura e publicação no canal estável da TV. O build 1.0.138 falhou em testes
gráficos (contagem antiga e geometria sem mapa); as duas causas foram corrigidas
na 1.0.139.
