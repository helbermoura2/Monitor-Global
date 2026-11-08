Monitor Global Celular · teste 0.1.7.

- Resumo online com IA no card horário e nos cards de chuva quando há previsão ativa para a Liberdade.
- O texto usa exclusivamente fatos verificados da previsão; números e horários são preservados.
- Resumos são compartilhados entre celular e TV, com cache e limites de consultas.
- A previsão normal continua aparecendo enquanto a IA está pendente ou indisponível.
- Não adiciona notificações de chuva em segundo plano ao celular: a integração aparece em Tempo e na tela de chuva. As notificações existentes continuam funcionando.
- Instale sobre a versão 0.1.6 ou 0.1.5, sem desinstalar.
# Modelo online

O resumo meteorológico usa o modelo Cloudflare `@cf/meta/llama-3.1-8b-instruct-fp8`, com seleção de fatos em JSON validado e validação dos dados do fornecedor.


**Observação sobre a validação da IA:** a prévia 0.1.8 aceita respostas do Gemini 3.8 Flash (principal) e do Cloudflare Workers AI (reserva). O teste online distingue ausência legítima de destaque meteorológico de uma falha de geração. A chave privada fica apenas no Worker; nenhum segredo é enviado ao celular.
