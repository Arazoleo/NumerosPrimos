import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PRIMEVERSE_GAMES } from '../features/primeverse/catalog'
import { PRIMEVERSE_EXPEDITIONS } from '../features/primeverse/games/primeverse-online/expeditions'
import './PrimeverseSection.css'

function pickRandomGames(games, count = 3) {
  const shuffled = [...games]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export default function PrimeverseSection() {
  const totalGames = PRIMEVERSE_GAMES.length
  const totalExpeditions = PRIMEVERSE_EXPEDITIONS.length
  const [featuredGames] = useState(() => pickRandomGames(PRIMEVERSE_GAMES, 3))

  return (
    <section id="primeverse" className="primeverse-section">
      <div className="container">
        <motion.div
          className="primeverse-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="kicker">// PORTAL DE JOGOS & CRIPTOGRAFIA</span>
          <h2 className="h2">
            Mergulhe no <em>Primeverse</em>.
          </h2>
          <p className="primeverse-lead-sentence">
            O Primeverse é o nosso portal de jogos matemáticos interativos sobre números primos e criptografia, desenvolvido pela nossa equipe para transformar conceitos teóricos em experiências jogáveis.
          </p>
        </motion.div>

        {/* Barra de métricas com alinhamento simétrico e tipografia equilibrada */}
        <motion.div
          className="primeverse-metrics-bar"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="primeverse-metric">
            <span className="primeverse-metric-num">{totalGames}</span>
            <strong className="primeverse-metric-title">Jogos principais</strong>
            <span className="primeverse-metric-label">no catálogo do portal</span>
          </div>

          <div className="primeverse-metric-divider" aria-hidden="true" />

          <div className="primeverse-metric">
            <span className="primeverse-metric-num">+{totalExpeditions}</span>
            <strong className="primeverse-metric-title">Expedições Online</strong>
            <span className="primeverse-metric-label">Jogos cooperativos exclusivos no Nexus</span>
          </div>

          <div className="primeverse-metric-divider" aria-hidden="true" />

          <div className="primeverse-metric">
            <span className="primeverse-metric-num">100%</span>
            <strong className="primeverse-metric-title">No navegador</strong>
            <span className="primeverse-metric-label">Acesso gratuito, solo ou com amigos</span>
          </div>
        </motion.div>

        {/* Banner destacando os jogos adicionais dentro do Primeverse Online */}
        <motion.div
          className="primeverse-online-banner"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="primeverse-online-banner-badge" aria-hidden="true">
            ◎ NEXUS ONLINE
          </div>
          <div className="primeverse-online-banner-content">
            <h4 className="primeverse-online-banner-title">
              Mais jogos e expedições dentro do Primeverse Online
            </h4>
            <p className="primeverse-online-banner-desc">
              Além dos jogos do catálogo geral, ao entrar no <strong>Nexus multiplayer</strong> você encontra portais para expedições cooperativas como <em>Cripta do Crivo</em>, <em>Cerco de Euclides</em>, <em>Fenda de Ulam</em> e minigames integrados em tempo real com outros jogadores.
            </p>
          </div>
          <Link to="/jogos/primeverse-online" className="primeverse-online-banner-link">
            Explorar o Nexus <span>↗</span>
          </Link>
        </motion.div>

        {/* Vitrine com 3 jogos aleatórios */}
        <div className="primeverse-showcase">
          <div className="primeverse-showcase-top">
            <div>
              <h3 className="primeverse-showcase-title">3 Destaques para Jogar Agora</h3>
              <p className="primeverse-showcase-sub">
                Cada partida explora uma mecânica real de teoria dos números e criptografia.
              </p>
            </div>
            <Link to="/jogos" className="btn btn-primary primeverse-head-cta">
              Ver todos os {totalGames} jogos <span className="arrow">→</span>
            </Link>
          </div>

          <div className="primeverse-grid primeverse-grid-three">
            <AnimatePresence mode="popLayout">
              {featuredGames.map((game) => (
                <motion.article
                  key={game.id}
                  className="primeverse-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  layout
                >
                  <div className="primeverse-card-top">
                    <span
                      className="primeverse-card-glyph"
                      style={{
                        borderColor: game.accent,
                        color: game.accent,
                        boxShadow: `0 0 16px ${game.accent}26`,
                      }}
                      aria-hidden="true"
                    >
                      {game.glyph}
                    </span>
                    <span className="primeverse-card-category">{game.label}</span>
                  </div>

                  <div className="primeverse-card-body">
                    <h4 className="primeverse-card-title">{game.title}</h4>
                    <p className="primeverse-card-desc">{game.description}</p>
                  </div>

                  <div className="primeverse-card-footer">
                    <Link
                      to={game.path || '/jogos'}
                      className="primeverse-card-play-btn"
                    >
                      Jogar agora <span className="arrow">→</span>
                    </Link>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          className="primeverse-bottom-card"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="primeverse-bottom-content">
            <span className="primeverse-bottom-kicker">CATÁLOGO COMPLETO</span>
            <h3 className="primeverse-bottom-title">
              Descubra todas as experiências no portal.
            </h3>
            <p className="primeverse-bottom-desc">
              Do arcade de velocidade à exploração espacial e ao Nexus multiplayer com expedições exclusivas, a matemática vira jogo interativo.
            </p>
          </div>
          <div className="primeverse-bottom-actions">
            <Link to="/jogos" className="btn btn-primary primeverse-cta-large">
              Entrar no Primeverse ({totalGames} jogos) <span className="arrow">→</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
