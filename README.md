# Primeverse — desenvolvimento local

Este README contém somente as instruções para executar o projeto localmente e o fluxo usado para contribuir.

## Rodar localmente

### Requisitos

- Git;
- Node.js `22.12.0` ou superior;
- npm.

O repositório possui um arquivo `.nvmrc` que fixa a versão recomendada do Node.js.

### Primeira instalação

```bash
git clone https://github.com/Arazoleo/NumerosPrimos.git
cd NumerosPrimos
git switch develop
nvm install
nvm use
cd react-app
npm ci
npm run dev
```

Se você não usa nvm, ignore `nvm install` e `nvm use`, mas confirme que `node --version` retorna `v22.12.0` ou uma versão mais recente.

`npm run dev` inicia os dois processos necessários:

- aplicação Vite: `http://localhost:5173`;
- servidor multiplayer: `ws://127.0.0.1:8787/api/primeverse`;
- diagnóstico do servidor pelo proxy: `http://localhost:5173/health`.

Abra a URL exibida pelo Vite no terminal. Se a porta `5173` já estiver ocupada, ele poderá escolher outra. Para confirmar que o multiplayer iniciou, acesse `http://localhost:5173/health` e procure por `"ok": true`.

Encerre os dois processos com `Ctrl+C`.

### Variáveis locais

Nenhuma variável é obrigatória para o desenvolvimento comum. O multiplayer local usa armazenamento em memória e não precisa de Redis.

Crie um arquivo local somente quando precisar alterar a configuração:

```bash
cd react-app
cp .env.example .env.local
```

Use `.env.local` para valores privados ou específicos da sua máquina. Nunca versione arquivos `.env`, chaves, tokens ou URLs com credenciais.

Reinicie `npm run dev` depois de modificar `.env.local`.

### Comandos úteis

Execute todos os comandos npm dentro de `react-app/`; a raiz do repositório não é um projeto npm.

```bash
# Aplicação e multiplayer juntos — fluxo recomendado
npm run dev

# Apenas o frontend
npm run dev:web

# Apenas o servidor multiplayer
npm run dev:multiplayer

# Testes em modo interativo
npm run test:watch
```

Rodar apenas `npm run dev:web` deixa os recursos online desligados e pode gerar `ECONNREFUSED 127.0.0.1:8787`. Para testar o produto completo, use `npm run dev`.

Para simular dois jogadores, abra o jogo em uma janela normal e em uma janela anônima do navegador.

## Fluxo de desenvolvimento

```text
Issue no Board → branch de trabalho → Pull Request para develop → Preview → release para main
```

### 1. Assumir uma tarefa

Antes de alterar código:

1. abra ou escolha uma Issue no Board;
2. confira os critérios de aceite;
3. atribua a Issue a você;
4. mova o card para **Em andamento**;
5. avise na Issue se pretende alterar um arquivo compartilhado.

Mantenha apenas uma tarefa principal em andamento por pessoa.

A Issue permanece aberta depois do merge em `develop` e só é concluída quando a mudança chega a `main` em uma release validada.

### 2. Criar uma branch

Toda branch de trabalho nasce da `develop` atualizada:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feat/123-descricao-curta
```

Prefixos usados:

| Tipo | Exemplo |
| --- | --- |
| Funcionalidade | `feat/123-nova-fase` |
| Correção | `fix/245-colisao-jogador` |
| Conteúdo | `content/301-dialogos-cripta` |
| Documentação | `docs/88-guia-local` |
| Manutenção | `chore/102-atualizar-dependencias` |

Não faça desenvolvimento nem push direto em `develop` ou `main`.

### 3. Desenvolver e validar

Faça commits pequenos e relacionados a um único objetivo. Antes de enviar a branch, execute dentro de `react-app/`:

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run build
```

Revise também o que será enviado:

```bash
git status
git diff
```

Para mudanças visuais ou de gameplay, teste o fluxo alterado no navegador e registre imagem ou vídeo para o Pull Request.

### 4. Criar commits

Adicione somente os arquivos da tarefa:

```bash
git add caminho/do/arquivo
git commit -m "feat(escopo): descreve a mudança"
```

Exemplos:

```text
feat(primebound): adiciona nova fase
fix(online): preserva sala na reconexão
test(nucleus): cobre respawn autoritativo
docs(readme): simplifica instalação local
```

Não inclua `.env`, credenciais, logs de debug ou arquivos gerados no commit.

### 5. Atualizar a branch quando necessário

Se a `develop` avançou ou o GitHub informou conflitos:

```bash
git fetch origin
git merge origin/develop
```

Resolva os conflitos, execute novamente as verificações e conclua o merge:

```bash
git add caminho/dos/arquivos-resolvidos
git commit
```

### 6. Abrir o Pull Request

Envie sua branch:

```bash
git push -u origin feat/123-descricao-curta
```

No GitHub, abra o Pull Request com:

- destino: `develop`;
- `Refs #123` para relacionar a Issue;
- resumo do que mudou;
- passos para testar;
- imagem ou vídeo quando houver alteração visual;
- riscos, dependências ou variáveis novas.

Depois, mova o card para **Em revisão**. Mudanças comuns exigem uma aprovação; protocolo multiplayer, persistência, segurança e mudanças estruturais exigem duas. O autor não aprova o próprio PR. O GitHub Actions executará lint, tipos, testes e build.

Features destinadas à `develop` usam **Squash and merge**.

### 7. Depois do merge

Atualize sua cópia local e remova a branch concluída:

```bash
git switch develop
git pull --ff-only origin develop
git branch -d feat/123-descricao-curta
```

A mudança integrada deve ser validada no Preview de `develop` antes de entrar em produção.

### 8. Release e correção urgente

Depois de validar a versão integrada no Preview, abra um PR de `develop` para `main`:

1. liste cada Issue entregue usando `Closes #123`;
2. aguarde os checks e duas aprovações;
3. use **Create a merge commit**;
4. valide a versão em produção e conclua as Issues no Board.

Uma correção urgente nasce em uma branch `hotfix/*` criada a partir de `main`, entra em `main` por PR e depois é sincronizada de volta para `develop` por outro PR.

Para detalhes adicionais deste mesmo fluxo, consulte [CONTRIBUTING.md](CONTRIBUTING.md) e [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md).
