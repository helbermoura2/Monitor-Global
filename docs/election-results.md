# Apuração presidencial temporária · desktop

O chip **Eleição** fica imediatamente depois de **BR**, sem alterar filtros.
Abre um placar não modal entre a lista de eventos e o cartão principal, logo
abaixo do cabeçalho. Exibe os dois primeiros colocados no primeiro turno e os
dois candidatos no segundo: nome de urna, partido, número, votos e percentual
oficial sobre votos válidos. O avanço é o percentual de seções totalizadas,
com o horário de apuração do TSE em Brasília, separado da hora da consulta.
Não infere vencedores nem participantes futuros pela posição no primeiro turno.

O painel fica aberto durante atualizações, cliques no mapa e rotação do cartão.
Fecha pelo ×, pelo chip ou por Escape. `queueNewCameraQuakes` notifica
`ElectionPanel.newQuakes` antes de focar uma chegada nova: somente magnitudes
**maiores que 6,0** fecham o painel. A fila já exclui catálogos iniciais e
chegadas antigas; os feeds suplementares também usam a fila. Repetir o mesmo
ID não fecha de novo um painel reaberto manualmente. Seleções e revisões não
disparam esse fechamento. O painel não reabre automaticamente.

## Fonte oficial

Consulta direta, sem chave privada ou proxy, confirmada com CORS na origem
`https://monitorglobal.top` em 05/10/2026. Esses arquivos pertencem ao aplicativo
oficial, não a uma API contratual com garantia de estabilidade:

- Configuração: `https://resultados.tse.jus.br/oficial/comum/config/ele-c.jws`
- Primeiro turno atual: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.jws`
- Segundo turno vinculado pela configuração: eleição `6258`, mesma regra de URL.

`js/tse-results.mjs` verifica o JWS EdDSA/Ed25519 com a chave pública de
produção do aplicativo TSE antes de usar o JSON. Confirma ciclo `ele2026`,
abrangência nacional `br`, cargo `1`, eleição e turno. Descobre os códigos na
configuração assinada, incluindo `cdt2`; não fixa resultados de 2022 nem
transfere candidatos ou votos de um turno ao outro. `vap`, `pvap` e `s.pst`
são valores oficiais. `dt/ht` é apuração; `dg/hg` é geração. Recusa respostas
anteriores ao último horário aceito, assinaturas desconhecidas, dados de outra
abrangência e contagens inválidas. `idg` não é tratado como contador crescente.

Consulta enquanto aberto e visível a cada 30 s, com uma requisição por vez,
timeout de 12 s e `nocache` como no aplicativo oficial. Ao fechar, entrar no
mobile ou ocultar a aba, cancela a requisição e o agendamento. Voltar à aba
consulta novamente se o painel continuar aberto. Uma falha preserva o último
resultado verificado na memória e informa a indisponibilidade; não troca votos
por zero. Segundo turno ainda sem arquivo oficial mostra **Aguardando dados
oficiais**. O service worker deixa o TSE passar direto, sem cachear URLs
transitórias. A consulta não promete novos números do TSE a cada 30 s.

## Encerramento e manutenção

Somente em largura a partir de 1101 px, incluindo desktop DeX. Não consulta
dados eleitorais no mobile. O turno padrão muda para o segundo em 25/10/2026,
com ambos disponíveis nos botões. O módulo desaparece 24 h após a geração
oficial de um segundo turno com totalização encerrada (`tf=s`); há um limite
adicional em 01/11/2026, 00:00 BRT, para não permanecer indefinidamente caso
a fonte não responda. Datas centralizadas em `ELECTION_2026`.

Uma rotação da chave pública do TSE requer atualizar a chave e validar novos
fixtures; nunca remover a verificação de assinatura. Para retirar o módulo,
remover o link/script eleitoral do `index.html` e a chamada opcional na fila.
Não há alteração nem migração no Worker.

Validação: `node tests/unit/tse-results-check.mjs` e
`npx playwright test tests/election-results.spec.js`. Os fixtures são arquivos
assinados coletados em 05/10/2026 para testes, não resultados publicados na UI.
Os cenários de atualização e segundo turno usam uma chave efêmera apenas nas
rotas interceptadas dos testes. A validação de produção consulta o TSE real.
