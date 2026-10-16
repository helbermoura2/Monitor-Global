# População e voz compartilhadas, com medição do KV

## Mudanças

- População: o mesmo evento e revisão usam um objeto persistente, compartilhado
  entre visitantes e imagens do Telegram. As tarefas WorldPop sobrevivem a reinícios.
  Consultas pendentes sem alteração não regravam o estado. Há expiração automática,
  limite de três tarefas por cálculo e encerramento após três minutos sem conclusão.
- Resultado WorldPop disponível dura até 24 horas; a cada cinco minutos continua
  procurando PAGER, que substitui o modelo quando publicado. Alterações de magnitude,
  profundidade, coordenadas ou identificador têm outro cálculo.
- Voz: um objeto serializa a cota e compartilha MP3s por texto/voz. Mantém até 64
  áudios durante sete dias, com fragmentos de até 60 kB. O limite segue em 300 mil
  caracteres/mês. A primeira síntese do mês importa o contador antigo do KV; erro
  nessa leitura bloqueia a síntese, sem zerar a cota. Reutilizar um áudio não consome
  caracteres novos. Falhas de síntese conservam a reserva e pausam tentativas por
  um minuto. O navegador continua usando sua voz local quando a nuvem falha.
- Nenhum desses caminhos grava no KV. O estado fica nos Durable Objects existentes,
  que têm cotas próprias de requisições e armazenamento. Isso reduz a pressão sobre
  o KV, sem prometer consumo total zero ou gratuidade ilimitada de outros recursos.

## Medição protegida

`GET /kv-usage`, com `Authorization: Bearer <KV_METRICS_READ_TOKEN>`, retorna
contagens diárias de tentativas, sucessos e falhas por família, mais atividade de
população/voz. Sem a credencial responde 401. Não expõe chaves, coordenadas,
textos ou áudios. Mantém 14 dias em Durable Object; não grava contadores no KV.
Os lotes são agregados por execução. Falhas na entrega não interrompem o serviço;
a medição é observada pela aplicação e pode ser incompleta, não substitui a fatura.

O workflow manual de manutenção provisiona, somente no modo `deploy`, um segredo
separado para essa leitura: HMAC-SHA256 do token de manutenção com contexto próprio
que inclui a conta. Não envia o token da API Cloudflare ao Worker nem publica o
segredo derivado. `inspect` e `verify` leem as métricas sem alterar configurações.
Uma troca do token de manutenção exige novo `deploy` para atualizar esse acesso.

As métricas começam na implantação. Os totais históricos do Analytics não permitem
atribuição retrospectiva por função. O consumo diário já realizado não desaparece:
o limite diário do KV reinicia às 00h UTC, ou 21h em São Paulo.

## Validação reproduzível

`node --test tests/unit/shared-kv-optimization.test.mjs` usa o Worker real,
armazenamento simulado e serviços externos simulados. Cobre concorrência, reinício,
promocão a PAGER, falhas, expiração, limite de arquivos e importação da cota:

| Cenário controlado | Antes | Depois |
| --- | --- | --- |
| 13 consultas de população ainda pendente | 13 gravações KV | 0 gravações KV; 1 persistência inicial do estado |
| 20 pedidos concorrentes do mesmo áudio | Até 20 sínteses e 20 atualizações KV | 1 síntese; 0 gravações KV; 1 leitura de migração mensal |
| Reutilização do áudio após reinício | Nova síntese | MP3 persistido reutilizado |

Os números da tabela descrevem esses cenários, não estimam retroativamente o
tráfego real. Testes não sintetizam áudio na AWS nem enviam mensagens ao Telegram.
