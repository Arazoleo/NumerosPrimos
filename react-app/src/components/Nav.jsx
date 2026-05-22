import { useEffect, useState } from 'react'
import './Nav.css'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#" className="brand">
          <img src="/assets/logo.jpg" alt="Logo" className="brand-logo" />
          <span className="brand-text">Números <span>Primos</span></span>
        </a>
        <div className="nav-links">
          <a href="#sobre">Sobre</a>
          <a href="#como">Como funciona</a>
          <a href="#equipe">Equipe</a>
          <a href="#contato" className="nav-cta">Saber mais →</a>
        </div>
      </div>
    </nav>
  )
}
