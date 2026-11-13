/**
 * Arte dos personagens da personalização do Primeverse Online.
 *
 * - `CharacterFigure`: personagem de corpo inteiro exibido na prévia.
 * - `CharacterIcon`: ícone pequeno usado nos botões de escolha.
 *
 * Os dois usam a mesma silhueta de cada personagem, então o botão e a prévia
 * sempre representam o mesmo explorador. Todos compartilham a mesma base
 * (capacete redondo, viseira, tronco, braços, pernas e botas) e se diferenciam
 * pelos acessórios:
 *   Primo  → antena, mochila de oxigênio e núcleo no peito (azul)
 *   Lúmina → capuz, casaco e lupa (roxo)
 *   Zeta   → crista, faixa ao vento, traje leve e tênis (verde)
 *   Orion  → capacete quadrado, ombreiras e cadeado pequeno (dourado)
 *
 * As cores vêm de variáveis CSS do container (ver character-customization.css):
 * --body (traje), --accent (brilho da energia), --visor e --char (cor-assinatura).
 */

import { useId } from 'react'
import type { CharacterModel } from '../shared/protocol'

/** Props comuns às duas versões da arte: só o id do personagem. */
interface CharacterArtProps {
  readonly id: CharacterModel
}

/** Personagem de corpo inteiro usado na prévia principal (viewBox 80 × 140). */
export function CharacterFigure({ id }: CharacterArtProps): JSX.Element {
  // Ids únicos para o gradiente e o filtro, evitando colisão se houver mais de uma figura na página.
  const uid = useId().replace(/:/g, '')
  const shade = `pvo-fig-shade-${uid}`
  const glow = `pvo-fig-glow-${uid}`

  return (
    <svg className="pvo-fig" viewBox="0 0 80 140" aria-hidden="true">
      <defs>
        {/* Iluminação comum: luz clara no topo e sombra suave embaixo */}
        <linearGradient id={shade} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#061020" stopOpacity="0.38" />
        </linearGradient>
        {/* Brilho neon usado na viseira, núcleo, lupa e cadeado */}
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Cada personagem desenha suas próprias peças sobre a base compartilhada */}
      {id === 'primo' && <PrimoFigure shade={shade} glow={glow} />}
      {id === 'cipher' && <CipherFigure shade={shade} glow={glow} />}
      {id === 'nexo' && <NexoFigure shade={shade} glow={glow} />}
      {id === 'crypton' && <CryptonFigure shade={shade} glow={glow} />}
    </svg>
  )
}

/** Ids do gradiente de iluminação (`shade`) e do filtro de brilho (`glow`). */
interface FigureProps {
  readonly shade: string
  readonly glow: string
}

/*
 * Peças compartilhadas
 * A ordem dos elementos define a profundidade: o que vem primeiro fica atrás
 * (mochila, capuz, pernas, braços), depois tronco e, por último, a cabeça.
 * Coordenadas no viewBox 80 × 140: cabeça por volta de y 28, tronco 47–83,
 * pernas 80–114 e botas até ~121. O centro horizontal é x = 40.
 */

/** Desenha uma forma na cor do traje e repete por cima com o gradiente de iluminação. */
function Suit({ shade, children }: { readonly shade: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <>
      <g className="pvo-fig__suit">{children}</g>
      <g fill={`url(#${shade})`} stroke="none">{children}</g>
    </>
  )
}

/** Viseira: moldura escura, vidro luminoso e um pequeno reflexo branco. */
function Visor({ x, y, w, h, glow }: { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly glow: string }): JSX.Element {
  const r = h / 2
  return (
    <>
      <rect className="pvo-fig__dark" x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} rx={r + 1.5} />
      <rect className="pvo-fig__visor" x={x} y={y} width={w} height={h} rx={r} filter={`url(#${glow})`} />
      <rect x={x + 2.5} y={y + 1.6} width={w * 0.3} height={Math.max(1.6, h * 0.22)} rx="1" fill="#fff" opacity="0.7" />
    </>
  )
}

