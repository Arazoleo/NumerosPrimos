import { useEffect, useRef } from 'react'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import About from './components/About'
import Sieve from './components/Sieve'
import Ulam from './components/Ulam'
import FibSpiral from './components/FibSpiral'
import Caesar from './components/Caesar'
import FrequencyAnalysis from './components/FrequencyAnalysis'
import ModClock from './components/ModClock'
import CryptoDemo from './components/CryptoDemo'
import RsaGame from './components/RsaGame'
import Mission from './components/Mission'
import TeamCarousel from './components/TeamCarousel'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'

export default function App() {
  const glowRef = useRef(null)

  useEffect(() => {
    const el = glowRef.current
    if (!el) return
    let mx = -999, my = -999, gx = mx, gy = my, raf
    const onMove = (e) => { mx = e.clientX; my = e.clientY }
    window.addEventListener('pointermove', onMove)
    const tick = () => {
      gx += (mx - gx) * 0.12
      gy += (my - gy) * 0.12
      el.style.left = gx + 'px'
      el.style.top = gy + 'px'
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <>
      <div className="cursor-glow" ref={glowRef} />
      <Nav />
      <Hero />
      <Marquee />
      <About />
      <Sieve />
      <Ulam />
      <FibSpiral />
      <Caesar />
      <FrequencyAnalysis />
      <ModClock />
      <CryptoDemo />
      <RsaGame />
      <Mission />
      <TeamCarousel />
      <FinalCTA />
      <Footer />
    </>
  )
}
