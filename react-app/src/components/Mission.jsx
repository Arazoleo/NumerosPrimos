import { motion } from 'framer-motion'
import './Mission.css'

const Stroke = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const SchoolIcon = () => (
  <Stroke>
    <path d="M3 21h18" />
    <path d="M5 21V10l7-4 7 4v11" />
    <path d="M10 21v-6h4v6" />
    <path d="M9 11h.01" />
    <path d="M15 11h.01" />
  </Stroke>
)

const PinIcon = () => (
  <Stroke>
    <path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </Stroke>
)

const UsersIcon = () => (
  <Stroke>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Stroke>
)

const ACTIVITIES = [
  { ico: <SchoolIcon />, t: 'Escolas',          d: 'Oficinas e palestras pra alunos do ensino fundamental e médio.' },
  { ico: <PinIcon />,    t: 'Espaços públicos', d: 'Atividades em praças, bibliotecas e centros culturais.' },
  { ico: <UsersIcon />,  t: 'Comunidade',       d: 'Materiais e conteúdos abertos pra qualquer pessoa curiosa.' },
]

const IG = 'https://www.instagram.com/numerosprimos_cripto/'

export default function Mission() {
  return (
    <section id="missao" className="mission-section">
      <div className="container">
        <motion.div
          className="mission-card"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="mission-head">
            <div className="mission-logo-wrap">
              <img src="/assets/unifesp.png" alt="UNIFESP" className="mission-logo" />
            </div>
            <div className="mission-meta">
              <span className="kicker">// projeto de extensão</span>
              <h2 className="h2">Matemática é pra <em>todo mundo</em>.</h2>
            </div>
          </div>

          <p className="mission-text">
            Somos um projeto de extensão da <strong>UNIFESP</strong> que leva os conceitos de
            <strong> teoria dos números</strong> e <strong>criptografia</strong> pra fora da universidade.
            Acreditamos que matemática boa não fica trancada na sala de aula, ela vai pra rua,
            pras escolas, pros lugares públicos.
          </p>

          <div className="mission-activities">
            {ACTIVITIES.map((a, i) => (
              <motion.div
                key={a.t}
                className="activity"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              >
                <div className="activity-ico">{a.ico}</div>
                <div>
                  <h4>{a.t}</h4>
                  <p>{a.d}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <a className="mission-cta" href={IG} target="_blank" rel="noopener noreferrer">
            <svg className="ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span className="mission-cta-text">
              <span className="mission-cta-lbl">acompanhe no Instagram</span>
              <span className="mission-cta-handle">@numerosprimos_cripto</span>
            </span>
            <span className="mission-cta-arrow">→</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
