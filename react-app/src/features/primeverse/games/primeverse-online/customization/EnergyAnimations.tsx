/**
 * Efeitos visuais das energias na prévia da personalização do Primeverse Online.
 *
 * Cada energia desenha uma cena SVG atrás do personagem, num quadro de
 * 260 × 178 px em que o tronco do personagem fica por volta de (130, 90):
 *   prime-ring    → Escudo Primo: órbitas com números primos que viram um escudo
 *   crypto-matrix → Decifra-Pista: painel de pixels que revela uma chave
 *   factor-net    → Visão dos Fatores: rede de LEDs que monta a árvore de fatores do 12
 *   cipher-lock   → Chave Secreta: anéis de fechadura que se alinham e abrem um cadeado
 *
 * A forma de cada efeito é fixa; a cor escolhida (`--energy-color`) só muda o brilho.
 * Há dois estados: contínuo (sempre rodando, discreto) e ativo (classe `active`,
 * ligada pelo botão "Testar poder"). As animações ficam em energy-animations.css;
 * aqui só montamos a geometria e passamos atrasos (`--d`) para cada peça.
 */

import type { CSSProperties } from 'react'
import type { EnergyType } from '../shared/protocol'
import './energy-animations.css'

interface EnergyAnimationProps {
  /** Qual energia desenhar. */
  readonly type: EnergyType
  /** Cor do brilho escolhida pelo jogador. */
  readonly color: string
  /** true enquanto o poder está sendo testado (animação mais evidente). */
  readonly active?: boolean
}

/** Centro do personagem dentro do quadro 260 × 178: anéis e órbitas giram em torno dele. */
const CX = 130
const CY = 90

/** Componente público: escolhe a cena da energia e repassa cor e estado ativo via CSS. */
export function EnergyAnimation({ type, color, active = false }: EnergyAnimationProps): JSX.Element {
  const style = { '--energy-color': color } as CSSProperties

  return (
    <div className={`energy-anim energy-anim--${type} ${active ? 'active' : ''}`} style={style}>
      <svg className="energy-anim__scene" viewBox="0 0 260 178" aria-hidden="true">
        {type === 'prime-ring' && <PrimeShield />}
        {type === 'crypto-matrix' && <CryptoMatrix />}
        {type === 'factor-net' && <FactorNet />}
        {type === 'cipher-lock' && <CipherLock />}
      </svg>
    </div>
  )
}

/* ── Escudo Primo ──────────────────────────────────────────────────────────
 * Contínuo: três órbitas inclinadas com um rastro de luz e números primos que
 * aparecem de vez em quando, viajando pela órbita.
 * Ativo: as órbitas giram/esticam até formar uma "gaiola" ao redor do
 * personagem, surge um escudo translúcido e os primos 2, 3, 5, 7 e 11 o cercam.
 */

/**
 * Configuração de cada órbita:
 * rx/ry = raios da elipse · tilt = inclinação normal · shieldTilt/sx/sy = rotação e
 * escala no modo escudo (todas viram elipses de mesmo tamanho) · dur = segundos por volta.
 */
const PRIME_ORBITS = [
  { rx: 74, ry: 20, tilt: -18, shieldTilt: 60, sx: 0.89, sy: 1.3, dur: 9, primes: ['2', '7'] },
  { rx: 62, ry: 24, tilt: 22, shieldTilt: -60, sx: 1.065, sy: 1.083, dur: 12, primes: ['3', '11'] },
  { rx: 86, ry: 16, tilt: 4, shieldTilt: 0, sx: 0.767, sy: 1.625, dur: 15, primes: ['5'] },
] as const

/** Primos que cercam o escudo; `angle` é a posição em graus ao redor do centro. */
const SHIELD_PRIMES = [
  { label: '2', angle: 200 },
  { label: '3', angle: 160 },
  { label: '5', angle: -20 },
  { label: '7', angle: 20 },
  { label: '11', angle: 270 },
] as const

/** Elipse centrada no personagem escrita como caminho (usado pelo traço e pelo animateMotion). */
function orbitPath(rx: number, ry: number): string {
  return `M${CX - rx} ${CY} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0`
}

