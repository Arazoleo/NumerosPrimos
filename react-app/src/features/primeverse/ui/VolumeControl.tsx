import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useAudioPreferences } from '../audio/audioPreferences'
import './volume-control.css'

function Speaker({ silent }: { silent: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M11 4 5 9H2v6h3l6 5V4Z" strokeLinejoin="round" />
      {silent ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
    </svg>
  )
}

export default function VolumeControl() {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState('left')
  const volume = useAudioPreferences(state => state.volume)
  const muted = useAudioPreferences(state => state.muted)
  const setVolume = useAudioPreferences(state => state.setVolume)
  const setMuted = useAudioPreferences(state => state.setMuted)
  const toggleMuted = useAudioPreferences(state => state.toggleMuted)
  const percent = Math.round(volume * 100)

  const reveal = () => {
    const bounds = root.current?.getBoundingClientRect()
    setSide(bounds && window.innerWidth - bounds.right >= 172 ? 'right' : 'left')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <div ref={root} className="pv-volume" data-side={side}
      onPointerEnter={event => { if (event.pointerType === 'mouse') reveal() }}
      onPointerLeave={() => { if (!root.current?.contains(document.activeElement)) setOpen(false) }}
      onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget)) reveal() }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        } else if (event.key !== 'Tab') event.stopPropagation()
      }}>
      <button ref={trigger} type="button" className="pv-volume__trigger" onClick={() => { toggleMuted(); reveal() }}
        aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'} aria-pressed={muted} aria-expanded={open} aria-controls={id}>
        <Speaker silent={muted || volume === 0} />
      </button>
      <div id={id} className="pv-volume__panel" role="group" aria-label="Ajustes de áudio" hidden={!open}>
        <button type="button" className="pv-volume__mute" onClick={toggleMuted}
          aria-pressed={muted} aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}>
          <Speaker silent={muted || volume === 0} />
        </button>
        <input aria-label="Volume" type="range" min="0" max="100" step="1" value={percent}
          style={{ '--volume-percent': `${percent}%` } as CSSProperties}
          aria-valuetext={`${percent}%${muted ? ', áudio silenciado' : ''}`}
          onPointerDown={() => setMuted(false)}
          onChange={event => {
            setVolume(Number(event.target.value) / 100)
            setMuted(false)
          }} />
        <output className="pv-volume__value">{muted ? '—' : `${percent}%`}</output>
      </div>
    </div>
  )
}
