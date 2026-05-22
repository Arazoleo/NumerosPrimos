import { motion } from 'framer-motion'
import './About.css'

const Stroke = ({ children, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const PiIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h16" />
    <path d="M9 8v9c0 .8-.7 1.5-1.5 1.5S6 17.8 6 17" />
    <path d="M15 8v8c0 1.5 1 2.5 2 2.5" />
  </svg>
)

const LockIcon = () => (
  <Stroke>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Stroke>
)

const CodeIcon = () => (
  <Stroke>
    <path d="M9 8l-4 4 4 4" />
    <path d="M15 8l4 4-4 4" />
  </Stroke>
)

const items = [
  { ico: <PiIcon />,   t: 'Matemática Pura',
    d: 'Da definição de primo às propriedades fundamentais: fatoração única, infinitude, distribuição. A base que sustenta tudo.' },
  { ico: <LockIcon />, t: 'Criptografia RSA',
    d: 'O algoritmo que protege bancos, governos e WhatsApp. Mostramos por que multiplicar é fácil, mas fatorar é (quase) impossível.' },
  { ico: <CodeIcon />, t: 'Aplicações Reais',
    d: 'HTTPS, assinaturas digitais, blockchain. Onde a teoria sai do papel e vira a infraestrutura invisível da sua vida digital.' },
]

export default function About() {
  return (
    <section id="sobre">
      <div className="container">
        <motion.div className="section-head"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}>
          <span className="kicker">// sobre o projeto</span>
          <h2 className="h2">A teoria por trás <em>do que ninguém vê</em>.</h2>
          <p className="section-sub">Cada vez que você manda uma mensagem, faz um login ou paga uma conta, números primos gigantescos
            estão trabalhando em silêncio. Nosso projeto destrincha esse mecanismo, da matemática pura até a aplicação real.</p>
        </motion.div>

        <div className="about-grid">
          {items.map((it, i) => (
            <motion.div key={it.t} className="feature"
              initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1 }}>
              <div className="feature-ico">{it.ico}</div>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
