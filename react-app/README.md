# Números Primos / Primeverse

Aplicação Vite + React que reúne a landing page e as experiências do Primeverse. O Primeverse Online mantém a mesma sala ao atravessar quatro expedições; os demais jogos continuam independentes.

## Desenvolvimento

Requisitos: Node.js 22.12 ou superior e npm.

```bash
npm ci
npm run dev
```

Esse comando inicia:

- frontend Vite em `http://localhost:5173`;
- servidor multiplayer em `ws://localhost:8787`;
- proxy local de `/api/primeverse` e `/health` pelo Vite.

Também é possível executar os processos separadamente:

```bash
npm run dev:web
npm run dev:multiplayer
```

`npm run dev:all` permanece disponível como alias explícito do fluxo combinado.

Abra `http://localhost:5173/jogos/primeverse-online`. O endpoint de diagnóstico responde em `http://localhost:5173/health`.

## Primeverse Online

Primeverse Online é um hub social 3D para até 20 exploradores por sala. O navegador simula o jogador local imediatamente e envia snapshots a 15 Hz. O servidor valida e distribui movimento, emotes, interações do Nexus e presença nas expedições; outros avatares são renderizados com um pequeno buffer de interpolação. Não existe chat, autenticação ou inventário.

### Nexus e expedições da sala

- **Nexus Primo:** reúne presença, avatares, Códice de descobertas e o evento cooperativo da sequência prima.
- **Fenda de Ulam:** corrida e exploração vertical com 230 m de percurso, 33 ilhas, quatro setores, oito termos em ordem, torres/checkpoints e perigos.
- **Cerco de Euclides:** ação e defesa em uma fortaleza vulcânica de seis setores. Possui cinco ondas, escudos fatoráveis, ataque, Pulso, defesa/parry e o Titã 210.
- **Cripta do Crivo:** survival horror em primeira pessoa, com quatro níveis liminais, lanterna e bateria, perseguidores e os selos `2 → 3 → 5 → 7`.
- **Núcleo 257:** arena FPS com quatro operadores e poderes criptográficos. Em uma sessão Online, jogadores da mesma sala entram em equipes e batalham com dano, cooldowns, ultimate, eliminações e respawn autoritativos; fora da sessão, permanece disponível a missão solo de pylons contra sentinelas.

Os portais continuam abrindo jogos com Canvas, câmera, HUD, regras e estética próprios, mas a conexão não é mais desmontada na troca de rota. O servidor atribui uma `runId` por sala e atividade; colegas recebem um convite no Nexus, entram na mesma run e veem os avatares uns dos outros. Movimento é isolado por `activityId + runId`, e uma run forjada é rejeitada. Sem uma sessão Online ativa, as quatro rotas continuam disponíveis em modo solo. Fenda, Cerco e Cripta compartilham presença e movimento, mas ainda simulam inimigos, dano e objetivos localmente. O Núcleo 257 é a primeira exceção: no Online, o servidor valida casts, colisão/alcance, dano, equipes, cooldowns, carga de ultimate, mortes e respawns; com apenas um operador, a arena aguarda outro jogador da sala em vez de criar rivais locais.

Os inimigos usam máquinas de estado determinísticas em vez de uma API de IA generativa. Isso mantém resposta imediata, custo zero por ação e comportamento reproduzível. Na Cripta, luz e corrida aumentam a detecção, enquanto mirar a lanterna de perto atordoa a criatura. No Cerco, os invasores escolhem entre atacar o artífice e pressionar o coração da forja conforme a posição e o estado do combate.

### Arquitetura

- **Frontend:** React, React Three Fiber, Drei e Three.js. Input/simulação local, render 60 FPS e cliente WebSocket são separados da UI React.
- **Contrato compartilhado:** mensagens discriminadas e validação runtime ficam junto à feature e são importadas tanto pelo navegador quanto pelo servidor.
- **Backend:** Express sobre um `node:http` server e `WebSocketServer` da biblioteca `ws`. O mesmo núcleo atende o runner local e a Vercel Function em `api/primeverse.ts`.
- **Estado local:** em desenvolvimento, salas e sockets vivem em memória dentro de um único processo.
- **Estado de produção:** Redis guarda presença, snapshots/salas e coordena eventos entre instâncias. Somente os objetos `WebSocket` da instância atual ficam em memória.
- **Isolamento Redis:** com as System Environment Variables da Vercel expostas, as chaves incluem projeto, ambiente e, em Preview, branch. Isso impede que jogadores de desenvolvimento, Preview e produção apareçam na mesma sala quando usam o mesmo banco.