/** Cena do Escudo Primo. */
function PrimeShield(): JSX.Element {
  return (
    <>
      {/* Escudo translúcido (invisível até o poder ser testado) */}
      <g className="pr-shield">
        <circle cx={CX} cy={CY} r="66" className="pr-shield__dome" />
        <circle cx={CX} cy={CY} r="58" className="pr-shield__inner" />
      </g>
      {PRIME_ORBITS.map((orbit, index) => {
        const d = orbitPath(orbit.rx, orbit.ry)
        // A inclinação e a escala do modo escudo vão como variáveis CSS para a transição animar entre elas.
        return (
          <g
            key={index}
            className="pr-orbit"
            style={{
              '--tilt': `${orbit.tilt}deg`,
              '--shield-tilt': `${orbit.shieldTilt}deg`,
              '--sx': orbit.sx,
              '--sy': orbit.sy,
            } as CSSProperties}
          >
            {/* Linha fina da órbita; non-scaling-stroke mantém a espessura quando a órbita estica */}
            <path d={d} className="pr-orbit__line" vectorEffect="non-scaling-stroke" />
            {/* Rastro de luz percorrendo a órbita (a órbita do meio gira ao contrário) */}
            <path
              d={d}
              pathLength={100}
              className="pr-orbit__comet"
              vectorEffect="non-scaling-stroke"
              style={{ animationDuration: `${orbit.dur}s`, animationDirection: index === 1 ? 'reverse' : 'normal' } as CSSProperties}
            />
            {/* Números primos que viajam pela órbita (animateMotion) e aparecem/somem pelo CSS */}
            {orbit.primes.map((prime, primeIndex) => (
              <g
                key={prime}
                className="pr-orbit__prime"
                style={{ animationDelay: `${index * 1.4 + primeIndex * 3}s` } as CSSProperties}
              >
                <circle r="6.5" />
                <text dy="2.6">{prime}</text>
                <animateMotion
                  dur={`${orbit.dur}s`}
                  begin={`-${(orbit.dur / orbit.primes.length) * primeIndex}s`}
                  repeatCount="indefinite"
                  path={d}
                  keyPoints={index === 1 ? '1;0' : '0;1'}
                  keyTimes="0;1"
                  calcMode="linear"
                />
              </g>
            ))}
          </g>
        )
      })}
      {/* Primos fixos em volta do escudo; o grupo externo posiciona, o interno anima a entrada */}
      <g className="pr-shield__primes">
        {SHIELD_PRIMES.map(({ label, angle }, index) => {
          const rad = (angle * Math.PI) / 180
          return (
            <g key={label} transform={`translate(${CX + Math.cos(rad) * 76} ${CY + Math.sin(rad) * 76})`}>
              <g className="pr-shield__prime" style={{ animationDelay: `${0.35 + index * 0.08}s` } as CSSProperties}>
                <circle r="7" />
                <text dy="2.8">{label}</text>
              </g>
            </g>
          )
        })}
      </g>
    </>
  )
}

/* ── Decifra-Pista ─────────────────────────────────────────────────────────
 * Contínuo: painel digital de pixels atrás do personagem, com alguns pixels
 * piscando, dois "cursores" pulando pelas linhas e uma linha de varredura.
 * Ativo: uma onda acende o painel, o resto apaga e uma chave em pixels
 * aparece no lado direito (fora da área do corpo).
 */

/** Grade 13 × 8 de células de 17 px, começando em (MATRIX_X, MATRIX_Y). */
const MATRIX_COLS = 13
const MATRIX_ROWS = 8
const MATRIX_CELL = 17
const MATRIX_X = 19.5
const MATRIX_Y = 18

// Chave em pixels desenhada nas colunas 9–12 (lado direito), longe do personagem. X = pixel aceso.
const KEY_PATTERN = [
  '....',
  '.XX.',
  'X..X',
  '.XX.',
  '.X..',
  '.XX.',
  '.X..',
  '.XX.',
] as const

