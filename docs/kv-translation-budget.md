# Redução de operações de KV nas traduções

O e-mail de 50% da cota não informa qual operação ou Worker atingiu o patamar. Não temos métricas da conta nesta sessão; esta correção remove um consumo concreto encontrado no código, sem atribuir o aviso a uma causa não confirmada.

O objeto existente `portuguese-translations-v1` já serializava os pedidos e guardava a cota diária de 50 mil caracteres em seu storage. Agora guarda também as traduções bem-sucedidas por 30 dias, sem novas gravações de tradução no KV. A consulta ao KV só importa traduções antigas, que continuam acessíveis após reinício do objeto. Falha de leitura do KV não impede a tradução pelo objeto; a cota e a rejeição de números alterados permanecem ativas.

Consultas antigas sem resultado ficam memorizadas por cinco minutos, em até 256 entradas por instância, evitando repetir a mesma leitura. Expiração é verificada a cada consulta. A limpeza percorre até 32 registros por execução, no máximo uma vez por hora e somente ao gravar uma tradução, com cursor persistente. Ela opera no storage do objeto e não faz listagens ou exclusões no KV. O objeto é o já configurado: não há nova infraestrutura, mudança de plano ou credenciais.

O caminho de reserva sem Durable Object continua usando KV. Não foram alterados armazenamento de voz, população, pesquisas eleitorais, histórico do Telegram ou proteção contra alertas duplicados. Durable Objects têm suas próprias cotas; eliminar operações de uma função não garante que toda a conta ficará abaixo do limite de KV.

Os testes verificam zero gravações no KV, importação legada, reinício, validade de 30 dias, limpeza limitada, redução de consultas ausentes, concorrência na rota real, KV esgotado e manutenção da cota diária. Nenhuma mensagem ao Telegram é enviada para essa validação.
