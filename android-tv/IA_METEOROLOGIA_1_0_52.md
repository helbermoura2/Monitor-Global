TV 1.0.53 — boletins online com IA

A IA participa do boletim meteorológico horário e dos avisos de chuva já existentes. A cadência, o atraso manual de dez segundos, a prioridade dos sismos e o resumo diário à meia-noite permanecem sob as regras existentes. A geração online ocorre em I/O separado: o card normal não espera pela IA. Um resumo que chega durante a apresentação é adicionado sem reiniciar o card ou sua confirmação de entrega.

O servidor compartilha as seleções de fatos entre aparelhos, usando Cloudflare Workers AI com Llama 3.1 8B FP8. O modelo escolhe a ênfase entre fatos verificados; texto livre ou números inventados do modelo são rejeitados. O texto final é montado com os dados confirmados do fornecedor. A seleção fica em cache por hora, ou por meia hora/fase da chuva. Limites persistentes: 64 gerações/dia UTC e 1.500/mês, entrada limitada e saída de 96 tokens. A franquia da conta também é compartilhada com outras aplicações e traduções; esses controles não constituem garantia de fatura zero.

Falta de fonte, resposta inválida, limite, expiração ou falha do modelo preservam o boletim normal. Demonstrações fictícias não exibem resumos reais.

Modelo confirmado no catálogo oficial: https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/ . A chamada usa JSON Schema para selecionar IDs de fatos, seguida de validação local; a chave do cache inclui o modelo. Erros públicos expõem apenas categoria fixa e código numérico do fornecedor.