/**
 * Define o tamanho de cada célula a partir da posição. É um "sorteio" fixo
 * (sem Math.random) para o padrão ser sempre o mesmo e ter alguns espaços vazios.
 */
function matrixCell(col: number, row: number): 'empty' | 'small' | 'medium' {
  const hash = (col * 7 + row * 13) % 10
  if (hash < 2) return 'empty'
  return hash < 5 ? 'small' : 'medium'
}

/** Cena do Decifra-Pista. */
function CryptoMatrix(): JSX.Element {
  const cells: JSX.Element[] = []
  const keyCells: JSX.Element[] = []

  // Percorre a grade montando as células do painel e, separadamente, os pixels da chave.
  // --d atrasa a onda do modo ativo (diagonal); --blink espalha as piscadas do modo contínuo.
  for (let row = 0; row < MATRIX_ROWS; row += 1) {
    for (let col = 0; col < MATRIX_COLS; col += 1) {
      const x = MATRIX_X + col * MATRIX_CELL
      const y = MATRIX_Y + row * MATRIX_CELL
      const kind = matrixCell(col, row)
      if (kind !== 'empty') {
        const size = kind === 'medium' ? 11 : 6
        const offset = (14 - size) / 2
        const blinks = (col * 5 + row * 3) % 7 === 0
        cells.push(
          <rect
            key={`${col}-${row}`}
            className={`cm-cell ${blinks ? 'cm-cell--blink' : ''}`}
            x={x + offset}
            y={y + offset}
            width={size}
            height={size}
            rx="1.5"
            style={{ '--d': `${(col + row) * 0.05}s`, '--blink': `${((col * 3 + row * 5) % 9) * 0.45}s` } as CSSProperties}
          />,
        )
      }
      // Pixels da chave ficam numa camada própria, escondida até o poder ser testado.
      const keyCol = col - 9
      if (keyCol >= 0 && KEY_PATTERN[row][keyCol] === 'X') {
        keyCells.push(
          <rect
            key={`key-${col}-${row}`}
            className="cm-key"
            x={x + 1.5}
            y={y + 1.5}
            width="11"
            height="11"
            rx="1.5"
            style={{ '--d': `${0.7 + row * 0.08}s` } as CSSProperties}
          />,
        )
      }
    }
  }

  // Tamanho total do painel (a última célula não tem espaçamento depois dela).
  const panelW = MATRIX_COLS * MATRIX_CELL - 3
  const panelH = MATRIX_ROWS * MATRIX_CELL - 3

  return (
    <>
      {/* Fundo do painel e cantoneiras de interface */}
      <rect className="cm-panel" x={MATRIX_X - 5} y={MATRIX_Y - 5} width={panelW + 10} height={panelH + 10} rx="4" />
      <path
        className="cm-corner"
        d={`M${MATRIX_X - 5} ${MATRIX_Y + 7} V${MATRIX_Y - 5} H${MATRIX_X + 7}
            M${MATRIX_X + panelW - 7} ${MATRIX_Y - 5} H${MATRIX_X + panelW + 5} V${MATRIX_Y + 7}
            M${MATRIX_X - 5} ${MATRIX_Y + panelH - 7} V${MATRIX_Y + panelH + 5} H${MATRIX_X + 7}
            M${MATRIX_X + panelW - 7} ${MATRIX_Y + panelH + 5} H${MATRIX_X + panelW + 5} V${MATRIX_Y + panelH - 7}`}
      />
      <g className="cm-cells">{cells}</g>
      {/* Dois pixels "cursor" que pulam pela linha, como se reescrevessem o código */}
      <rect className="cm-cursor" x={MATRIX_X + 1.5} y={MATRIX_Y + MATRIX_CELL * 2 + 1.5} width="11" height="11" rx="1.5" />
      <rect className="cm-cursor cm-cursor--late" x={MATRIX_X + 1.5} y={MATRIX_Y + MATRIX_CELL * 6 + 1.5} width="11" height="11" rx="1.5" />
      {/* Linha de varredura descendo pelo painel */}
      <rect className="cm-scan" x={MATRIX_X - 5} y={MATRIX_Y - 5} width={panelW + 10} height="2" />
      {/* Chave revelada no modo ativo */}
      <g className="cm-keys">{keyCells}</g>
    </>
  )
}

