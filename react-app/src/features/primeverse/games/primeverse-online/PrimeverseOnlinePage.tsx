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
import { CHARACTERS, CharacterFigure, CharacterIcon, ENERGIES, EnergyAnimation, getCharacter, getEnergy } from './customization'
import './primeverse-online.css'
import './customization/character-customization.css'

export default function PrimeverseOnlinePage(): JSX.Element {
  useDocumentTitle('Primeverse Online · Mundo compartilhado')
  const { savedIdentity, activeIdentity, startSession, endSession } = usePrimeverseSession()
  const { quality, setQuality, profile } = useQualitySettings()
  const [nickname, setNickname] = useState(savedIdentity.nickname)
  const [appearance, setAppearance] = useState<AvatarAppearance>({
    ...savedIdentity.appearance,
    characterModel: savedIdentity.appearance.characterModel ?? 'primo',
    energyType: savedIdentity.appearance.energyType ?? 'prime-ring',
  })
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [testingPower, setTestingPower] = useState(false)

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

  const currentCharacter = getCharacter(appearance.characterModel ?? 'primo')
  const currentEnergy = getEnergy(appearance.energyType ?? 'prime-ring')

  const handleTestPower = () => {
    setTestingPower(true)
    setTimeout(() => setTestingPower(false), 3200)
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

        <form className="pvo-entry-card pvo-entry-card--enhanced" onSubmit={(event) => { event.preventDefault(); enterWorld() }}>
          <div className="pvo-entry-card__head">
            <span>PERSONALIZE SEU EXPLORADOR</span>
          </div>

          {/* Prévia: personagem escolhido + efeito da energia atual */}
          <div className="pvo-avatar-preview" style={{ '--body': appearance.bodyColor, '--accent': appearance.accentColor, '--visor': appearance.visorColor, '--char': currentCharacter.accent } as React.CSSProperties} aria-hidden="true">
            <EnergyAnimation type={appearance.energyType ?? 'prime-ring'} color={appearance.accentColor} active={testingPower} />
            <div className="pvo-avatar-preview__bot">
              <CharacterFigure id={currentCharacter.id} />
            </div>
            <span className="pvo-avatar-preview__name">{nickname.trim() || 'SEU NOME'}</span>
          </div>

          {/* 01 · Codinome */}
          <section className="pvo-custom-step">
            <header className="pvo-custom-step__head">
              <b>01</b>
              <label htmlFor="pvo-nickname">CODINOME</label>
              <small>{Array.from(nickname).length}/{MAX_NICKNAME_LENGTH}</small>
            </header>
            <div className="pvo-field">
              <input
                id="pvo-nickname"
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
            </div>
          </section>

          {/* 02 · Explorador: grade de escolha + ficha do personagem selecionado */}
          <section className="pvo-custom-step" aria-labelledby="pvo-step-character">
            <header className="pvo-custom-step__head">
              <b>02</b>
              <span id="pvo-step-character">EXPLORADOR</span>
            </header>
            <div className="pvo-choice-grid">
              {CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  className={`pvo-choice ${appearance.characterModel === char.id ? 'active' : ''}`}
                  style={{ '--choice-accent': char.accent, '--char-accent': char.accent } as React.CSSProperties}
                  onClick={() => setAppearance((current) => ({ ...current, characterModel: char.id }))}
                  aria-pressed={appearance.characterModel === char.id}
                  title={`${char.name} — ${char.theme}`}
                >
                  <span className="pvo-choice__art"><CharacterIcon id={char.id} /></span>
                  <span className="pvo-choice__name">{char.name}</span>
                </button>
              ))}
            </div>
            <div className="pvo-detail-card" style={{ '--detail-accent': currentCharacter.accent } as React.CSSProperties}>
              <div className="pvo-detail-card__head">
                <strong>{currentCharacter.name}</strong>
                <small>{currentCharacter.theme}</small>
              </div>
              <p>{currentCharacter.description}</p>
            </div>
          </section>

          {/* 03 · Energia: grade de escolha + ficha do poder com botão de teste */}
          <section className="pvo-custom-step" aria-labelledby="pvo-step-energy">
            <header className="pvo-custom-step__head">
              <b>03</b>
              <span id="pvo-step-energy">ENERGIA</span>
            </header>
            <div className="pvo-choice-grid">
              {ENERGIES.map((energy) => (
                <button
                  key={energy.id}
                  type="button"
                  className={`pvo-choice ${appearance.energyType === energy.id ? 'active' : ''}`}
                  style={{ '--choice-accent': energy.accent } as React.CSSProperties}
                  onClick={() => setAppearance((current) => ({ ...current, energyType: energy.id, accentColor: energy.accent, visorColor: energy.accent }))}
                  aria-pressed={appearance.energyType === energy.id}
                  title={`${energy.name} — ${energy.powerName}`}
                >
                  <span className="pvo-choice__art pvo-choice__art--glyph">{energy.icon}</span>
                  <span className="pvo-choice__name">{energy.name}</span>
                </button>
              ))}
            </div>
            <div className="pvo-detail-card" style={{ '--detail-accent': currentEnergy.accent } as React.CSSProperties}>
              <div className="pvo-detail-card__head">
                <strong>{currentEnergy.powerName}</strong>
                <small>{currentEnergy.concept}</small>
              </div>
              <p>{currentEnergy.powerDescription}</p>
              <button type="button" className="pvo-power-test" onClick={handleTestPower} disabled={testingPower}>
                <span>{testingPower ? 'ENERGIA ATIVADA…' : 'TESTAR ENERGIA'}</span>
              </button>
            </div>
          </section>

          {/* 04 · Cores do traje e do brilho da energia */}
          <section className="pvo-custom-step" aria-labelledby="pvo-step-colors">
            <header className="pvo-custom-step__head">
              <b>04</b>
              <span id="pvo-step-colors">CORES</span>
            </header>
            <fieldset className="pvo-swatches">
              <legend>TRAJE</legend>
              {AVATAR_BODY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={appearance.bodyColor === color ? 'active' : ''}
                  style={{ '--swatch': color } as React.CSSProperties}
                  onClick={() => setAppearance((current) => ({ ...current, bodyColor: color }))}
                  aria-label={`Cor do traje ${color}`}
                  aria-pressed={appearance.bodyColor === color}
                />
              ))}
            </fieldset>
            <fieldset className="pvo-swatches">
              <legend>BRILHO</legend>
              {AVATAR_ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={appearance.accentColor === color ? 'active' : ''}
                  style={{ '--swatch': color } as React.CSSProperties}
                  onClick={() => setAppearance((current) => ({ ...current, accentColor: color, visorColor: color }))}
                  aria-label={`Cor do brilho da energia ${color}`}
                  aria-pressed={appearance.accentColor === color}
                />
              ))}
            </fieldset>
          </section>

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
