# Backlog inicial do Primeverse

Este arquivo é a fila inicial para criar Issues no GitHub Project. Os códigos abaixo são identificadores de planejamento, não números de Issue. Depois de criar cada Issue, substitua referências ao código pelo número gerado pelo GitHub.

## Ordem de entrada no board

| Código | Horizonte | Prioridade | Tamanho | Área | Título |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Now | P0 | S | Infraestrutura | Rotacionar credencial exposta e bloquear novos secrets |
| INFRA-001 | Now | P1 | M | Infraestrutura | Versionar uma baseline reproduzível do aplicativo |
| REPO-001 | Now | P1 | S | Infraestrutura | Ativar o Project, regras de branches e checks obrigatórios |
| MP-001 | Now | P1 | L | Primeverse Online | Persistir lobbies de expedição entre runtimes |
| CONTENT-001 | Now | P1 | S | Plataforma | Eliminar divergências entre catálogo e conteúdo real |
| GAME-001 | Next | P1 | M | Núcleo 257 | Completar o quinto operador do Núcleo 257 |
| QA-001 | Next | P1 | M | Infraestrutura | Adicionar smoke tests E2E dos fluxos críticos |
| MP-002 | Next | P1 | L | Último Primo | Tornar o co-op de Primebound autoritativo no servidor |
| PROG-001 | Next | P1 | M | Plataforma | Integrar todas as expedições à progressão global |
| UX-001 | Next | P1 | M | Plataforma | Unificar preferências de acessibilidade e áudio |
| UX-002 | Later | P2 | M | Plataforma | Fechar a matriz de teclado, touch e fallback gráfico |
| PROG-002 | Later | P2 | M | Plataforma | Expandir conquistas para o catálogo atual |
| ASSET-001 | Later | P2 | S | Conteúdo | Criar manifesto e validação de arte e áudio |
| ARCH-001 | Later | P2 | L | Infraestrutura | Modularizar os hotspots de manutenção |

Comece com no máximo cinco itens em **Now**. A prioridade indica impacto; o horizonte indica quando a equipe pretende tratar o item.

## Issues prontas para criação

### SEC-001 — Rotacionar credencial exposta e bloquear novos secrets

**Contexto:** uma credencial real foi exibida durante o desenvolvimento e deve ser considerada comprometida, mesmo que o arquivo local esteja ignorado pelo Git.

**Critérios de aceite:**

- [ ] A chave atual foi revogada no provedor e substituída por outra armazenada somente localmente ou no secret store do deploy.
- [ ] Arquivos rastreados e histórico foram auditados sem publicar os valores encontrados.
- [ ] Secret scanning e push protection foram habilitados no GitHub quando disponíveis.
- [ ] Variáveis exigidas pelo servidor estão documentadas em `.env.example` sem valores reais.
- [ ] O PR não contém credenciais em código, logs, screenshots ou fixtures.

### INFRA-001 — Versionar uma baseline reproduzível do aplicativo

**Contexto:** a maior parte do aplicativo atual ainda aparece como não rastreada. Uma pessoa que clonar a `main` hoje não recebe o mesmo produto existente no workspace do autor.

**Critérios de aceite:**

- [ ] Fontes, testes, servidor, configurações e assets intencionais foram revisados e adicionados ao Git.
- [ ] `dist`, `node_modules`, `.DS_Store`, arquivos `.env`, caches e logs continuam ignorados.
- [ ] Um clone limpo executa `npm ci`, lint, typecheck, testes e build.
- [ ] O PR de baseline separa claramente os arquivos do produto de artefatos locais.
- [ ] Depois do fluxo de instalação e testes, `git status` permanece limpo.

### REPO-001 — Ativar o Project, regras de branches e checks obrigatórios

**Contexto:** os arquivos locais de colaboração estão prontos, mas as políticas remotas precisam ser ligadas no GitHub.

**Critérios de aceite:**