/* ── Visão dos Fatores ─────────────────────────────────────────────────────
 * Contínuo: rede geométrica de pontos (espelhada dos dois lados do personagem)
 * em que os pontos acendem em sequência e as linhas vão sendo desenhadas.
 * Ativo: a rede escurece e dos dois lados se forma a árvore de fatores
 * 12 → 3 × 4 → 2 × 2 × 3, um nível de cada vez.
 */

/** Pontos do lado esquerdo da rede; o lado direito é o espelho (x → 260 − x). */
const NET_LEFT = [
  [40, 38],
  [72, 22],
  [22, 84],
  [62, 74],
  [38, 128],
  [82, 150],
  [102, 12],
] as const

/** Todos os pontos: índices 0–6 à esquerda e 7–13 à direita. */
const NET_NODES = [...NET_LEFT, ...NET_LEFT.map(([x, y]) => [260 - x, y] as const)]

// Ligações como pares de índices: lado esquerdo, o mesmo espelhado e duas pontes entre os lados.
const NET_LEFT_EDGES = [
  [1, 0], [0, 2], [0, 3], [3, 2], [2, 4], [3, 5], [4, 5], [1, 6], [1, 3],
] as const
const MIRROR = NET_LEFT.length
const NET_EDGES = [
  ...NET_LEFT_EDGES,
  ...NET_LEFT_EDGES.map(([a, b]) => [a + MIRROR, b + MIRROR] as const),
  [6, 6 + MIRROR],
  [5, 5 + MIRROR],
] as const

/** Nós da árvore de fatores (lado esquerdo); `d` é o atraso (s) em que cada um aparece. */
const FACTOR_TREE = [
  { id: '12', x: 52, y: 40, d: 0.1 },
  { id: '3', x: 28, y: 82, d: 0.8 },
  { id: '4', x: 74, y: 82, d: 0.8 },
  { id: '2a', x: 58, y: 124, d: 1.6 },
  { id: '2b', x: 90, y: 124, d: 1.6 },
] as const

/** Ligações da árvore (índices em FACTOR_TREE) e quando cada uma é desenhada. */
const FACTOR_LINKS = [
  { from: 0, to: 1, d: 0.5 },
  { from: 0, to: 2, d: 0.5 },
  { from: 2, to: 3, d: 1.3 },
  { from: 2, to: 4, d: 1.3 },
] as const

/** Cena da Visão dos Fatores. */
function FactorNet(): JSX.Element {
  return (
    <>
      {/* Rede contínua: linhas que se desenham em sequência (--d) e pontos que acendem */}
      <g className="fn-net">
        {NET_EDGES.map(([a, b], index) => (
          <line
            key={`${a}-${b}`}
            className="fn-edge"
            x1={NET_NODES[a][0]}
            y1={NET_NODES[a][1]}
            x2={NET_NODES[b][0]}
            y2={NET_NODES[b][1]}
            pathLength={1}
            style={{ '--d': `${index * 0.22}s` } as CSSProperties}
          />
        ))}
        {NET_NODES.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            className="fn-node"
            cx={x}
            cy={y}
            r={index % MIRROR === 3 || index % MIRROR === 0 ? 3 : 2.2}
            style={{ '--d': `${(index % MIRROR) * 0.35 + (index >= MIRROR ? 0.18 : 0)}s` } as CSSProperties}
          />
        ))}
      </g>
      {/* Árvore de fatores do 12 dos dois lados, mostrada só no modo ativo */}
      <FactorTree side="left" />
      <FactorTree side="right" />
    </>
  )
}

/**
 * Árvore de fatores do 12 (12 → 3 e 4 → 4 vira 2 e 2). As coordenadas são do
 * lado esquerdo; no lado direito o x é espelhado (260 − x), sem inverter os números.
 */
