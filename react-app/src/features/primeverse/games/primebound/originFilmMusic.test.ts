import { describe, expect, it } from 'vitest'

import { HERO_ORIGIN_FILMS } from './heroOriginFilms'
import { ORIGIN_FILM_TRACKS } from './originFilmMusic'

describe('origin film scores', () => {
  it('gives every scene a distinct track with layered intensity', () => {
    const scenes = Object.values(HERO_ORIGIN_FILMS).map((film) => film.scene)
    const ids = new Set<string>()
    for (const scene of scenes) {
      const track = ORIGIN_FILM_TRACKS[scene]
      expect(track).toBeDefined()
      ids.add(track.id)
      expect(track.layers.length).toBeGreaterThanOrEqual(3)
      expect(track.progression.length).toBeGreaterThanOrEqual(4)
      const base = track.layers.filter((layer) => layer.minIntensity === 0)
      expect(base.length).toBeGreaterThanOrEqual(1)
      for (const layer of track.layers) {
        for (const note of layer.pattern) {
          expect(note.step).toBeGreaterThanOrEqual(0)
          expect(note.step).toBeLessThan(track.stepsPerBar)
        }
      }
    }
    expect(ids.size).toBe(scenes.length)
  })
})
