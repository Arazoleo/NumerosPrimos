import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { members } from '../data/members'
import './TeamCarousel.css'

const AUTOPLAY_MS = 4000

const StarIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.92 6.55 7.08.62-5.34 4.72L18.18 21.5 12 17.6 5.82 21.5l1.52-7.11L2 9.67l7.08-.62L12 2.5z" />
  </svg>
)

export default function TeamCarousel() {
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)
  const total = members.length
  const containerRef = useRef(null)

  const next = useCallback(() => {
    setDirection(1)
    setActive(i => (i + 1) % total)
  }, [total])
  const prev = useCallback(() => {
    setDirection(-1)
    setActive(i => (i - 1 + total) % total)
  }, [total])
  const goTo = useCallback((idx) => {
    setDirection(idx > active ? 1 : -1)
    setActive(idx)
  }, [active])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, next])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const offsetOf = (i) => {
    let off = i - active
    if (off > total / 2) off -= total
    if (off < -total / 2) off += total
    return off
  }

  const styleForOffset = (off) => {
    const abs = Math.abs(off)
    if (abs > 2) return { x: 0, scale: 0.5, opacity: 0, zIndex: 0, blur: 12, pointerEvents: 'none' }
    const sign = Math.sign(off)
    const positions = {
      0: { x: 0,    scale: 1,    opacity: 1,    z: 10, blur: 0 },
      1: { x: 270,  scale: 0.78, opacity: 0.75, z: 8,  blur: 1 },
      2: { x: 480,  scale: 0.6,  opacity: 0.35, z: 6,  blur: 3 },
    }
    const p = positions[abs]
    return {
      x: p.x * sign,
      scale: p.scale,
      opacity: p.opacity,
      zIndex: p.z,
      blur: p.blur,
      pointerEvents: 'auto',
    }
  }

  const activeMember = members[active]

  return (
    <section id="equipe" className="team-section">
      <div className="container">
        <motion.div className="section-head"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}>
          <span className="kicker">// equipe</span>
          <h2 className="h2">As mentes <em>por trás dos primos</em>.</h2>
          <p className="section-sub">Um time apaixonado por matemática, código e curiosidade. O destaque alterna automaticamente, clique nos cards laterais ou use as setas.</p>
        </motion.div>

        <div
          className="carousel"
          ref={containerRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="carousel-stage">
            {members.map((m, i) => {
              const off = offsetOf(i)
              const s = styleForOffset(off)
              const isActive = off === 0
              return (
                <motion.button
                  key={m.file}
                  className={`car-card ${isActive ? 'active' : ''} ${m.isCoord ? 'coord' : ''}`}
                  animate={{
                    x: s.x,
                    scale: s.scale,
                    opacity: s.opacity,
                    filter: `blur(${s.blur}px)`,
                  }}
                  style={{ zIndex: s.zIndex, pointerEvents: s.pointerEvents }}
                  transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.9 }}
                  onClick={() => goTo(i)}
                  aria-label={`Selecionar ${m.name}`}
                  whileHover={isActive ? {} : { scale: s.scale * 1.04 }}
                >
                  <div className="car-img-wrap">
                    <img src={`/assets/${m.file}.jpg`} alt={m.name} draggable="false" />
                    {m.isCoord && (
                      <div className="car-badge coord">
                        <StarIcon size={11} /> Coordenadora
                      </div>
                    )}
                    {!m.isCoord && <div className="car-badge">#{m.prime}</div>}
                  </div>
                </motion.button>
              )
            })}
          </div>

          <div className="carousel-info">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeMember.file}
                custom={direction}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                className="info-block"
              >
                <div className="info-meta">
                  <span className="info-prime">p<sub>{active + 1}</sub> = {activeMember.prime}</span>
                  <span className={`info-role ${activeMember.isCoord ? 'coord' : ''}`}>
                    {activeMember.isCoord && <span className="star"><StarIcon size={12} /></span>}
                    {activeMember.role}
                  </span>
                </div>
                <h3 className="info-name">{activeMember.name}</h3>
                <p className="info-bio">{activeMember.bio}</p>
              </motion.div>
            </AnimatePresence>

            <div className="carousel-controls">
              <button className="ctrl" onClick={prev} aria-label="Anterior">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div className="dots">
                {members.map((_, i) => (
                  <button
                    key={i}
                    className={`dot ${i === active ? 'on' : ''}`}
                    onClick={() => goTo(i)}
                    aria-label={`Ir para ${members[i].name}`}
                  >
                    {i === active && !paused && (
                      <motion.span
                        key={`bar-${i}-${active}-${paused}`}
                        className="dot-bar"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <button className="ctrl" onClick={next} aria-label="Próximo">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
