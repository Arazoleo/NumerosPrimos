import './Footer.css'

const IG = 'https://www.instagram.com/numerosprimos_cripto/'

export default function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-left">
          <div className="brand">
            <img src="/assets/logo.jpg" alt="" className="brand-logo" />
            <span className="brand-text">Números <span>Primos</span> & Criptografia</span>
          </div>
          <div className="footer-affil">
            <img src="/assets/unifesp.png" alt="UNIFESP" className="footer-unifesp" />
            <span>Projeto de Extensão da UNIFESP</span>
          </div>
        </div>

        <div className="footer-right">
          <a href={IG} target="_blank" rel="noopener noreferrer" className="footer-ig">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            @numerosprimos_cripto
          </a>
          <div className="copy">© 2026 · feito pelos membros do time</div>
        </div>
      </div>
    </footer>
  )
}
