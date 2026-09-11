# Board de desenvolvimento do Primeverse

O GitHub Project é a fonte de verdade do trabalho planejado. Issues guardam contexto e critérios de aceite; Pull Requests entregam a implementação; o board organiza prioridade, responsável e andamento.

## Estrutura recomendada

Crie um projeto chamado **Primeverse · Desenvolvimento**. Para uma equipe permanente de aproximadamente 12 pessoas, prefira um projeto pertencente a uma GitHub Organization. Enquanto o repositório continuar em uma conta pessoal, um projeto do usuário também funciona.

### Campo Status

| Status | Uso | Limite sugerido |
| --- | --- | ---: |
| Caixa de entrada | Ideia ou problema ainda não triado | Sem limite |
| Pronto | Escopo e critérios de aceite definidos | 12 itens |
| Em andamento | Trabalho ativo e com responsável | 1 por pessoa |
| Em revisão | Pull Request aberto e pronto para revisão | 4 itens |
| Em teste | Integrado em `develop` e aguardando validação no Preview | 4 itens |
| Pronto para produção | Validado no Preview e aguardando uma release | 12 itens |
| Bloqueado | Depende de decisão, acesso ou outra Issue | Sem limite |
| Concluído | Integrado à `main` e validado em Produção | Arquivamento automático após 30 dias |

### Campos adicionais

| Campo | Tipo | Valores |
| --- | --- | --- |
| Prioridade | Seleção única | P0 Crítica, P1 Alta, P2 Normal, P3 Baixa |
| Área | Seleção única | Plataforma, Landing, Primeverse Online, Último Primo, Núcleo 257, Cripta, Fenda de Ulam, Cerco de Euclides, Outros jogos, Conteúdo, Infraestrutura |
| Tamanho | Seleção única | XS, S, M, L, XL |
| Horizonte | Seleção única | Now, Next, Later |
| Sprint | Iteração | Ciclos de duas semanas |
| Data-alvo | Data | Apenas para entregas com compromisso real |
| Responsável | Campo nativo | Uma pessoa principal; colaboradores ficam na Issue |

Tarefas `XL` devem ser quebradas antes de entrar em **Pronto**. Para evitar metadados duplicados, mantenha prioridade, tamanho e sprint somente nesses campos do Project.

## Visualizações

1. **Board:** layout de quadro agrupado por Status. É a visão diária da equipe.
2. **Sprint atual:** tabela filtrada pela iteração atual, agrupada por responsável.
3. **Roadmap:** layout de roadmap com Sprint e Data-alvo.
4. **Bugs e QA:** tabela filtrada por `label:bug` e itens ainda não concluídos.
5. **Por experiência:** board agrupado por Área para enxergar o equilíbrio entre os jogos.
6. **Sem dono:** tabela de itens em Pronto ou Em andamento sem responsável.

## Automações do Project

Ative os workflows nativos:

- adicionar automaticamente Issues e PRs deste repositório ao Project;
- item novo entra em **Caixa de entrada**;
- Issue fechada pela release em `main` move o item para **Concluído**;
- reabertura remove o item de **Concluído**;
- itens concluídos há 30 dias são arquivados.

Ao abrir um Pull Request para `develop`, o autor move a Issue vinculada para **Em revisão** e usa `Refs #123`. Depois do merge, ela passa por **Em teste** e **Pronto para produção**. O PR de release `develop → main` lista `Closes #123` para cada Issue entregue.

## Labels do repositório

Use labels para natureza e domínio; não replique o Status do board em labels.

### Tipo

- `bug`
- `enhancement`
- `type: task`
- `type: content`
- `type: refactor`
- `type: docs`
- `type: test`

### Área

- `area: online`
- `area: primebound`
- `area: nucleus-257`
- `area: horror`
- `area: ulam`
- `area: euclid`
- `area: landing`
- `area: infrastructure`

### Situação especial

- `needs: design`
- `needs: decision`
- `needs: reproduction`
- `good first issue`
- `breaking change`

Prioridade e progresso pertencem aos campos do Project. Assim existe apenas uma fonte de verdade.

## Rotina para 12 pessoas

### Responsabilidade inicial

Distribua as 12 pessoas em três frentes de quatro, mantendo revisão cruzada entre elas:

- **Plataforma e multiplayer:** servidor, protocolo, persistência, deploy e progressão;
- **Jogos:** mecânicas, balanceamento, fases, IA determinística e performance;
- **Experiência e qualidade:** UI, arte, áudio, acessibilidade, testes e documentação.

Cada área crítica deve ter uma pessoa principal e uma substituta. Quando os usuários ou times do GitHub estiverem definidos, registre esse mapa em `.github/CODEOWNERS`; não crie regras com nomes provisórios.

### Triagem semanal — 30 minutos

1. Esvaziar **Caixa de entrada**.
2. Confirmar problema, resultado e critérios de aceite.
3. Definir Área, Prioridade e Tamanho.
4. Quebrar itens `XL` em Issues menores.
5. Ordenar **Pronto** por prioridade.

### Início da sprint — 45 minutos a cada duas semanas

1. Conferir capacidade real de cada pessoa.
2. Selecionar itens de **Pronto** para a Sprint.
3. Confirmar dependências e responsáveis.
4. Não preencher 100% da capacidade; reserve espaço para bugs e revisão.

### Acompanhamento assíncrono diário

Cada responsável mantém seu card atualizado e registra bloqueios na Issue. Reunião diária só é necessária quando houver dependências entre pessoas.

### Revisão da sprint — 30 minutos

Demonstrar entregas, validar pendências e registrar uma melhoria de processo para o próximo ciclo.

## Quando uma tarefa está pronta para começar

- descreve o problema ou resultado desejado;
- tem critérios de aceite verificáveis;
- indica a Área e a Prioridade;
- lista dependências conhecidas;
- cabe em até dois dias úteis ou foi dividida;
- possui material visual quando a mudança é de interface.

## Quando uma tarefa está concluída

- PR revisado e integrado à `main`;
- checks automáticos aprovados;
- critérios de aceite conferidos;
- evidência visual anexada quando aplicável;
- documentação e variáveis de ambiente atualizadas;
- nenhuma credencial ou log de debug foi incluído.

## Configuração inicial no GitHub

1. Abra **Projects → New project** no perfil ou na Organization.
2. Escolha uma tabela vazia e dê o nome **Primeverse · Desenvolvimento**.
3. Vincule o projeto ao repositório `Arazoleo/NumerosPrimos`.
4. Crie os campos e opções descritos acima.
5. Crie e salve as seis visualizações.
6. Ative os workflows nativos.
7. Crie as Issues iniciais usando [`BACKLOG.md`](BACKLOG.md) e distribua-as entre **Now**, **Next** e **Later**.
8. Abra as configurações do Project e cole o conteúdo de [`PROJECT_README.md`](PROJECT_README.md) no README do Project.
9. Em **Settings → Collaborators**, dê acesso de escrita ao time e administração apenas aos mantenedores.
10. Em **Repository Settings → Rules → Rulesets**, proteja `develop` e `main` conforme [`ENVIRONMENTS.md`](ENVIRONMENTS.md): PR obrigatório, checks obrigatórios, conversa resolvida e force-push bloqueado.

O README da raiz do repositório aparece automaticamente na página principal depois que estas mudanças forem enviadas à branch padrão. O README do GitHub Project é separado e precisa ser colado uma vez na configuração do próprio Project.