/** Pernas e botas; `stride` inclina as pernas para uma pose mais dinâmica (Zeta). */
function Legs({ shade, stride = 0, bootClass = 'pvo-fig__dark' }: { readonly shade: string; readonly stride?: number; readonly bootClass?: string }): JSX.Element {
  return (
    <>
      <g transform={`rotate(${stride} 33.5 82)`}>
        <Suit shade={shade}><rect x="29" y="80" width="9" height="34" rx="4.5" /></Suit>
        <rect className={bootClass} x="26.5" y="111" width="13" height="10" rx="4" />
      </g>
      <g transform={`rotate(${-stride} 46.5 82)`}>
        <Suit shade={shade}><rect x="42" y="80" width="9" height="34" rx="4.5" /></Suit>
        <rect className={bootClass} x="40.5" y="111" width="13" height="10" rx="4" />
      </g>
    </>
  )
}

/** Braço (cápsula + punho colorido + luva) girado em torno do ombro. */
function Arm({ shade, side, angle }: { readonly shade: string; readonly side: 'left' | 'right'; readonly angle: number }): JSX.Element {
  const x = side === 'left' ? 17 : 54
  const pivotX = x + 4.5
  return (
    <g transform={`rotate(${angle} ${pivotX} 53)`}>
      <Suit shade={shade}><rect x={x} y="50" width="9" height="30" rx="4.5" /></Suit>
      <rect className="pvo-fig__char" x={x} y="72" width="9" height="3" rx="1.5" />
      <circle className="pvo-fig__dark" cx={pivotX} cy="81" r="5.2" />
    </g>
  )
}

/** Primo — astronauta: antena luminosa, mochila de oxigênio e núcleo no peito. */
function PrimoFigure({ shade, glow }: FigureProps): JSX.Element {
  return (
    <>
      {/* Mochila de oxigênio (aparece nas laterais do tronco) */}
      <rect className="pvo-fig__dark" x="21" y="50" width="38" height="28" rx="8" />
      {/* Pernas com faixas luminosas nos joelhos */}
      <Legs shade={shade} />
      <rect className="pvo-fig__char pvo-fig__soft" x="29" y="96" width="9" height="3" rx="1.5" />
      <rect className="pvo-fig__char pvo-fig__soft" x="42" y="96" width="9" height="3" rx="1.5" />
      {/* Braços levemente abertos, pose equilibrada */}
      <Arm shade={shade} side="left" angle={9} />
      <Arm shade={shade} side="right" angle={-9} />
      {/* Tronco, cinto e núcleo de energia no peito */}
      <Suit shade={shade}><rect x="25" y="47" width="30" height="36" rx="11" /></Suit>
      <rect className="pvo-fig__dark" x="26" y="76" width="28" height="5" rx="2.5" />
      <circle className="pvo-fig__ring" cx="40" cy="61" r="7" />
      <circle className="pvo-fig__core" cx="40" cy="61" r="4" filter={`url(#${glow})`} />
      {/* Gola do traje */}
      <rect className="pvo-fig__dark" x="32" y="42" width="16" height="7" rx="3.5" />
      {/* Antena com ponta luminosa */}
      <rect className="pvo-fig__char" x="39" y="5" width="2" height="9" rx="1" />
      <circle className="pvo-fig__char" cx="40" cy="5" r="2.6" filter={`url(#${glow})`} />
      {/* Capacete redondo com luzes laterais e viseira larga */}
      <Suit shade={shade}><circle cx="40" cy="28" r="17" /></Suit>
      <circle className="pvo-fig__char" cx="23" cy="29" r="3" />
      <circle className="pvo-fig__char" cx="57" cy="29" r="3" />
      <Visor x={27.5} y={21} w={25} h={13} glow={glow} />
    </>
  )
}

