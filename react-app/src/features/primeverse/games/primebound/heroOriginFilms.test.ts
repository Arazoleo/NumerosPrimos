import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import {
  HERO_ORIGIN_FILMS,
  originFilmDurationMs,
  originFilmFrame,
} from './heroOriginFilms'

describe('hero origin films', () => {
  it('gives every hero a film with at least four beats and a positive duration', () => {
    for (const heroClassId of HERO_CLASS_IDS) {
      const film = HERO_ORIGIN_FILMS[heroClassId]
      expect(film.heroClassId).toBe(heroClassId)
      expect(film.beats.length).toBeGreaterThanOrEqual(4)
      expect(originFilmDurationMs(film)).toBeGreaterThan(10_000)
      for (const beat of film.beats) {
        expect(beat.durationMs).toBeGreaterThan(0)
        expect(beat.caption.length).toBeGreaterThan(20)
      }
    }
  })

  it('stages every hero in a distinct scene with distinct beats and captions', () => {
    const films = Object.values(HERO_ORIGIN_FILMS)
    const scenes = new Set(films.map((film) => film.scene))
    expect(scenes.size).toBe(films.length)

    const beatIds = films.flatMap((film) => film.beats.map((beat) => beat.id))
    expect(new Set(beatIds).size).toBe(beatIds.length)

    const captions = films.flatMap((film) => film.beats.map((beat) => beat.caption))
    expect(new Set(captions).size).toBe(captions.length)

    const quotes = films.map((film) => film.quote)
    expect(new Set(quotes).size).toBe(quotes.length)
    for (const quote of quotes) expect(quote.length).toBeGreaterThan(10)
  })

  it('resolves frames across beat boundaries and finishes exactly at the end', () => {
    const film = HERO_ORIGIN_FILMS['prime-warrior']
    const start = originFilmFrame(film, 0)
    expect(start.beatIndex).toBe(0)
    expect(start.beatProgress).toBe(0)
    expect(start.finished).toBe(false)

    const midSecond = originFilmFrame(film, film.beats[0].durationMs + 1)
    expect(midSecond.beatIndex).toBe(1)
    expect(midSecond.beatProgress).toBeGreaterThan(0)
    expect(midSecond.beatProgress).toBeLessThan(0.01)

    const total = originFilmDurationMs(film)
    const end = originFilmFrame(film, total)
    expect(end.finished).toBe(true)
    expect(end.progress).toBe(1)
    expect(end.beatIndex).toBe(film.beats.length - 1)

    const beyond = originFilmFrame(film, total + 5_000)
    expect(beyond.finished).toBe(true)
  })
})
