# Branches, Preview e produção

Este projeto usa duas branches permanentes. `develop` integra o trabalho da equipe e alimenta o ambiente de Preview; `main` representa exatamente o que pode ir para Produção.

```text
feature/* ──PR + squash──▶ develop ──PR de release + merge commit──▶ main
                              │                                      │
                              ▼                                      ▼
                     Preview compartilhado                      Produção
```

## Regras do fluxo

| Origem | Destino | Uso | Merge |
| --- | --- | --- | --- |
| `feat/*`, `fix/*`, `content/*`, `docs/*`, `chore/*` | `develop` | Trabalho normal | Squash |
| `develop` | `main` | Release validada | Merge commit |
| `hotfix/*` criada de `main` | `main` | Incidente de produção | Squash ou merge commit |
| `main` | `develop` | Sincronização após hotfix | Merge commit |

Não faça push direto em `develop` ou `main`. Manter o merge commit na release faz com que `main` reconheça o histórico de `develop` e evita que a release seguinte repita commits antigos.

`develop` não é depósito de trabalho incompleto: cada merge precisa passar CI, revisão e teste no Preview individual do PR. Trabalho ainda instável permanece na feature branch ou entra protegido por uma feature flag desligada. Se `develop` ficar vermelho, novos merges param até correção ou revert.

## Configuração no GitHub

Mantenha `main` como branch padrão do repositório e como branch de produção. Crie dois rulesets em **Settings → Rules → Rulesets**.

Na ativação inicial, publique primeiro a baseline em `develop` e espere a CI e a Vercel reportarem seus checks. Abra um PR pequeno para `develop` para registrar também o check de política; só então os nomes estarão disponíveis para seleção nos rulesets. Até terminar esse bootstrap, mantenedores não fazem push direto nas branches permanentes.

### Ruleset de `develop`

- exigir Pull Request;
- exigir uma aprovação que não seja do último autor;
- exigir resolução de todas as conversas;
- exigir os checks **Lint, tipos, testes e build** e **Destino correto do Pull Request**;
- exigir que a branch esteja atualizada ou usar merge queue, se o plano do repositório oferecer o recurso; os workflows já atendem ao evento `merge_group`;
- bloquear force-push e exclusão;
- aplicar as regras também aos administradores, salvo uma conta de emergência bem controlada.

### Ruleset de `main`

- exigir Pull Request e duas aprovações;
- exigir resolução de todas as conversas;
- exigir os dois checks anteriores e o check de deploy da Vercel depois que ele aparecer pela primeira vez;
- bloquear force-push e exclusão;
- aceitar somente `develop` ou `hotfix/*` como origem, regra também verificada por `.github/workflows/branch-policy.yml`.
- não exigir histórico linear, pois releases usam merge commit.

O GitHub só interpreta `Closes #123` automaticamente em Pull Requests destinados à branch padrão. Em PRs para `develop`, use `Refs #123` e vincule a Issue manualmente na seção **Development**. No PR de release para `main`, liste todas as Issues entregues usando `Closes`.

## Configuração na Vercel

1. Confirme **Root Directory: `react-app`** nas configurações do projeto.
2. Configure Node.js `22.x`, a mesma major usada pela CI.
3. Em **Settings → Environments → Production → Branch Tracking**, confirme `main` como Production Branch.
4. Faça o primeiro push de `develop`. A Vercel criará um Preview e uma URL de branch que sempre aponta para o deploy mais recente de `develop`.
5. Para um endereço amigável, adicione um domínio como `preview.seudominio.com` em **Settings → Domains**, conecte-o ao ambiente **Preview** e informe a Git Branch `develop`.
6. Mantenha os previews das demais branches para revisar PRs individualmente; apenas o endereço ligado a `develop` é o ambiente integrado da equipe.
7. Depois do primeiro deploy, exija o check **Vercel – numeros-primos** nos rulesets.

Não é necessário criar um workflow de deploy duplicado: com o repositório conectado, a integração Git da Vercel publica pushes e Pull Requests automaticamente.

### Domínio canônico

Atualmente `numeros-primos-theta.vercel.app` e `numeros-primos-khaki.vercel.app` respondem com o mesmo site, mas o campo **About** do GitHub ainda aponta para o segundo. Adote `numeros-primos-theta.vercel.app` como canônico, atualize o campo do GitHub e mantenha o outro apenas como alias, para a equipe não compartilhar dois endereços de Produção.

## Variáveis e isolamento de dados

Configure valores separados por ambiente no painel da Vercel:

| Variável | Preview `develop` | Produção `main` |
| --- | --- | --- |
| `REDIS_URL` | banco de Preview; obrigatório para o multiplayer | banco de Produção |
| `PRIMEVERSE_REDIS_PREFIX` | `primeverse:preview:develop` | `primeverse:production` |
| `PRIMEVERSE_ALLOWED_ORIGINS` | domínio estável de Preview | domínio de Produção |
| `VITE_PRIMEVERSE_WS_URL` | vazio quando usa o mesmo domínio | vazio quando usa o mesmo domínio |

O servidor já deriva namespaces distintos usando as variáveis de sistema da Vercel, mas um prefixo explícito — e, idealmente, um Redis separado — reduz o risco de jogadores e dados de teste aparecerem em Produção.

Secrets de Preview e Produção devem ser cadastrados separadamente. Nunca copie valores para `.env.example`, documentação, logs ou screenshots. Qualquer credencial já exposta precisa ser revogada antes do primeiro deploy da equipe.

## Processo de release

1. Pare novos merges em `develop` durante a validação final.
2. Rode lint, typecheck, testes e build.
3. Valide login/entrada, duas sessões multiplayer, rotas principais e celular no domínio de Preview.
4. Abra `develop → main`, use merge commit e inclua `Closes #...` para as Issues da release.
5. Confirme o deploy de Produção e o endpoint `/health`.
6. Se houver regressão, reverta o PR na `main` ou use o rollback da Vercel; depois sincronize a correção com `develop`.

## Primeira publicação de `develop`

O workspace atual já está na branch local `develop`, mas ainda não existe uma branch remota. Depois de revisar e versionar a baseline intencional:

```bash
git add <arquivos revisados>
git commit -m "chore: cria baseline colaborativa"
git push -u origin develop
```

Não use `git add .` antes de revisar os arquivos não rastreados e não publique nenhum `.env`.

O `/health` da Produção atual ainda responde `404` porque `vercel.json`, `api/` e o backend novo não existem na `main` remota. Ele só deve virar gate obrigatório depois que a baseline for revisada e publicada.
