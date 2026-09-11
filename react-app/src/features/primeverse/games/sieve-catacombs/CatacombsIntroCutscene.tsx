import { useEffect, useRef, useState } from 'react'

import { introCutsceneFrame, type IntroCutsceneFrame } from './introCutscene'

const BOARD_NUMBERS = Array.from({ length: 24 }, (_, index) => index + 2)

/** Classmates seen from behind: hair, shirt, and how awake they still are. */
const STUDENTS = [
  { x: 470, y: 545, scale: 0.82, hair: '#2d2018', shirt: '#5c6d8e', pose: 'shift' },
  { x: 760, y: 540, scale: 0.8, hair: '#4a3320', shirt: '#7d5c6d', pose: 'write' },
  { x: 1050, y: 548, scale: 0.83, hair: '#191410', shirt: '#5c8e6d', pose: 'shift' },
  { x: 320, y: 660, scale: 1.08, hair: '#54402a', shirt: '#8e7d5c', pose: 'asleep' },
  { x: 1180, y: 668, scale: 1.12, hair: '#241b13', shirt: '#6d5c8e', pose: 'nod' },
] as const

/**
 * The classroom, drawn: a one-point-perspective SVG scene — windows pouring
 * afternoon light, a wall clock crawling, the teacher pacing at the board, five
 * classmates seen from behind in two rows — filmed by a camera that pushes in as
 * the lesson dissolves into sleep.
 */