/** Cipher — decifradora: capuz, casaco de exploradora, símbolo { } e lupa erguida. */
function CipherFigure({ shade, glow }: FigureProps): JSX.Element {
  return (
    <>
      {/* Capuz que emoldura o capacete */}
      <path className="pvo-fig__char-deep" d="M20 34 C18 16 28 8 40 8 C52 8 62 16 60 34 L56 46 L24 46 Z" />
      {/* Pernas e braço esquerdo relaxado (o direito vem depois, à frente do tronco) */}
      <Legs shade={shade} />
      <Arm shade={shade} side="left" angle={8} />
      {/* Casaco de exploradora (abas abaixo do cinto) */}
      <path className="pvo-fig__char-deep" d="M26 72 L21 94 Q30 97 37 93 L40 84 L43 93 Q50 97 59 94 L54 72 Z" />
      {/* Tronco com gola em V, cinto com fivela e o símbolo de código { } */}
      <Suit shade={shade}><rect x="25" y="47" width="30" height="35" rx="11" /></Suit>
      <path className="pvo-fig__char" d="M33 47 L40 58 L47 47 Z" />
      <rect className="pvo-fig__dark" x="26" y="74" width="28" height="5" rx="2.5" />
      <rect className="pvo-fig__char" x="37.5" y="74.5" width="5" height="4" rx="1" />
      <text className="pvo-fig__code" x="40" y="69" textAnchor="middle">{'{ }'}</text>
      {/* Braço direito erguido segurando a lupa */}
      <g transform="rotate(-38 58.5 53)">
        <Suit shade={shade}><rect x="54" y="50" width="9" height="28" rx="4.5" /></Suit>
        <rect className="pvo-fig__char" x="54" y="70" width="9" height="3" rx="1.5" />
        <circle className="pvo-fig__dark" cx="58.5" cy="79" r="5.2" />
      </g>
      {/* Lupa: cabo, lente translúcida e reflexo */}
      <path className="pvo-fig__handle" d="M74 71 L72.6 62" />
      <circle className="pvo-fig__lens" cx="72" cy="55" r="7.5" filter={`url(#${glow})`} />
      <circle cx="69.5" cy="52.5" r="2" fill="#fff" opacity="0.6" />
      {/* Gola, capacete, aba do capuz sobre a testa, viseira e gema no topo */}
      <rect className="pvo-fig__dark" x="32" y="42" width="16" height="7" rx="3.5" />
      <Suit shade={shade}><circle cx="40" cy="29" r="16" /></Suit>
      <path className="pvo-fig__char-deep" d="M24.5 25 Q28 13 40 13 Q52 13 55.5 25 Q47 19 40 19 Q33 19 24.5 25 Z" />
      <Visor x={28.5} y={24} w={23} h={11} glow={glow} />
      <circle className="pvo-fig__char" cx="40" cy="12" r="2.2" filter={`url(#${glow})`} />
    </>
  )
}

/** Nexo — aventureiro esportivo: crista, faixa ao vento, traje leve e tênis verdes. */
function NexoFigure({ shade, glow }: FigureProps): JSX.Element {
  return (
    <>
      {/* Pontas da faixa da testa balançando atrás da cabeça */}
      <path className="pvo-fig__char-line" d="M25 23 Q15 18 6 22" />
      <path className="pvo-fig__char-line" d="M25 26 Q16 26 9 31" />
      {/* Pernas em passada, tênis verdes com sola escura e joelheiras */}
      <Legs shade={shade} stride={7} bootClass="pvo-fig__char" />
      <rect className="pvo-fig__dark" x="25.5" y="117" width="14" height="4" rx="2" transform="rotate(7 33.5 82)" />
      <rect className="pvo-fig__dark" x="40" y="117" width="14" height="4" rx="2" transform="rotate(-7 46.5 82)" />
      <circle className="pvo-fig__char pvo-fig__soft" cx="33.5" cy="97" r="3" transform="rotate(7 33.5 82)" />
      <circle className="pvo-fig__char pvo-fig__soft" cx="46.5" cy="97" r="3" transform="rotate(-7 46.5 82)" />
      {/* Braços balançando em movimento (ângulos diferentes = pose de corrida) */}
      <Arm shade={shade} side="left" angle={16} />
      <Arm shade={shade} side="right" angle={-30} />
      {/* Traje leve com faixa diagonal e bolsinha no cinto */}
      <Suit shade={shade}><rect x="26.5" y="48" width="27" height="34" rx="10" /></Suit>
      <path className="pvo-fig__char" d="M28 58 L34 50 L52 70 L50 78 Z" opacity="0.9" />
      <rect className="pvo-fig__dark" x="27" y="75" width="26" height="5" rx="2.5" />
      <rect className="pvo-fig__char" x="44" y="73" width="7" height="8" rx="2" />
      {/* Gola e capacete esportivo, um pouco menor que o dos outros */}
      <rect className="pvo-fig__dark" x="33" y="43" width="14" height="7" rx="3.5" />
      <Suit shade={shade}><circle cx="40" cy="29" r="15.5" /></Suit>
      {/* Crista no capacete e faixa da testa */}
      <path className="pvo-fig__char" d="M34 15 Q40 3 51 8 L46 16 Z" />
      <rect className="pvo-fig__char" x="24.5" y="19" width="31" height="4" rx="2" />
      <Visor x={29} y={25} w={22} h={10} glow={glow} />
    </>
  )
}

