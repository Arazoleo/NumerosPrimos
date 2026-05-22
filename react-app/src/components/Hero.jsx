import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, animate } from 'framer-motion'
import { primes } from '../data/members'
import './Hero.css'

function Counter({ to }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  useEffect(() => {
    let controls
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          controls = animate(0, to, {
            duration: 1.6,
            ease: [0.2, 0.7, 0.2, 1],
            onUpdate: (v) => setValue(Math.floor(v)),
          })
          obs.disconnect()
        }
      })
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => { obs.disconnect(); controls?.stop?.() }
  }, [to])
  return <span ref={ref}>{value.toLocaleString('pt-BR')}</span>
}

export default function Hero() {
  const visualRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const isCoarse = typeof window !== 'undefined'
    && window.matchMedia?.('(max-width: 720px)').matches
  const floaterCount = isCoarse ? 12 : 28

  const floaters = useMemo(() => Array.from({ length: floaterCount }).map((_, i) => ({
    n: primes[Math.floor(Math.random() * primes.length)],
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 16 + Math.random() * 42,
    dur: 8 + Math.random() * 10,
    delay: -Math.random() * 10,
    opacity: 0.04 + Math.random() * 0.10,
  })), [floaterCount])

  const onMove = (e) => {
    if (!visualRef.current) return
    const r = visualRef.current.getBoundingClientRect()
    setTilt({
      x: (e.clientX - r.left) / r.width - 0.5,
      y: (e.clientY - r.top) / r.height - 0.5,
    })
  }
  const reset = () => setTilt({ x: 0, y: 0 })

  return (
    <header className="hero">
      <div className="grid-bg" />
      <div className="floating-primes">
        {floaters.map((f, i) => (
          <span key={i} style={{
            left: f.left + '%', top: f.top + '%',
            fontSize: f.size + 'px',
            animationDuration: f.dur + 's',
            animationDelay: f.delay + 's',
            opacity: f.opacity,
          }}>{f.n}</span>
        ))}
      </div>

      <div className="container hero-inner">
        <div>
          <motion.h1 className="h1"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{ marginTop: 0 }}>
            Onde a <span className="underline yellow">matemática</span><br />
            encontra a <span className="yellow">criptografia</span>.
          </motion.h1>

          <motion.p className="hero-sub"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}>
            Uma jornada pelos <strong>números primos</strong>, os tijolos invisíveis que
            protegem suas mensagens, suas senhas e a internet inteira. Aqui a gente desvenda o segredo.
          </motion.p>

          <motion.div className="hero-cta"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}>
            <a href="#sobre" className="btn btn-primary">Explorar o projeto <span className="arrow">→</span></a>
            <a href="#equipe" className="btn btn-ghost">Quem somos ?</a>
          </motion.div>

          <motion.div className="hero-stats"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}>
            <div className="stat"><div className="num"><Counter to={10} /></div><div className="lbl">Membros</div></div>
            <div className="stat"><div className="num"><Counter to={2048} /></div><div className="lbl">Bits / chave</div></div>
            <div className="stat"><div className="num">∞</div><div className="lbl">Primos</div></div>
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          ref={visualRef}
          onPointerMove={onMove}
          onPointerLeave={reset}
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.7, 0.2, 1] }}>
          <motion.div className="hero-card" style={{
            transform: `rotate(${-1.5 + tilt.x * 4}deg) translateY(${tilt.y * -8}px)`
          }}>
            <svg className="lock-svg" viewBox="0 0 200 240" aria-hidden="true">
              <motion.path className="lock-shackle"
                d="M55 110 V70 a45 45 0 0 1 90 0 V110"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: 1.1 }} />
              <motion.rect className="lock-body"
                x="35" y="110" width="130" height="115" rx="18"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, delay: 0.4 }} />
              <motion.circle className="keyhole" cx="100" cy="160" r="10"
                initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 2 }} />
              <motion.rect className="keyhole" x="95" y="160" width="10" height="28" rx="4"
                initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 2.1 }} />
            </svg>
          </motion.div>

          <div className="orbit-primes">
            {[23, 7, 101, 13, 89].map((p, i) => (
              <motion.span key={p}
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.5 + i * 0.1 }}>{p}</motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </header>
  )
}
