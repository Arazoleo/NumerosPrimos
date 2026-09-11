# Como contribuir com o Primeverse

Este documento define o fluxo de trabalho para a equipe. O objetivo é permitir que várias pessoas contribuam ao mesmo tempo sem perder contexto, duplicar tarefas ou aumentar os conflitos de merge.

## 1. Antes de começar

1. Leia a Issue inteira e confirme os critérios de aceite.
2. Atribua a Issue a você.
3. Mova o item para **Em andamento** no board.
4. Comente quais arquivos ou sistemas pretende alterar quando a tarefa envolver áreas muito compartilhadas.
5. Crie sua branch a partir da `develop` atualizada.

Uma pessoa deve manter no máximo uma tarefa principal em andamento. Se a tarefa levar mais de dois dias úteis ou misturar objetivos diferentes, divida-a em sub-issues.

## 2. Preparando o projeto

```bash
git clone https://github.com/Arazoleo/NumerosPrimos.git
cd NumerosPrimos
git switch develop
cd react-app
npm ci
cp .env.example .env.local
npm run dev
```

Nunca copie credenciais reais para a Issue ou para o PR. Variáveis privadas ficam somente em `.env.local` e no gerenciador de secrets do ambiente de deploy.

## 3. Branches

Use nomes curtos e relacione a Issue quando possível:

```text
feat/123-carrossel-herois
fix/245-respawn-nucleo
content/301-novo-nivel-cripta
docs/88-fluxo-multiplayer
chore/102-atualizar-dependencias
```

O fluxo normal é:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feat/123-carrossel-herois
```

Abra features, correções comuns, conteúdo e refatorações contra `develop`. A `main` recebe somente PRs de release vindos de `develop` e correções emergenciais `hotfix/*`.

Não desenvolva nem faça push diretamente em `develop` ou `main`.
Código incompleto permanece na feature branch ou atrás de uma feature flag desligada; `develop` deve continuar jogável e publicável a qualquer momento.

## 4. Commits

Prefira commits pequenos, com uma intenção clara:

```text
feat(primebound): adiciona seletor de classes
fix(online): preserva sala durante reconexão
test(nucleus): cobre respawn autoritativo
docs(board): registra fluxo de triagem
```

Evite misturar formatação global, refatoração e funcionalidade nova no mesmo commit.

## 5. Áreas com maior risco de conflito

Avise na Issue antes de alterar simultaneamente estes pontos:

- `react-app/src/App.jsx` e `react-app/src/main.jsx`;
- `react-app/package.json` e `react-app/package-lock.json`;
- arquivos grandes de engine, como `PrimeboundGame.tsx`;
- contratos compartilhados entre frontend e servidor;
- estilos globais e registros centrais de rotas, jogos ou progressão.

Quando duas tarefas precisarem do mesmo arquivo, combine primeiro a divisão por módulo ou a ordem dos merges.

## 6. Pull Requests

Todo PR deve:

- referenciar a Issue com `Refs #123` quando o destino for `develop`;
- usar `Closes #123` no PR de release ou hotfix destinado à `main`;
- explicar o resultado para o jogador ou para a equipe;
- incluir passos reproduzíveis de teste;
- anexar imagem ou vídeo quando alterar interface, animação ou gameplay;
- declarar riscos, migrações e variáveis de ambiente novas;
- manter um único objetivo principal.

Abra o PR como **Draft** cedo quando precisar alinhar arquitetura. Ao ficar pronto, mova o card para **Em revisão** e solicite revisão.

### Revisão mínima

- Uma aprovação para mudanças comuns destinadas a `develop`.
- Duas aprovações para releases em `main` e para protocolo multiplayer, autenticação, segurança, persistência ou mudanças estruturais amplas.
- Quem escreveu o código não aprova o próprio PR.
- Use **Squash and merge** em feature branches destinadas a `develop`.
- Use **Create a merge commit** no PR `develop → main` para preservar a ancestralidade entre as duas branches.

Closing keywords em descrições de PR só funcionam quando o destino é a branch padrão. Por isso, vincule manualmente a Issue ao PR de feature e liste as Issues entregues no PR de release.

### Release e hotfix

1. Valide o estado acumulado de `develop` no domínio de Preview.
2. Abra um PR de `develop` para `main` e liste cada Issue com `Closes #123`.
3. Depois das aprovações e checks, faça merge commit e valide Produção.
4. Para urgências, crie `hotfix/*` a partir de `main`, abra PR para `main` e depois sincronize `main` de volta em `develop` por PR.

## 7. Verificações obrigatórias

Execute dentro de `react-app/`:

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run build
```

Para mudanças visuais, teste também:

- desktop e celular;
- teclado e toque quando aplicável;
- carregamento direto da rota;
- redução de movimento quando houver animações intensas;
- conexão e desconexão quando a feature for multiplayer.

## 8. Definição de pronto

Uma Issue só vai para **Concluído** quando:

- os critérios de aceite foram cumpridos;
- os testes relevantes foram criados ou atualizados;
- lint, tipos, testes e build passaram;
- não há logs de debug ou segredos no diff;
- a documentação foi atualizada quando necessário;
- o PR de implementação foi revisado e integrado à `develop`;
- o comportamento foi conferido no Preview de `develop`;
- a release com a mudança foi integrada à `main` e validada em Produção.

## 9. Bugs urgentes

Use prioridade **P0** apenas para produção indisponível, perda de dados, vazamento de segredo ou falha crítica de segurança. Interrompa o trabalho atual, avise os mantenedores e abra um PR mínimo de correção. Melhorias e bugs comuns seguem a triagem normal.

## 10. Comunicação

- Decisões técnicas permanentes ficam na Issue ou no PR, não apenas em mensagens privadas.
- Bloqueios devem ser registrados no card com o motivo e a pessoa necessária para destravar.
- Discussões grandes terminam com um comentário-resumo e uma decisão explícita.
- Dúvidas de escopo devem ser resolvidas antes de aumentar a implementação.
