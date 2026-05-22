import { motion } from 'framer-motion'
import './FinalCTA.css'

const IG = 'https://www.instagram.com/numerosprimos_cripto/'

export default function FinalCTA() {
  return (
    <section id="contato">
      <div className="container">
        <motion.div className="final-cta"
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }}>
          <h2>Curtiu? <em>Vem com a gente.</em></h2>
          <p>Conteúdo novo toda semana, oficinas em escolas e quem sabe a próxima atividade é perto de você.</p>
          <a href={IG} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Seguir @numerosprimos_cripto <span className="arrow">→</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
