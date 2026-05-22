import { useEffect, useState } from 'react'
import './Nav.css'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const close = () => setOpen(false)

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''} ${open ? 'open' : ''}`}>
      <div className="container nav-inner">
        <a href="#" className="brand" onClick={close}>
          <img src="/assets/logo.jpg" alt="Logo" className="brand-logo" />
          <span className="brand-text">Números <span>Primos</span></span>
        </a>
        <div className="nav-links">
          <a href="#sobre" onClick={close}>Sobre</a>
          <a href="#como" onClick={close}>Como funciona</a>
          <a href="#equipe" onClick={close}>Equipe</a>
          <a href="#contato" className="nav-cta" onClick={close}>Saber mais →</a>
        </div>
        <button
          className="nav-toggle"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
      <div className="nav-overlay" onClick={close} />
    </nav>
  )
}