Na primeira entrada o servidor gera `playerId` e um token opaco de retomada; nickname é apenas apresentação e nunca identidade. Em uma queda, o cliente usa o token para retomar com segurança o mesmo jogador lógico e a mesma sala, enquanto o servidor rotaciona o token e impede o socket antigo de sobrescrever a sessão nova. Se a lease já expirou, a entrada recebe uma identidade nova. Heartbeat remove conexões fantasmas e o reconnect usa backoff de 1, 2, 4 e 8 segundos.

### Variáveis de ambiente

Copie `.env.example` para `.env.local` quando precisar customizar o ambiente.

| Variável | Onde | Obrigatória | Uso |
| --- | --- | --- | --- |
| `REDIS_URL` | servidor | produção | URL `redis://` ou `rediss://` provisionada pela integração Redis da Vercel. |
| `PRIMEVERSE_REDIS_PREFIX` | servidor | não | Namespace explícito das chaves. O padrão deriva projeto/ambiente/branch quando as System Environment Variables da Vercel estão expostas; sem elas, configure um valor distinto por ambiente. |
| `PRIMEVERSE_ALLOWED_ORIGINS` | servidor | recomendada | Lista de origins completas, com protocolo, separadas por vírgula (por exemplo, `https://seu-dominio.com`). |
| `VITE_PRIMEVERSE_WS_URL` | build do frontend | não | URL completa do socket. Vazia deriva `ws(s)://<origin>/api/primeverse`. |
| `PORT` | servidor local + proxy Vite | não | Porta do runner local; padrão `8787`. Os dois processos leem o mesmo valor. |

Não exponha `REDIS_URL` com prefixo `VITE_`: valores `VITE_*` são incorporados ao bundle público.

### Teste com dois jogadores

1. Execute `npm run dev:all`.
2. Abra a rota do Primeverse Online no Chrome e entre como `Leonardo`.
3. Abra uma janela anônima, entre como `Ana` e confirme que ambos estão na mesma room.
4. Ande, corra, pule e mova a câmera nas duas janelas; confirme movimento remoto suave.
5. Envie emotes com `Q` ou `1–5` e confirme que aparecem no outro avatar.
6. Aproxime ambos do Prime Core e observe a energia compartilhada.
7. Vote fisicamente nos pedestais com `E` e confirme a revelação coletiva de `13`.
8. Com Leonardo, aproxime-se de um portal e pressione `E`; a rota só deve mudar depois da confirmação do servidor.
9. Na janela de Ana, aceite **Juntar-se**; confirme a mesma sala no HUD e veja o avatar holográfico de Leonardo dentro da expedição.
10. Movimente os dois jogadores na Fenda, Euclides e Cripta; apenas peers da mesma run devem aparecer.
11. Entre no Núcleo 257 com os dois jogadores. Com apenas um, confirme a mensagem de espera; com ambos, confirme equipes, avatares aliados/inimigos e início do PvP.
12. Dispare e use `Q`, `E` e `R` nas duas janelas. Confirme hit marker, direção do dano, vida/escudo iguais nas duas telas, kill feed e respawn após 5 s.
13. Volte pelo link **Nexus** e confirme que `roomId` e `playerId` foram preservados e que a `runId` foi limpa.
14. Abra uma expedição diretamente sem entrar no Online; ela deve continuar jogável e o HUD deve indicar modo solo. No Núcleo, devem voltar os pylons e sentinelas PvE.
15. Feche uma janela; o avatar correspondente deve desaparecer imediatamente da presença compartilhada e da batalha.
16. Para testar retomada, coloque uma aba offline nas DevTools por menos de 60 segundos e volte a rede: `playerId`, sala, atividade e estado do combate devem ser retomados sem avatar fantasma.
17. Pare o backend local; a tela de erro deve oferecer links funcionais para as quatro expedições solo.