export function CatacombsIntroCutscene({
  onFinish,
}: {
  readonly onFinish: () => void
}): JSX.Element {
  const [frame, setFrame] = useState<IntroCutsceneFrame>(() => introCutsceneFrame(0))
  const startedAt = useRef(performance.now())
  const done = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const next = introCutsceneFrame(performance.now() - startedAt.current)
      setFrame(next)
      if (next.finished && !done.current) {
        done.current = true
        onFinish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return
      if (done.current) return
      done.current = true
      onFinish()
    }
    window.addEventListener('keydown', skip)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', skip)
    }
  }, [onFinish])

  const { beat } = frame
  return (
    <section
      className={`scc-classroom scc-classroom--${beat.kind}`}
      style={{ '--lids': frame.eyelids, '--drift': frame.drift, '--droop': frame.headDroop } as React.CSSProperties}
      aria-label="Você adormece na aula de números primos"
    >
      {(beat.kind === 'drowsy' || beat.kind === 'black') && (
        <div className="scc-class-stage scc-class-stage--pov" data-shot={beat.id} aria-hidden="true">
          <svg className="scc-class-svg scc-class-svg--pov" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="pov-desk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d5133" />
                <stop offset="100%" stopColor="#46331e" />
              </linearGradient>
              <linearGradient id="pov-skin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a87e5f" />
                <stop offset="100%" stopColor="#8d6448" />
              </linearGradient>
              <radialGradient id="pov-vignette" cx="50%" cy="42%" r="75%">
                <stop offset="52%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(14, 10, 4, 0.6)" />
              </radialGradient>
            </defs>

            {/* The desk fills the view: you are looking straight down. */}
            <rect width="1600" height="900" fill="#5c4429" />
            <rect width="1600" height="900" fill="url(#pov-vignette)" opacity="0" />
            {[90, 380, 700, 1010, 1330].map((x) => (
              <line key={x} x1={x + 60} y1="0" x2={x} y2="900" stroke="#3f2e1a" strokeWidth="4" opacity="0.35" />
            ))}

            {/* The notebook, ruled and spiral-bound, carrying the primes so far. */}
            <g transform="translate(310 130) rotate(-2.5)">
              <rect width="880" height="620" rx="10" fill="#e6dfc6" />
              <rect width="880" height="620" rx="10" fill="none" stroke="#c8bf9f" strokeWidth="3" />
              <line x1="120" y1="0" x2="120" y2="620" stroke="#d77f6d" strokeWidth="3" opacity="0.7" />
              {[110, 180, 250, 320, 390, 460, 530].map((y) => (
                <line key={y} x1="30" y1={y} x2="850" y2={y} stroke="#b7cade" strokeWidth="2.4" opacity="0.8" />
              ))}
              {Array.from({ length: 12 }, (_, index) => (
                <circle key={index} cx="16" cy={40 + index * 50} r="9" fill="none" stroke="#8a8268" strokeWidth="4" />
              ))}
              <text x="150" y="96" fill="#3f3a2a" fontSize="40" fontFamily="Instrument Serif, Georgia, serif" fontStyle="italic" letterSpacing="10">2  3  5  7  11  13</text>
              <text x="150" y="166" fill="#3f3a2a" fontSize="40" fontFamily="Instrument Serif, Georgia, serif" fontStyle="italic" letterSpacing="10">17  19  23  29</text>
              {/* The line being written right now: neat, then trailing off. */}
              <path
                className="scc-pov-writing"
                d="M 150 236 q 12 -22 24 0 q 10 -26 22 -2 q 6 -18 20 -4 l 18 2 q 14 -24 26 0 q 12 -20 24 -2 l 22 4 q 16 -18 28 -2 q 20 8 44 6 q 40 14 90 22 q 70 16 130 34 q 60 20 110 44"
                fill="none" stroke="#4c4634" strokeWidth="4" strokeLinecap="round"
              />
            </g>

            {/* Left hand holding the page flat, breathing. */}
            <g className="scc-pov-left">
              <path d="M 240 640 q -90 30 -140 140 l 40 120 h 260 q 40 -80 10 -150 q -30 -70 -170 -110 z" fill="url(#pov-skin)" />
              {[0, 1, 2, 3].map((finger) => (
                <path
                  key={finger}
                  d={`M ${300 + finger * 42} 628 q 8 -34 26 -30 q 18 4 12 40 l -6 26 h -30 z`}
                  fill="url(#pov-skin)" stroke="#7a5539" strokeWidth="2"
                />
              ))}
              <path d="M 200 730 q -30 6 -44 26" fill="none" stroke="#7a5539" strokeWidth="3" opacity="0.6" />
            </g>

            {/* Right hand around the pencil — the one doing the work. */}
            <g className="scc-pov-hand">
              <path d="M 1010 610 q 120 -30 210 30 q 90 60 140 260 h -420 q -40 -140 10 -220 q 20 -40 60 -70 z" fill="url(#pov-skin)" />
              <path d="M 1015 640 q -40 -36 -18 -64 q 22 -22 48 6 l 30 34 q -20 26 -60 24 z" fill="url(#pov-skin)" stroke="#7a5539" strokeWidth="2" />
              {[0, 1, 2].map((finger) => (
                <path
                  key={finger}
                  d={`M ${1040 + finger * 40} ${600 + finger * 8} q -26 -40 -4 -58 q 24 -16 40 14 l 16 34 q -22 20 -52 10 z`}
                  fill="url(#pov-skin)" stroke="#7a5539" strokeWidth="2"
                />
              ))}
              <g transform="rotate(-38 1005 600)">
                <rect x="905" y="592" width="210" height="15" rx="7" fill="#caa04a" />
                <rect x="1098" y="592" width="14" height="15" fill="#8f8a76" />
                <polygon points="905,592 875,600 905,607" fill="#e8d9b0" />
                <polygon points="884,597.6 875,600 884,602.8" fill="#33291a" />
              </g>
              <path d="M 1120 700 q 30 20 36 60" fill="none" stroke="#7a5539" strokeWidth="3" opacity="0.5" />
            </g>

            <rect width="1600" height="900" fill="url(#pov-vignette)" />
          </svg>
        </div>
      )}

      {beat.kind === 'class' ? (
        <div className="scc-class-stage" data-shot={beat.id} aria-hidden="true">
          <svg className="scc-class-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="cls-wall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d6cdad" />
                <stop offset="70%" stopColor="#bfb28e" />
                <stop offset="100%" stopColor="#a08d68" />
              </linearGradient>
              <linearGradient id="cls-floor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7d6543" />
                <stop offset="100%" stopColor="#4a3a24" />
              </linearGradient>
              <linearGradient id="cls-light" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(244, 232, 180, 0.5)" />
                <stop offset="100%" stopColor="rgba(244, 232, 180, 0)" />
              </linearGradient>
              <linearGradient id="cls-window" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e9e0b4" />
                <stop offset="100%" stopColor="#c8b985" />
              </linearGradient>
              <radialGradient id="cls-vignette" cx="50%" cy="46%" r="72%">
                <stop offset="58%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(16, 12, 4, 0.55)" />
              </radialGradient>
            </defs>

            {/* Ceiling, back wall, floor: one-point perspective toward (800, 430). */}
            <polygon points="0,0 1600,0 1180,170 420,170" fill="#ded6b8" />
            <rect x="420" y="170" width="760" height="450" fill="url(#cls-wall)" />
            <polygon points="0,900 1600,900 1180,620 420,620" fill="url(#cls-floor)" />
            <polygon points="0,0 420,170 420,620 0,900" fill="#c3b691" />
            <polygon points="1600,0 1180,170 1180,620 1600,900" fill="#ab9c76" />
            {/* Floorboards converging on the vanishing point. */}
            {[140, 380, 640, 960, 1220, 1460].map((x) => (
              <line key={x} x1={x} y1="900" x2={800 + (x - 800) * 0.28} y2="620" stroke="#3a2d1a" strokeWidth="3" opacity="0.35" />
            ))}
            {/* Wainscot line on the back wall. */}
            <rect x="420" y="540" width="760" height="12" fill="#8a6f4d" />

            {/* Left wall: two windows and their shafts of light. */}
            {[
              { x: 60, w: 150, skew: 26 },
              { x: 260, w: 120, skew: 18 },
            ].map((win) => (
              <g key={win.x}>
                <polygon
                  points={`${win.x},${90 + win.skew} ${win.x + win.w},${120 + win.skew} ${win.x + win.w},${430 - win.skew * 0.4} ${win.x},${470 - win.skew * 0.4}`}
                  fill="url(#cls-window)" stroke="#5b4630" strokeWidth="10"
                />
                <line x1={win.x + win.w / 2} y1={105 + win.skew} x2={win.x + win.w / 2} y2={450 - win.skew * 0.4} stroke="#5b4630" strokeWidth="6" />
                <polygon
                  className="scc-cls-shaft"
                  points={`${win.x},${120 + win.skew} ${win.x + win.w},${140 + win.skew} ${win.x + win.w + 420},760 ${win.x + 180},860`}
                  fill="url(#cls-light)"
                />
              </g>
            ))}

            {/* Blackboard with the sieve — the numbers live in React state. */}
            <rect x="470" y="215" width="520" height="270" rx="6" fill="#503a25" />
            <rect x="482" y="227" width="496" height="246" rx="3" fill="#274e3d" />
            <text x="730" y="262" textAnchor="middle" fill="#e8e2c4" fontSize="26" fontFamily="Instrument Serif, Georgia, serif" letterSpacing="6">O CRIVO DE ERATÓSTENES</text>
            {BOARD_NUMBERS.map((value, index) => {
              const col = index % 8
              const row = Math.floor(index / 8)
              const x = 522 + col * 56
              const y = 308 + row * 52
              const crossed = frame.crossedNumbers.includes(value)
              return (
                <g key={value}>
                  <text x={x} y={y} textAnchor="middle" fill={crossed ? 'rgba(232, 226, 196, 0.35)' : '#e8e2c4'} fontSize="27" fontFamily="ui-monospace, Menlo, monospace">{value}</text>
                  {crossed && <line className="scc-cls-cross" x1={x - 16} y1={y - 9} x2={x + 16} y2={y - 5} stroke="#c96a5a" strokeWidth="4" strokeLinecap="round" />}
                </g>
              )
            })}
            <rect x="470" y="487" width="520" height="10" fill="#5b4630" />
            <rect x="900" y="480" width="34" height="7" rx="3" fill="#efe9cf" opacity="0.85" />

            {/* Clock: the minute crawls, the second sweeps. */}
            <g className="scc-cls-clock">
              <circle cx="1090" cy="255" r="30" fill="#efe8d2" stroke="#4a3a26" strokeWidth="5" />
              <line x1="1090" y1="255" x2="1090" y2="236" stroke="#33291a" strokeWidth="3.4" />
              <line x1="1090" y1="255" x2="1104" y2="262" stroke="#33291a" strokeWidth="2.6" />
              <line className="scc-cls-second" x1="1090" y1="258" x2="1090" y2="232" stroke="#b0523f" strokeWidth="1.6" />
            </g>

            {/* Door on the right wall — the one nobody uses to leave. */}
            <polygon points="1250,240 1370,270 1370,640 1250,660" fill="#6b4f33" stroke="#4a3520" strokeWidth="6" />
            <circle cx="1352" cy="470" r="7" fill="#caa04a" />

            {/* The teacher, pacing along the board with a working chalk arm. */}
            <g className="scc-cls-teacher">
              <g className="scc-cls-teacher-sway">
                <rect x="-26" y="112" width="22" height="98" rx="8" fill="#2c3329" />
                <rect x="6" y="112" width="22" height="98" rx="8" fill="#232a21" />
                <path d="M -38 18 Q 0 -6 38 18 L 44 118 Q 0 134 -44 118 Z" fill="#3a4436" />
                <path d="M -38 18 Q 0 2 38 18 L 34 52 Q 0 62 -34 52 Z" fill="#d8d2ba" />
                <g className="scc-cls-arm">
                  <rect x="24" y="22" width="64" height="15" rx="7" fill="#3a4436" />
                  <circle cx="94" cy="29" r="9" fill="#8a6650" />
                  <rect x="100" y="25" width="16" height="5" rx="2" fill="#efe9cf" />
                </g>
                <g className="scc-cls-head">
                  <circle cx="0" cy="-16" r="26" fill="#8a6650" />
                  <path d="M -26 -22 Q -18 -46 6 -42 Q 28 -40 26 -20 Q 12 -34 -8 -32 Q -20 -30 -26 -22 Z" fill="#3d322a" />
                  <rect x="-16" y="-22" width="14" height="10" rx="4" fill="none" stroke="#2b2118" strokeWidth="2.4" />
                  <rect x="4" y="-22" width="14" height="10" rx="4" fill="none" stroke="#2b2118" strokeWidth="2.4" />
                  <line x1="-2" y1="-18" x2="4" y2="-18" stroke="#2b2118" strokeWidth="2.4" />
                </g>
              </g>
            </g>

            {/* Classmates from behind: chair, shoulders, hair. None sit still. */}
            {STUDENTS.map((student) => (
              <g key={`${student.x}`} transform={`translate(${student.x} ${student.y}) scale(${student.scale})`}>
                <rect x="-64" y="64" width="128" height="18" rx="4" fill="#58432c" />
                <rect x="-58" y="82" width="10" height="66" fill="#3a2d1c" />
                <rect x="48" y="82" width="10" height="66" fill="#3a2d1c" />
                <rect x="-42" y="6" width="84" height="64" rx="14" fill={student.shirt} />
                <rect x="-46" y="52" width="92" height="22" rx="8" fill="#2c2a30" opacity="0.55" />
                <g className={`scc-cls-student scc-cls-student--${student.pose}`}>
                  <circle cx="0" cy="-16" r="26" fill="#9a7358" />
                  <path d="M -26 -18 Q -26 -46 0 -46 Q 26 -46 26 -18 Q 14 -30 0 -30 Q -14 -30 -26 -18 Z" fill={student.hair} />
                </g>
              </g>
            ))}

            {/* Your own desk, bottom of frame: notebook, pencil, drool-warm wood. */}
            <polygon points="180,900 1420,900 1240,730 360,730" fill="#63492f" />
            <polygon points="180,900 360,730 380,730 210,900" fill="#7a5c3a" />
            <g transform="translate(560 780) rotate(-3)">
              <rect width="300" height="96" rx="4" fill="#ded7bd" />
              <line x1="150" y1="6" x2="150" y2="90" stroke="#b8ae8e" strokeWidth="2" />
              <text x="26" y="40" fill="#4c4634" fontSize="24" fontFamily="Instrument Serif, Georgia, serif" fontStyle="italic" letterSpacing="4">2 3 5 7 11 13</text>
              <text x="26" y="72" fill="#8a806a" fontSize="20" fontFamily="Instrument Serif, Georgia, serif" fontStyle="italic" letterSpacing="4">17 19 23 29 …</text>
            </g>
            <g className="scc-cls-pencil" transform="translate(950 820) rotate(8)">
              <rect width="120" height="9" rx="4" fill="#caa04a" />
              <polygon points="120,0 138,4.5 120,9" fill="#e8d9b0" />
              <polygon points="132,2.2 138,4.5 132,6.8" fill="#33291a" />
              <rect x="-10" width="12" height="9" rx="3" fill="#c96a5a" />
            </g>

            <rect x="0" y="0" width="1600" height="900" fill="url(#cls-vignette)" />
          </svg>
        </div>
      ) : (
        <div className="scc-classroom__elevator" aria-hidden="true">
          <b>S2</b>
          <span>SUBSOLO — ANDAR NÃO CADASTRADO</span>
        </div>
      )}

      {beat.line && <p className="scc-classroom__line" key={beat.id}>{beat.line}</p>}

      <span className="scc-classroom__lid scc-classroom__lid--top" aria-hidden="true" />
      <span className="scc-classroom__lid scc-classroom__lid--bottom" aria-hidden="true" />

      <button
        type="button"
        className="scc-classroom__skip"
        onClick={() => {
          if (done.current) return
          done.current = true
          onFinish()
        }}
      >
        PULAR · ESC
      </button>
    </section>
  )
}

export default CatacombsIntroCutscene