- [ ] O Project **Primeverse · Desenvolvimento** possui os campos, status e visualizações de `docs/BOARD.md`.
- [ ] Issues e PRs do repositório são adicionados automaticamente ao Project.
- [ ] `develop` exige Pull Request, uma aprovação, conversas resolvidas e checks verdes.
- [ ] `main` aceita apenas release de `develop` ou `hotfix/*`, exige duas aprovações e checks verdes.
- [ ] Merge direto, exclusão e force-push estão bloqueados nas duas branches.
- [ ] Vercel mantém `main` como Production Branch e publica `develop` em um Preview estável.
- [ ] O README do Project contém o texto de `docs/PROJECT_README.md`.
- [ ] A equipe sabe quem possui permissão de manutenção e quem possui acesso de escrita.

### MP-001 — Persistir lobbies de expedição entre runtimes

**Contexto:** os lobbies de expedição vivem em um `Map` local do servidor. Em produção, host e convidado podem cair em runtimes diferentes e enxergar estados incompatíveis.

**Critérios de aceite:**

- [ ] O store oferece operações atômicas de criar, entrar, ficar pronto, iniciar, sair e expirar lobby.
- [ ] Redis persiste o lobby com TTL e a implementação em memória mantém o desenvolvimento local.
- [ ] Um teste com dois runtimes e o mesmo store cobre host e convidado em instâncias diferentes.
- [ ] Transferência de host, reconexão e expiração continuam funcionando.
- [ ] Métricas ou logs sanitizados permitem diagnosticar falhas de sincronização.

### CONTENT-001 — Eliminar divergências entre catálogo e conteúdo real

**Contexto:** há telas e documentação mencionando quatro expedições, quatro operadores e quatro campeões/oito regiões, enquanto as fontes atuais declaram cinco expedições, cinco operadores e oito campeões/doze regiões.

**Critérios de aceite:**

- [ ] README, catálogo, introduções e contadores exibem as quantidades atuais.
- [ ] Contagens visíveis são derivadas dos arrays canônicos quando possível.
- [ ] Um teste de contrato falha quando catálogo, rotas e rosters divergem.
- [ ] A equipe identifica em documentação qual arquivo é a fonte de verdade de cada catálogo.

### GAME-001 — Completar o quinto operador do Núcleo 257

**Contexto:** existem cinco kits, mas partes da seleção ainda anunciam quatro operadores e Íris reutiliza a arquitetura visual de outro personagem.

**Critérios de aceite:**

- [ ] Texto e contador da seleção derivam de `HERO_KIT_LIST.length`.
- [ ] Íris possui silhueta e arquitetura 3D próprias, distinguíveis durante o combate.
- [ ] Todos os cinco operadores têm retrato, kit, fala e fallback consistentes.
- [ ] Um teste percorre os cinco operadores e valida seleção, kit e representação.

### QA-001 — Adicionar smoke tests E2E dos fluxos críticos

**Contexto:** a suíte unitária é ampla, mas não há uma verificação de navegador que proteja rotas, seletores e entrada multiplayer de ponta a ponta.

**Critérios de aceite:**

- [ ] Todas as rotas registradas em `src/App.jsx` carregam sem erro não tratado.
- [ ] Primebound cobre introdução, seleção de personagem e início da partida.
- [ ] Núcleo 257 cobre seleção de operador e entrada na arena.
- [ ] Online cobre backend indisponível e duas sessões entrando na mesma sala.
- [ ] A suíte roda em Chromium desktop e em uma viewport mobile na CI.

### MP-002 — Tornar o co-op de Primebound autoritativo no servidor

**Contexto:** o relay atual aceita payload de gameplay produzido pelo host. Isso permite divergências e ações forjadas quando o co-op crescer.

**Critérios de aceite:**