Para o painel técnico, acrescente `?debug=true` à URL.

### Teste entre Mac e celular na mesma rede

O Vite escuta em `0.0.0.0`. Com os dois dispositivos no mesmo Wi-Fi, descubra o IP local do Mac (por exemplo, `192.168.1.20`) e abra no celular:

```text
http://192.168.1.20:5173/jogos/primeverse-online
```

O frontend continua usando `/api/primeverse`, que o Vite encaminha ao backend local. Autorize Node/Vite no firewall do macOS se a página não responder. Controles touch são uma adaptação compacta; desktop é a experiência principal.

### Deploy na Vercel

1. Configure `react-app` como Root Directory do projeto.
2. Vincule uma integração Redis do Marketplace que forneça `REDIS_URL` (`vercel integration add upstash` e `vercel env pull` também são suportados pelo fluxo oficial atual).
3. Mantenha **Automatically expose System Environment Variables** habilitado para o namespace automático. Se isso não for possível, defina um `PRIMEVERSE_REDIS_PREFIX` diferente em Production, Preview e Development.
4. Defina `PRIMEVERSE_ALLOWED_ORIGINS` com a origin completa de produção e, se usados, os endereços completos de Preview.
5. Faça o deploy normalmente. `vercel.json` habilita Fluid Compute, reserva até 300 s para `api/primeverse.ts`, mapeia `/health` e mantém o fallback da SPA. As Vercel Functions em `/api/*` têm precedência de filesystem sobre esse fallback.
6. Teste o deployment com dois dispositivos, não apenas duas abas.

`VITE_PRIMEVERSE_WS_URL` só é necessária se o socket for publicado em outro domínio; no deploy único, a URL é derivada do mesmo origin.

### Limitações conhecidas da Vercel

O suporte a WebSockets em Vercel Functions está em **Public Beta**. Cada socket fica preso à instância que aceitou a conexão, mas novas conexões/reconnects podem cair em outra instância. Por isso, `REDIS_URL` é requisito de produção; iniciar em produção sem Redis é tratado como erro de configuração, não como um multiplayer supostamente global.

No plano Hobby com Fluid Compute, a duração máxima atual de uma Function é 300 segundos. Ao atingir esse limite, a Vercel encerra o socket; o cliente reconecta, tenta retomar sua identidade lógica e sala por uma lease armazenada no Redis e recarrega o snapshot autoritativo. Se a lease não estiver mais disponível, ele entra como uma identidade nova. Assim, o jogo tolera a rotação da Function, mas não promete uma conexão TCP ininterrupta acima de cinco minutos.

O relay entre instâncias usa Redis Pub/Sub para baixa latência e os snapshots persistidos como fonte de verdade. Cada instância reconcilia o snapshot durável durante o tick e reaplica o `world_state` quando detecta uma lacuna do Pub/Sub. Efeitos transitórios que comecem e terminem inteiros durante uma indisponibilidade do subscriber continuam best-effort; a presença e o estado final são recuperados. Como WebSockets ainda são Beta, valide novamente os limites antes de um lançamento público e acompanhe consumo de Function/transferência e conexões Redis.

A troca da geração ativa do jogador é atômica dentro da sala. O índice global do token precisa ser atualizado logo depois porque Redis Cluster não permite uma única transação entre hash slots distintos; uma interrupção exatamente nessa janela rara pode fazer o reconnect cair para uma identidade nova. A presença anterior continua protegida pelo timeout e é removida na reconciliação seguinte.

### Verificações

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Os testes cobrem o protocolo, nickname e mensagens externas, limites de movimento por atividade, capacidade de rooms, emotes, energia do Prime Core, votação cooperativa, topologia do Nexus, runs compartilhadas, entrada por convite, isolamento entre atividades, regras da Fenda, combate/fatoração do Cerco, Crivo, bateria, colisão e percepção dos perseguidores. Também cobrem o PvP autoritativo do Núcleo 257 — equipes, casts idempotentes, dano, cooldowns, ultimate, respawn e isolamento entre runs — além de interpolação, reconexão com rotação de token, relay entre runtimes, recuperação após lacuna de Pub/Sub e isolamento de namespaces Redis.
