# Primeverse · Desenvolvimento

Board oficial da equipe responsável pelo Números Primos / Primeverse.

## Como usamos este board

1. Toda mudança começa em uma Issue com critérios de aceite.
2. **Caixa de entrada** contém trabalho ainda não triado.
3. **Pronto** contém tarefas pequenas, claras e priorizadas.
4. Ao assumir uma tarefa, atribua-se e mova para **Em andamento**.
5. Abra um Draft PR para `develop` cedo e mova para **Em revisão** quando estiver pronto.
6. Depois do merge em `develop`, valide no Preview e mova para **Pronto para produção**.
7. A Issue vira **Concluída** quando a release entra em `main` e Produção é validada.

## Regras rápidas

- Uma tarefa principal em andamento por pessoa.
- No máximo quatro PRs simultâneos em revisão.
- Itens `XL` precisam virar sub-issues menores.
- Use **Now** para a sprint atual, **Next** para o próximo ciclo e **Later** para ideias sem compromisso imediato.
- Decisões e bloqueios ficam registrados na Issue.
- PR para `develop` usa `Refs #número`; o PR de release para `main` usa `Closes #número`.
- Todo PR passa por lint, tipos, testes e build.
- Nunca publique tokens, chaves de API ou conteúdo de `.env`.

## Prioridade

- **P0:** produção fora do ar, perda de dados ou segurança.
- **P1:** bloqueia uma entrega ou funcionalidade central.
- **P2:** trabalho normal planejado para a sprint.
- **P3:** melhoria futura sem urgência.

Documentação completa: [`docs/BOARD.md`](https://github.com/Arazoleo/NumerosPrimos/blob/main/docs/BOARD.md) · [`docs/ENVIRONMENTS.md`](https://github.com/Arazoleo/NumerosPrimos/blob/main/docs/ENVIRONMENTS.md) · [`docs/BACKLOG.md`](https://github.com/Arazoleo/NumerosPrimos/blob/main/docs/BACKLOG.md) · [`CONTRIBUTING.md`](https://github.com/Arazoleo/NumerosPrimos/blob/main/CONTRIBUTING.md)
