# Versões, releases e recuperação

## Convenção vigente

O site e o backend usam marcos `monitor-vAAAA.MM.DD`, por exemplo `monitor-v2026.10.24`. Se houver mais de um marco no mesmo dia, acrescentar `.1`, `.2` etc. A data identifica a publicação; não é previsão de estabilidade nem versão de todos os componentes.

Cada marco é uma tag anotada e uma release no GitHub, apontando para um commit revisado de `main`. Publicar após os testes pertinentes e conferir as implantações dos componentes alterados. Registrar mudanças, validação, limitações e pendências. Atualizações automáticas de dados não exigem nova release.

As tags publicadas não devem ser movidas, apagadas ou reutilizadas para outro código. Corrigir uma versão criando novo commit e novo marco. Não criar retrospectivamente versões fictícias ou declarar antigas versões estáveis sem evidência.

O aplicativo Android TV mantém sua própria versão, `versionCode`, assinatura e distribuição oficial. Uma release `monitor-v…` não distribui APK nem atualiza o aplicativo instalado. O nome histórico `monitor-global-worker-7_7_0.js` e a versão interna do frontend não são a identificação do marco global; não renomear arquivos apenas para igualar números.

## Consultar uma versão

1. Abrir [Releases](https://github.com/helbermoura2/Monitor-Global/releases).
2. Ler mudanças, testes e pendências da versão.
3. Clicar na tag para ver o código exato. Os arquivos ZIP/TAR gerados pelo GitHub são cópias do código-fonte, não instaladores.
4. Comparar dois marcos no GitHub antes de decidir por uma recuperação.

## Recuperar com segurança

Usar o [Guia do dono](../GUIA_DO_DONO.md) para reverter a alteração responsável por uma falha. Não forçar `main` para uma tag antiga: isso pode apagar correções e atualizações de dados legítimas. Criar uma alteração de reversão revisável e testar o comportamento afetado.

Uma tag sozinha **não restaura produção**: site estático e Worker têm implantações separadas; conferir ambos. A reversão de código não restaura dados de KV/Durable, não desfaz mensagens enviadas e não recupera Secrets. Verificar compatibilidade de armazenamento e bindings antes de reimplantar backend. Para o Worker, seguir [manutenção](cloudflare-worker-maintenance.md); preservar configurações, migrações e credenciais da conta.

## Primeiro marco

`monitor-v2026.10.24`: correções de retenção de relatórios sísmicos, cache de áreas meteorológicas, fusão de catálogos, recuperação de raster, AFAD e fontes; documentação operacional e proteção administrativa. As notas da release registram os testes e as pendências: confirmação prolongada nos aparelhos, custos reais e Secrets do alarme. Não anunciar memória definitivamente resolvida em todo dispositivo com base no ensaio local.