function FactorTree({ side }: { readonly side: 'left' | 'right' }): JSX.Element {
  const x = (value: number) => (side === 'left' ? value : 260 - value)

  return (
    <g className="fn-tree">
      {FACTOR_LINKS.map(({ from, to, d }) => (
        <line
          key={`${from}-${to}`}
          className="fn-tree__link"
          x1={x(FACTOR_TREE[from].x)}
          y1={FACTOR_TREE[from].y}
          x2={x(FACTOR_TREE[to].x)}
          y2={FACTOR_TREE[to].y}
          pathLength={1}
          style={{ '--d': `${d}s` } as CSSProperties}
        />
      ))}
      {FACTOR_TREE.map((node) => (
        <g key={node.id} transform={`translate(${x(node.x)} ${node.y})`}>
          <g className="fn-tree__node" style={{ '--d': `${node.d}s` } as CSSProperties}>
            <circle r="9" />
            {/* Os dois "2" têm ids 2a/2b só para a key do React; o texto exibido é "2" */}
            <text dy="3.2">{node.id.replace(/[ab]$/, '')}</text>
          </g>
        </g>
      ))}
    </g>
  )
}

/* ── Chave Secreta ─────────────────────────────────────────────────────────
 * Contínuo: três anéis de fechadura (encaixes, marcações de disco e segmentos)
 * girando em sentidos diferentes, cada um com um marcador.
 * Ativo: os marcadores se alinham no topo, o contorno de um cadeado é
 * desenhado em volta do personagem, a alça se abre e surge uma estrela.
 * `--from` é o ângulo inicial de cada anel (de onde ele volta ao alinhar).
 */
/** Cena da Chave Secreta. */
function CipherLock(): JSX.Element {
  // Ângulos das marcações do anel do meio (a cada 22,5°; as de 90° são maiores).
  const ticks = Array.from({ length: 16 }, (_, index) => index * 22.5)

  return (
    <>
      {/* Anel externo: três encaixes grandes e um marcador triangular */}
      <g className="cl-ring cl-ring--outer" style={{ '--from': '140deg' } as CSSProperties}>
        <circle cx={CX} cy={CY} r="76" pathLength={100} className="cl-ring__clamps" />
        <path className="cl-ring__marker" d={`M${CX - 5} ${CY - 86} H${CX + 5} L${CX} ${CY - 79} Z`} />
      </g>
      {/* Anel do meio: trilho fino com marcações de disco e um dente quadrado */}
      <g className="cl-ring cl-ring--middle" style={{ '--from': '-110deg' } as CSSProperties}>
        <circle cx={CX} cy={CY} r="62" className="cl-ring__track" />
        {ticks.map((angle) => (
          <line
            key={angle}
            className="cl-ring__tick"
            x1={CX}
            y1={CY - 58}
            x2={CX}
            y2={CY - (angle % 90 === 0 ? 52 : 55)}
            transform={`rotate(${angle} ${CX} ${CY})`}
          />
        ))}
        <rect className="cl-ring__marker" x={CX - 3.5} y={CY - 70} width="7" height="6" rx="1" />
      </g>
      {/* Anel interno: seis segmentos e um marcador redondo */}
      <g className="cl-ring cl-ring--inner" style={{ '--from': '75deg' } as CSSProperties}>
        <circle cx={CX} cy={CY} r="46" pathLength={120} className="cl-ring__segments" />
        <circle className="cl-ring__marker" cx={CX} cy={CY - 46} r="3.2" />
      </g>
      {/* Contorno do cadeado (alça + corpo), desenhado em volta do personagem no modo ativo */}
      <g className="cl-lock">
        <path className="cl-lock__shackle" d={`M${CX - 26} 84 V62 A26 26 0 0 1 ${CX + 26} 62 V84`} pathLength={1} />
        <rect className="cl-lock__body" x={CX - 42} y="84" width="84" height="66" rx="12" pathLength={1} />
      </g>
      {/* Estrela que aparece acima da cabeça quando o cadeado abre */}
      <path className="cl-reveal" d={`M${CX} 4 l2.2 5.8 l5.8 2.2 l-5.8 2.2 l-2.2 5.8 l-2.2 -5.8 l-5.8 -2.2 l5.8 -2.2 Z`} />
    </>
  )
}
