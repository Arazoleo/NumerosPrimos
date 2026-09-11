import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useQualitySettings } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import { useDocumentTitle } from '../../useDocumentTitle'
import { ExpeditionPartyHud, usePrimeverseExpeditionParty } from '../primeverse-online/party'
import { HERO_KIT_LIST, getHeroKit } from './classKits'
import Nucleus257Arena from './Nucleus257Arena'
import type { AbilitySlot, HeroId, HeroKit } from './types'
import { supportsNucleusOnlineMode } from './useNucleusMultiplayer'
import './nucleus-257.css'

const ROLE_LABEL: Readonly<Record<HeroKit['role'], string>> = {
  controller: 'CONTROLE',
  tank: 'VANGUARDA',
  assault: 'ASSALTO',
  infiltrator: 'INFILTRAÇÃO',
}

const ABILITY_KEY: Readonly<Record<AbilitySlot, string>> = {
  primary: 'M1',
  signature: 'Q',
  mobility: 'E',
  ultimate: 'R',
}

function hexToRgb(hex: string): string {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  if (!Number.isFinite(value)) return '89, 242, 189'
  return `${value >> 16 & 255}, ${value >> 8 & 255}, ${value & 255}`
}

function pageStyle(hero: HeroKit): CSSProperties {
  return {
    '--n257-accent': hero.accent,
    '--n257-accent-rgb': hexToRgb(hero.accent),
  } as CSSProperties
}

function heroStyle(hero: HeroKit): CSSProperties {
  return {
    '--hero-rgb': hexToRgb(hero.accent),
  } as CSSProperties
}

export default function Nucleus257Page(): JSX.Element {
  useDocumentTitle('Núcleo 257 · Arena de Superpoderes')
  const { quality, setQuality, profile } = useQualitySettings()
  const [selectedId, setSelectedId] = useState<HeroId>('luma-crivo')
  const [playing, setPlaying] = useState(false)
  const party = usePrimeverseExpeditionParty('nucleus-257')
  const hero = useMemo(() => getHeroKit(selectedId), [selectedId])
  const onlineIntent = supportsNucleusOnlineMode(party.status)

  if (playing) {
    return (
      <main className="n257-page" style={pageStyle(hero)} data-quality={quality}>
        <Nucleus257Arena
          heroId={hero.id}
          quality={quality}
          profile={profile}
          party={party}
          onQualityChange={setQuality}
          onExit={() => setPlaying(false)}
        />
        <ExpeditionPartyHud party={party} className="pep-hud--nucleus pep-hud--nucleus-game" />
      </main>
    )
  }

  return (
    <main className="n257-page" style={pageStyle(hero)} data-quality={quality}>
      <section className="n257-select" aria-labelledby="n257-title">
        <nav className="n257-nav" aria-label="Navegação da arena">
          <Link className="n257-brand" to="/jogos/primeverse-online">
            <span className="n257-brand__mark"><b>257</b></span>
            NÚCLEO 257
          </Link>
          <div>
            <span className="n257-live"><i /> {onlineIntent ? 'ARENA PVP ONLINE' : 'SIMULAÇÃO DE COMBATE ATIVA'}</span>
            <Link to="/jogos/primeverse-online">← VOLTAR AO PRIMEVERSE</Link>
          </div>
        </nav>

        <header className="n257-select__head">
          <div>
            <p className="n257-kicker">PROTOCOLO DE ARENA // FERMAT 2⁸ + 1</p>
            <h1 id="n257-title">NÚCLEO <em>257</em></h1>
          </div>
          <p className="n257-select__intro">
            Quatro operadores transformam famílias primas e criptografia em estilos de luta totalmente diferentes.
            {onlineIntent
              ? ' Entre com até 12 pessoas da sua sala, forme equipes e batalhe com dano validado pelo servidor.'
              : ' Domine os pylons na ordem correta enquanto enfrenta uma equipe de rivais adaptativos.'}
          </p>
        </header>

        <div className="n257-hero-layout">
          <div className="n257-hero-grid" role="listbox" aria-label="Escolha seu operador">
            {HERO_KIT_LIST.map((candidate, index) => {
              const selected = candidate.id === selectedId
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`n257-hero-card${selected ? ' is-selected' : ''}`}
                  style={heroStyle(candidate)}
                  onClick={() => setSelectedId(candidate.id)}
                >
                  <span className="n257-hero-card__index">0{index + 1} / 04</span>
                  <span className="n257-hero-portrait"><i /></span>
                  <span className="n257-hero-card__copy">
                    <small>{candidate.affinity}</small>
                    <strong>{candidate.characterName}</strong>
                    <span>{candidate.description}</span>
                    <span className="n257-hero-card__role">
                      {ROLE_LABEL[candidate.role]} <b>{candidate.codename}</b>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <aside className="n257-loadout" aria-live="polite">
            <p className="n257-panel-kicker">LOADOUT SELECIONADO</p>
            <div className="n257-loadout__title">
              <strong>{hero.codename}</strong>
              <span>{hero.stats.maxHealth} VIDA · {hero.stats.maxShield} ESCUDO</span>
            </div>
            <div className="n257-abilities-list">
              {(['primary', 'signature', 'mobility', 'ultimate'] as const).map((slot) => {
                const ability = hero.abilities[slot]
                return (
                  <div className="n257-ability-line" key={slot}>
                    <kbd>{ABILITY_KEY[slot]}</kbd>
                    <span><strong>{ability.name}</strong><small>{ability.description}</small></span>
                    <span>{slot === 'ultimate' ? 'CARGA 100%' : `${(ability.cooldownMs / 1_000).toFixed(ability.cooldownMs < 1_000 ? 1 : 0)} S`}</span>
                  </div>
                )
              })}
            </div>
            <button className="n257-launch" type="button" onClick={() => setPlaying(true)}>
              <span>{onlineIntent ? 'ENTRAR NA BATALHA ONLINE' : 'ENTRAR NA CÂMARA 257'}</span><i>↗</i>
            </button>
          </aside>
        </div>

        <footer className="n257-select__footer">
          <div>
            <span><b>WASD</b> MOVER</span>
            <span><b>MOUSE</b> MIRAR</span>
            <span><b>M1</b> ATAQUE</span>
            <span><b>Q / E / R</b> PODERES</span>
            {onlineIntent
              ? <span><b>2 EQUIPES</b> COMBATE ONLINE</span>
              : <span><b>2 · 3 · 5 · 7</b> DOMÍNIO</span>}
          </div>
          <QualityControl value={quality} onChange={setQuality} />
        </footer>
      </section>
      <ExpeditionPartyHud party={party} className="pep-hud--nucleus pep-hud--nucleus-select" />
    </main>
  )
}
