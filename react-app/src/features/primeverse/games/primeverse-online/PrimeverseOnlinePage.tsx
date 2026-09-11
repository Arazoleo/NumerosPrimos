import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useQualitySettings } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import { useDocumentTitle } from '../../useDocumentTitle'
import { PRIMEVERSE_EXPEDITIONS } from './expeditions'
import PrimeverseOnlineExperience from './PrimeverseOnlineExperience'
import { usePrimeverseSession } from './session/PrimeverseSessionProvider'
import {
  AVATAR_ACCENT_COLORS,
  AVATAR_BODY_COLORS,
  MAX_NICKNAME_LENGTH,
  type AvatarAppearance,
  sanitizeNickname,
} from './shared/protocol'
import type { SessionIdentity } from './session/sessionStorage'
import './primeverse-online.css'

export default function PrimeverseOnlinePage(): JSX.Element {
  useDocumentTitle('Primeverse Online · Mundo compartilhado')
  const { savedIdentity, activeIdentity, startSession, endSession } = usePrimeverseSession()
  const { quality, setQuality, profile } = useQualitySettings()
  const [nickname, setNickname] = useState(savedIdentity.nickname)
  const [appearance, setAppearance] = useState<AvatarAppearance>(savedIdentity.appearance)
  const [nicknameError, setNicknameError] = useState<string | null>(null)

  if (activeIdentity) {
    return (
      <main className="pvo-page pvo-page--playing" data-quality={quality}>
        <PrimeverseOnlineExperience
          quality={quality}
          profile={profile}
          onQualityChange={setQuality}
          onLeave={endSession}
        />
      </main>
    )
  }

  const enterWorld = () => {
    const safeNickname = sanitizeNickname(nickname)
    if (!safeNickname.ok) {
      setNicknameError(nickname.trim().length < 2 ? 'Use pelo menos 2 caracteres.' : `Use letras e números, com no máximo ${MAX_NICKNAME_LENGTH} caracteres.`)
      return
    }
    const identity: SessionIdentity = { nickname: safeNickname.value, appearance }
    setNicknameError(null)
    startSession(identity)
  }

  return (
    <main className="pvo-page" data-quality={quality}>
      <div className="pvo-landing__stars" aria-hidden="true" />
      <div className="pvo-landing__grid" aria-hidden="true" />
      <header className="pvo-landing__nav">
        <Link className="pvo-landing__brand" to="/jogos"><span><i />P</span><b>PRIMEVERSE<small>ONLINE</small></b></Link>
        <div><span className="pvo-landing__live"><i /> MULTIPLAYER REAL</span><Link to="/jogos">← VOLTAR AOS JOGOS</Link></div>
      </header>

      <section className="pvo-landing" aria-labelledby="pvo-title">
        <div className="pvo-landing__copy">
          <p className="pvo-eyebrow"><i /> NOVA EXPERIÊNCIA // MUNDO COMPARTILHADO</p>
          <h1 id="pvo-title">A matemática<br /><em>tem um lugar.</em></h1>
          <p className="pvo-landing__lead">Atravesse portais com outros exploradores, enfrente criaturas matemáticas e cumpra aventuras em mundos que jogam de formas diferentes.</p>
          <div className="pvo-landing__facts">
            <span><b>20</b><small>POR SALA</small></span>
            <span><b>01</b><small>HUB ONLINE</small></span>
            <span><b>04</b><small>EXPEDIÇÕES EM GRUPO</small></span>
          </div>
          <nav className="pvo-expedition-deck" aria-label="Expedições independentes">
            {PRIMEVERSE_EXPEDITIONS.map((expedition) => (
              <Link
                key={expedition.id}
                to={expedition.path}
                style={{ '--expedition-accent': expedition.accent } as React.CSSProperties}
              >
                <small>{expedition.overline}</small>
                <strong><i>{expedition.glyph}</i>{expedition.title}</strong>
                <span>{expedition.genre}<b>↗</b></span>
              </Link>
            ))}
          </nav>
        </div>

        <form className="pvo-entry-card" onSubmit={(event) => { event.preventDefault(); enterWorld() }}>
          <div className="pvo-entry-card__head">
            <span>IDENTIDADE DO EXPLORADOR</span><b>01 / 01</b>
          </div>
          <div className="pvo-avatar-preview" style={{ '--body': appearance.bodyColor, '--accent': appearance.accentColor, '--visor': appearance.visorColor } as React.CSSProperties} aria-hidden="true">
            <div className="pvo-avatar-preview__orbit"><i /><i /><i /></div>
            <div className="pvo-avatar-preview__bot"><i className="head" /><i className="visor" /><i className="body" /><i className="core" /><i className="arm left" /><i className="arm right" /><i className="leg left" /><i className="leg right" /></div>
            <span>{nickname.trim() || 'SEU NOME'}</span>
          </div>

          <label className="pvo-field">
            <span>CODINOME <b>{Array.from(nickname).length}/{MAX_NICKNAME_LENGTH}</b></span>
            <input
              value={nickname}
              maxLength={MAX_NICKNAME_LENGTH}
              autoComplete="nickname"
              spellCheck={false}
              placeholder="Ex: Euclides"
              onChange={(event) => { setNickname(event.target.value); setNicknameError(null) }}
              aria-invalid={Boolean(nicknameError)}
              aria-describedby={nicknameError ? 'pvo-name-error' : undefined}
            />
            {nicknameError && <small id="pvo-name-error" role="alert">{nicknameError}</small>}
          </label>

          <fieldset className="pvo-swatches">
            <legend>CORPO</legend>
            {AVATAR_BODY_COLORS.map((color) => <button key={color} type="button" className={appearance.bodyColor === color ? 'active' : ''} style={{ '--swatch': color } as React.CSSProperties} onClick={() => setAppearance((current) => ({ ...current, bodyColor: color }))} aria-label={`Cor do corpo ${color}`} />)}
          </fieldset>
          <fieldset className="pvo-swatches">
            <legend>ENERGIA</legend>
            {AVATAR_ACCENT_COLORS.map((color) => <button key={color} type="button" className={appearance.accentColor === color ? 'active' : ''} style={{ '--swatch': color } as React.CSSProperties} onClick={() => setAppearance((current) => ({ ...current, accentColor: color, visorColor: color }))} aria-label={`Cor da energia ${color}`} />)}
          </fieldset>

          <button className="pvo-enter" type="submit"><span>ENTRAR NO PRIMEVERSE</span><i>↗</i></button>
          <p className="pvo-entry-card__note"><i /> Sem conta ou chat. Sua sala e sua equipe atravessam os quatro portais com você.</p>
        </form>
      </section>

      <footer className="pvo-landing__footer">
        <div><span>WASD <small>MOVER</small></span><span>SHIFT <small>CORRER</small></span><span>SPACE <small>SALTAR</small></span><span>E <small>INTERAGIR</small></span><span>Q <small>EMOTES</small></span></div>
        <QualityControl value={quality} onChange={setQuality} />
      </footer>
    </main>
  )
}