- [ ] O estado compartilhado possui schema e versão explícitos.
- [ ] O servidor valida sequência, dano, inimigo, região e limites antes de aplicar ações.
- [ ] Reconexão recupera o último snapshot sem reiniciar a run.
- [ ] Testes rejeitam ações forjadas, duplicadas ou pertencentes a outra run.
- [ ] A arquitetura pode ser reutilizada por Fenda, Cerco e Cripta.

### PROG-001 — Integrar todas as expedições à progressão global

**Contexto:** várias experiências novas não fazem parte do tipo central de jogos e não atualizam a progressão de maneira uniforme.

**Critérios de aceite:**

- [ ] Cada expedição emite um resultado tipado com vitória/derrota, score, duração e XP.
- [ ] XP e recorde são gravados exatamente uma vez por run.
- [ ] O hub reflete a progressão imediatamente depois do retorno.
- [ ] Saves existentes continuam válidos após a migração.
- [ ] Testes cobrem idempotência de cada adaptador novo.

### UX-001 — Unificar preferências de acessibilidade e áudio

**Contexto:** qualidade já é persistida, mas movimento reduzido e mute possuem implementações diferentes entre os jogos.

**Critérios de aceite:**

- [ ] Um único store ou hook persiste qualidade, volume/mute e movimento reduzido.
- [ ] Todas as rotas respeitam `prefers-reduced-motion` e uma preferência manual.
- [ ] Todo jogo com áudio oferece um controle de mute acessível por teclado e toque.
- [ ] Preferências sobrevivem à navegação entre experiências.
- [ ] Testes cobrem persistência e restauração dos valores.

### UX-002 — Fechar a matriz de teclado, touch e fallback gráfico

**Contexto:** os controles e fallbacks variam entre experiências, o que torna falhas de WebGL, troca de aba e uso no celular imprevisíveis.

**Critérios de aceite:**

- [ ] Fluxos principais funcionam em `1366×768`, `390×844` e celular em paisagem.
- [ ] A interface mostra comandos correspondentes ao dispositivo atual.
- [ ] Toda cena Canvas possui fallback útil e retorno seguro ao hub.
- [ ] Foco, pause e controles são limpos ao trocar aba, orientação ou rota.
- [ ] A matriz testada fica registrada no PR ou na documentação de QA.

### PROG-002 — Expandir conquistas para o catálogo atual

**Contexto:** as conquistas atuais estão concentradas nas primeiras experiências e não cobrem o catálogo completo.

**Critérios de aceite:**

- [ ] Cada jogo disponível possui ao menos uma conquista específica.
- [ ] Condições usam eventos tipados de progressão, sem regra duplicada na UI.
- [ ] A migração preserva saves existentes.
- [ ] Testes cobrem desbloqueio, persistência e não duplicação.

### ASSET-001 — Criar manifesto e validação de arte e áudio

**Contexto:** o volume de retratos, falas, sprites e vídeos cresceu e precisa de uma fonte de verdade sobre uso, fallback e licença.

**Critérios de aceite:**

- [ ] Um manifesto relaciona personagem, retrato, falas, vídeo, autoria/origem e licença.
- [ ] Um teste verifica que todo caminho declarado existe fisicamente.
- [ ] Retrato ou áudio ausente possui fallback visível ou silencioso controlado.
- [ ] Créditos incluem as artes e ferramentas/provedores utilizados.

### ARCH-001 — Modularizar os hotspots de manutenção

**Contexto:** arquivos muito grandes de gameplay, protocolo e servidor aumentam conflitos para uma equipe com várias branches simultâneas.

**Critérios de aceite:**

- [ ] Primebound separa input, simulação, renderização, áudio e apresentação.
- [ ] O servidor separa handlers de sessão, lobby, party e combate.
- [ ] O protocolo separa tipos, parsers e validações por domínio.
- [ ] A mudança é incremental, não altera gameplay e mantém a suíte existente verde.
- [ ] Cada etapa pode ser revisada em um PR pequeno e independente.
