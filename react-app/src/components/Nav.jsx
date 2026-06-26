import { useEffect, useState } from 'react'
import './Nav.css'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  const close = () => {
    setOpen(false)
    setDropdownOpen(false)
  }

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''} ${open ? 'open' : ''}`}>
      <div className="container nav-inner">
        <a href="#" className="brand" onClick={close}>
          <img src="/assets/logo.jpg" alt="Logo" className="brand-logo" />
          <span className="brand-text">Números <span>Primos</span></span>
        </a>
        <div className="nav-links">
          <a href="#sobre" onClick={close}>Números primos</a>
          <div 
            className={`nav-dropdown ${dropdownOpen ? 'open' : ''}`}
            onMouseEnter={() => window.innerWidth > 720 && setDropdownOpen(true)}
            onMouseLeave={() => window.innerWidth > 720 && setDropdownOpen(false)}
          >
            <button className="nav-dropdown-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
              Experimentos
            </button>
            <div className="nav-dropdown-menu">
              <a href="#crivo" onClick={close}>Crivo de Eratóstenes</a>
              <a href="#ulam" onClick={close}>Espiral de Ulam</a>
              <a href="#fibonacci" onClick={close}>Espiral de Fibonacci</a>
              <a href="#caesar" onClick={close}>Cifra de César</a>
              <a href="#frequencia" onClick={close}>Análise de Frequência</a>
              <a href="#relogio" onClick={close}>Aritmética Modular</a>
              <a href="#criptografia" onClick={close}>Criptografia</a>
              <a href="#rsa-game" onClick={close}>Minijogo RSA</a>
            </div>
          </div>
          <a href="#missao" onClick={close}>Sobre Nós</a>
          <a href="#contato" className="nav-cta" onClick={close}>Saber Mais →</a>
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
