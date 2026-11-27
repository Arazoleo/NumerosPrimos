import { useDeferredValue, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getLevelProgress, useProgressionStore } from '../../../progression'
import { PRIMEVERSE_GAMES, type PrimeverseGame } from '../catalog'
import { audioBus } from '../audio/audioBus'
import { useQualitySettings } from '../graphics/useQualitySettings'
import QualityControl from '../ui/QualityControl'
import VolumeControl from '../ui/VolumeControl'
import { useDocumentTitle } from '../useDocumentTitle'
import GameArt from './GameArt'
import '../primeverse.css'
import './PrimeversePage.css'

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function matches(game: PrimeverseGame, query: string) {
  if (!query) return true
  return normalize(`${game.title} ${game.label} ${game.mathematicalIdea} ${game.description}`).includes(query)
}

/**
 * O hub do Primeverse, no espírito do threejs.org: uma coluna estreita com o
 * essencial e, ao lado, uma grade de capas de ponta a ponta. Cada capa é a
 * matemática do jogo desenhada; o nome aparece por baixo e a ideia no hover.
 */
export default function PrimeversePage() {
  useDocumentTitle('Primeverse · Números Primos')
  const { quality, setQuality } = useQualitySettings()
  const level = useProgressionStore((state) => state.level)
  const xp = useProgressionStore((state) => state.xp)
  const bestScores = useProgressionStore((state) => state.bestScores)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const deferredQuery = useDeferredValue(normalize(query.trim()))
  const games = useMemo(() => PRIMEVERSE_GAMES.filter((game) => matches(game, deferredQuery)), [deferredQuery])
  const progress = getLevelProgress(xp)
  const levelPercent = Math.round(progress.ratio * 100)

  return (
    <main className={`primeverse-shell pv-hub ${menuOpen ? 'is-menu-open' : ''}`}>
      <aside className="pv-side" aria-label="Primeverse">
        <div className="pv-side__head">
          <Link className="pv-wordmark" to="/" aria-label="Voltar ao site Números Primos">
            primeverse<sup>{PRIMEVERSE_GAMES.length}</sup>
          </Link>
          <button
            type="button"
            className="pv-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="pv-side-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Fechar' : 'Menu'}
          </button>
        </div>

        <div className="pv-side__panel" id="pv-side-panel">
          <h1 className="pv-side__title">Jogos para pensar em números primos.</h1>
          <p className="pv-side__lede">
            Cada jogo é uma ideia de teoria dos números que se joga: primalidade, fatoração, congruências, RSA.
          </p>

          <label className="pv-search">
            <span className="pv-sr-only">Filtrar jogos</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar"
              autoComplete="off"
              spellCheck={false}
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar filtro">×</button>}
          </label>

          <nav className="pv-side__nav" aria-label="Seções">
            <span className="pv-side__label">Explorar</span>
            <Link to="/">Site Números Primos</Link>
            <Link to="/jogos/primeverse-online">Primeverse Online</Link>
            <Link to="/jogos/grimorio-primo">Grimório Primo <em>novo</em></Link>
          </nav>

          <section className="pv-side__profile" aria-label="Seu progresso">
            <span className="pv-side__label">Progresso</span>
            <div className="pv-level">
              <strong>Nível {level}</strong>
              <span>{xp} XP</span>
            </div>
            <div
              className="pv-level__bar"
              role="progressbar"
              aria-label="Progresso até o próximo nível"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={levelPercent}
            >
              <i style={{ width: `${levelPercent}%` }} />
            </div>
          </section>

          <section className="pv-side__settings" aria-label="Ajustes">
            <span className="pv-side__label">Ajustes</span>
            <div>
              <QualityControl value={quality} onChange={setQuality} />
              <VolumeControl />
            </div>
          </section>

          <footer className="pv-side__foot">Números Primos · UNIFESP</footer>
        </div>
      </aside>

      <section className="pv-grid" aria-label="Jogos disponíveis">
        {games.map((game, index) => {
          const best = bestScores[game.id]
          const body = (
            <>
              <GameArt id={game.id} accent={game.accent} glyph={game.glyph} />
              <span className="pv-tile__meta">
                <strong>{game.title}</strong>
                <span>{game.label}</span>
              </span>
              <span className="pv-tile__more" aria-hidden="true">
                <span>{game.mathematicalIdea}</span>
                {best ? <small>Recorde {best}</small> : null}
              </span>
            </>
          )
          const style = { '--tile-accent': game.accent, '--tile-index': index } as CSSProperties
          return game.path ? (
            <Link
              key={game.id}
              className={`pv-tile ${index === 0 && !deferredQuery ? 'is-featured' : ''}`}
              to={game.path}
              style={style}
              onClick={() => audioBus.play('portal')}
              aria-label={`${game.title} — ${game.description}`}
            >
              {body}
            </Link>
          ) : (
            <div key={game.id} className="pv-tile is-locked" style={style} aria-label={`${game.title} — em breve`}>
              {body}
            </div>
          )
        })}
        {games.length === 0 && (
          <p className="pv-grid__empty">
            Nenhum jogo com “{query}”. <button type="button" onClick={() => setQuery('')}>Limpar filtro</button>
          </p>
        )}
      </section>
    </main>
  )
}
