# Números Primos · Primeverse

Experiência interativa sobre números primos, criptografia e matemática aplicada. O projeto reúne uma landing page, jogos 2D e 3D, aventuras cooperativas e o hub multiplayer **Primeverse Online**.

> Projeto em desenvolvimento ativo. A equipe organiza o trabalho por Issues, Pull Requests e GitHub Projects.

## Jogar

- Produção: [numeros-primos-theta.vercel.app](https://numeros-primos-theta.vercel.app/)
- Preview integrado: publicado pela branch `develop` depois do primeiro push
- Hub multiplayer local: `http://localhost:5173/jogos/primeverse-online`
- O Último Primo: `http://localhost:5173/jogos/primebound`

## Experiências principais

| Experiência | Formato | Destaque |
| --- | --- | --- |
| Primeverse Online | Hub social 3D | Salas, avatares, portais e atividades compartilhadas |
| O Último Primo | Ação 2D em pixel art | Oito campeões, poderes matemáticos, bosses e transformações |
| Núcleo 257 | Arena FPS | Operadores criptográficos e combate online autoritativo |
| Cripta do Crivo | Terror em primeira pessoa | Níveis liminais, lanterna, perseguição e enigmas |
| Fenda de Ulam | Plataforma e exploração | Travessia vertical cooperativa pela espiral de Ulam |
| Cerco de Euclides | Defesa e combate | Ondas, fatoração e objetivos cooperativos |

## Desenvolvimento local

Requisitos: Node.js 22.12 ou superior e npm.

```bash
cd react-app
npm ci
cp .env.example .env.local
npm run dev
```

O comando inicia o frontend Vite em `http://localhost:5173` e o servidor multiplayer em `ws://localhost:8787`.

## Qualidade

Antes de abrir um Pull Request, execute:

```bash
cd react-app
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run build
```

Os mesmos comandos são executados automaticamente pelo GitHub Actions.

## Trabalho em equipe

- [Como contribuir](CONTRIBUTING.md)
- [Configuração e rotina do board](docs/BOARD.md)
- [Branches, Preview e produção](docs/ENVIRONMENTS.md)
- [Backlog inicial para criar as Issues](docs/BACKLOG.md)
- [Texto para o README do GitHub Project](docs/PROJECT_README.md)
- [Documentação técnica detalhada](react-app/README.md)

Toda mudança começa em uma Issue, entra em `develop` por Pull Request e só chega à `main` em uma release validada no Preview. Não coloque tokens, chaves de API ou conteúdo de `.env` em commits, Issues, PRs ou screenshots.

## Stack

React, TypeScript, Vite, Three.js, React Three Fiber, Express, WebSocket, Redis e Vitest.