/** Crypton — guardião: capacete quadrado, ombreiras e um cadeado pequeno no peito. */
function CryptonFigure({ shade, glow }: FigureProps): JSX.Element {
  return (
    <>
      {/* Pernas com detalhe dourado no topo das botas */}
      <Legs shade={shade} />
      <rect className="pvo-fig__char pvo-fig__soft" x="26.5" y="111" width="13" height="2.5" rx="1.2" />
      <rect className="pvo-fig__char pvo-fig__soft" x="40.5" y="111" width="13" height="2.5" rx="1.2" />
      {/* Braços quase retos: postura firme de guardião */}
      <Arm shade={shade} side="left" angle={7} />
      <Arm shade={shade} side="right" angle={-7} />
      {/* Tronco mais largo que o dos outros personagens */}
      <Suit shade={shade}><rect x="24" y="47" width="32" height="36" rx="10" /></Suit>
      {/* Ombreiras com detalhe dourado */}
      <rect className="pvo-fig__dark" x="15" y="46" width="15" height="10" rx="5" />
      <rect className="pvo-fig__dark" x="50" y="46" width="15" height="10" rx="5" />
      <rect className="pvo-fig__char" x="17" y="48" width="11" height="2.4" rx="1.2" />
      <rect className="pvo-fig__char" x="52" y="48" width="11" height="2.4" rx="1.2" />
      {/* Cinto */}
      <rect className="pvo-fig__dark" x="25" y="76" width="30" height="5" rx="2.5" />
      {/* Cadeado pequeno no peito: alça, corpo e fechadura */}
      <path className="pvo-fig__char-line pvo-fig__thin" d="M37.3 61 V58.6 A2.7 2.7 0 0 1 42.7 58.6 V61" />
      <rect className="pvo-fig__lock" x="35.5" y="60.5" width="9" height="8" rx="1.8" filter={`url(#${glow})`} />
      <circle className="pvo-fig__dark" cx="40" cy="63.6" r="1.2" />
      <rect className="pvo-fig__dark" x="39.4" y="64" width="1.2" height="2.6" rx="0.5" />
      {/* Fivela, gola e capacete quadrado com crista e viseira estreita */}
      <rect className="pvo-fig__char" x="37" y="77" width="6" height="3" rx="1" />
      <rect className="pvo-fig__dark" x="32" y="42" width="16" height="7" rx="3.5" />
      <Suit shade={shade}><rect x="23.5" y="12" width="33" height="32" rx="12" /></Suit>
      <rect className="pvo-fig__char" x="38" y="8" width="4" height="9" rx="2" />
      <Visor x={28} y={24} w={24} h={8} glow={glow} />
    </>
  )
}

/**
 * Ícone pequeno dos botões de escolha (viewBox 48 × 48), na cor --char-accent.
 * Mostra cabeça + tronco com o acessório principal de cada personagem.
 */
