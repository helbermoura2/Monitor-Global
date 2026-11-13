# Pedidos ao Monitor Global
Comece com “Alexa, peça ao Monitor Global para…”.
- mostrar a temperatura / mostrar o tempo / mostrar a previsão do tempo
- mostrar o Brent / mostrar a cotação do Brent / mostrar o preço do petróleo
- quanto está o Brent / como está o Brent / qual o valor do Brent / cotação do Brent agora
- quanto custa o barril de petróleo / qual o preço do barril de petróleo / preço do Brent hoje
- mostre o Brent e o dólar / mostrar o Brent e o dólar / me diga a cotação do Brent
- abrir a cotação do Brent / quero saber o preço do Brent / mostre o preço do Brent na TV
- mostrar o último sismo / mostrar o último terremoto / mostrar o último tremor
- mostrar o último sismo no Brasil / mostrar os terremotos no Brasil
- mostrar o último resumo / repetir o último resumo / mostrar o resumo de ontem
- mostrar os maiores do dia / mostrar os maiores sismos de hoje / mostrar o resumo de hoje

Último resumo abre o último resumo diário concluído, não o parcial de hoje.
Maiores do dia abre o resumo parcial do dia atual. O último sismo usa o mesmo histórico do botão de replay da TV.

## Ativação
As novas frases e comandos exigem atualizar as três partes:
1. Ponte no Worker com os seis comandos permitidos.
2. Aplicativo TV 1.0.72 ou posterior.
3. Amazon Developer Console: importar o JSON completo em Build → Interaction Model → JSON Editor → Save Model → Build Model. Atualizar também index.js e commands.js na aba Code e clicar Deploy. Manter package.json e o armazenamento de vínculo existente.

Alterar o repositório não publica a skill na Amazon. O vínculo existente pode ser mantido; não apague a tabela de dados.
Google será uma integração posterior; este pacote é da Alexa.