export function CharacterIcon({ id }: CharacterArtProps): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="pvo-char-icon" aria-hidden="true">
      {/* Primo: capacete com viseira e núcleo "P" (mantido como referência) */}
      {id === 'primo' && (
        <>
          <circle cx="24" cy="18" r="11" fill="var(--char-accent)" opacity="0.2" />
          <circle cx="24" cy="18" r="9" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <ellipse cx="24" cy="17" rx="6" ry="2.5" fill="var(--char-accent)" />
          <rect x="18" y="26" width="12" height="14" rx="2" fill="var(--char-accent)" opacity="0.3" />
          <rect x="19" y="27" width="10" height="12" rx="1.5" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <circle cx="24" cy="33" r="2.5" fill="var(--char-accent)" />
          <text x="24" y="35" fontSize="6" fontWeight="bold" fill="var(--char-accent)" textAnchor="middle">P</text>
        </>
      )}
      {/* Cipher: capuz, casaco com gola e lupa */}
      {id === 'cipher' && (
        <>
          <path d="M13.5 23 C12.5 12 18 6.5 24 6.5 C30 6.5 35.5 12 34.5 23 L32.5 27 H15.5 Z" fill="var(--char-accent)" opacity="0.2" />
          <circle cx="24" cy="18" r="8" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <path d="M16.5 15.5 Q19 10.5 24 10.5 Q29 10.5 31.5 15.5" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="24" cy="19" rx="5" ry="2.2" fill="var(--char-accent)" />
          <path d="M18.5 26 H29.5 L31.5 40 H16.5 Z" fill="var(--char-accent)" opacity="0.3" />
          <path d="M19.5 27 H28.5 L30.3 39 H17.7 Z" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M21.5 27 L24 31 L26.5 27" fill="none" stroke="var(--char-accent)" strokeWidth="1.2" strokeLinejoin="round" />
          <line x1="30.5" y1="35" x2="33.6" y2="31.6" stroke="var(--char-accent)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="36.5" cy="28.5" r="4.2" fill="var(--char-accent)" fillOpacity="0.2" stroke="var(--char-accent)" strokeWidth="1.5" />
          <circle cx="35.4" cy="27.4" r="1.1" fill="var(--char-accent)" />
        </>
      )}
      {/* Nexo: pontas da faixa ao vento, crista, faixa diagonal e linhas de velocidade */}
      {id === 'nexo' && (
        <>
          <path d="M14.5 15 Q10 12.5 5.5 14.5" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M14.5 17.5 Q10 18 7 21" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="24" cy="18" r="10" fill="var(--char-accent)" opacity="0.2" />
          <circle cx="24" cy="18" r="8.5" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <path d="M20.5 10.5 Q24 5 30 7.5 L27.5 11 Z" fill="var(--char-accent)" />
          <line x1="15.8" y1="14.5" x2="32.2" y2="14.5" stroke="var(--char-accent)" strokeWidth="1.5" />
          <ellipse cx="24" cy="19" rx="5.5" ry="2.2" fill="var(--char-accent)" />
          <rect x="18.5" y="27" width="11" height="13" rx="3" fill="var(--char-accent)" opacity="0.3" />
          <rect x="19" y="27.5" width="10" height="12" rx="2.5" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <line x1="20" y1="30" x2="28" y2="38" stroke="var(--char-accent)" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="31" x2="13" y2="31" stroke="var(--char-accent)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="10" y1="35" x2="14" y2="35" stroke="var(--char-accent)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </>
      )}
      {/* Crypton: capacete quadrado, ombreiras e cadeado pequeno */}
      {id === 'crypton' && (
        <>
          <rect x="23" y="5.5" width="2" height="4" rx="1" fill="var(--char-accent)" />
          <rect x="14" y="8" width="20" height="19" rx="7" fill="var(--char-accent)" opacity="0.2" />
          <rect x="15.5" y="9.5" width="17" height="16" rx="6" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <rect x="18.5" y="16.5" width="11" height="3" rx="1.5" fill="var(--char-accent)" />
          <rect x="18" y="27" width="12" height="13" rx="2.5" fill="var(--char-accent)" opacity="0.3" />
          <rect x="19" y="28" width="10" height="11" rx="2" fill="none" stroke="var(--char-accent)" strokeWidth="1.5" />
          <rect x="13" y="26.5" width="7" height="4.5" rx="2.2" fill="var(--char-accent)" opacity="0.6" />
          <rect x="28" y="26.5" width="7" height="4.5" rx="2.2" fill="var(--char-accent)" opacity="0.6" />
          <path d="M22.9 33 V32 A1.1 1.1 0 0 1 25.1 32 V33" fill="none" stroke="var(--char-accent)" strokeWidth="1" />
          <rect x="22" y="33" width="4" height="3.4" rx="0.7" fill="var(--char-accent)" />
        </>
      )}
    </svg>
  )
}
