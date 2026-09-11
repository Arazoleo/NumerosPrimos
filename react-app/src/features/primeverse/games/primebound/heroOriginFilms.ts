import { HERO_CLASS_IDS, type HeroClassId } from './heroClassSystem'

/**
 * Origin films: one short cinematic per hero, played before the run begins.
 *
 * This module is pure timeline — beats, captions and timing. Presentation
 * (SVG scenery, camera, skip chrome) lives in HeroOriginFilm.tsx. Every hero
 * has a distinct scene id so the component can stage a different world per
 * champion instead of reusing one template.
 */

export type OriginSceneId =
  | 'mountain-forge'
  | 'cipher-city'
  | 'residue-steppe'
  | 'organ-tower'
  | 'mirror-hall'
  | 'frozen-fjord'
  | 'sieve-greenhouse'
  | 'tide-observatory'

export interface OriginBeat {
  /** Stable id; the presentation keys camera shots off it. */
  readonly id: string
  readonly durationMs: number
  /** Narration line shown at the bottom of the frame. */
  readonly caption: string
}

export interface HeroOriginFilm {
  readonly heroClassId: HeroClassId
  readonly scene: OriginSceneId
  /** The concept line shown as the film's epigraph. */
  readonly epigraph: string
  /** Signature line spoken by the hero over the closing title card. */
  readonly quote: string
  readonly beats: readonly OriginBeat[]
}

function film(
  heroClassId: HeroClassId,
  scene: OriginSceneId,
  epigraph: string,
  quote: string,
  beats: readonly OriginBeat[],
): HeroOriginFilm {
  return Object.freeze({
    heroClassId,
    scene,
    epigraph,
    quote,
    beats: Object.freeze(beats.map((beat) => Object.freeze({ ...beat }))),
  })
}

export const HERO_ORIGIN_FILMS: Readonly<Record<HeroClassId, HeroOriginFilm>> =
  Object.freeze({
    'prime-warrior': film(
      'prime-warrior',
      'mountain-forge',
      'p | ab ⇒ p | a ou p | b',
      'O que não se divide não se detém.',
      [
        { id: 'forge-ember', durationMs: 7_900, caption: 'Cael cresceu numa forja cravada na montanha, onde toda lâmina nascia de ligas misturadas.' },
        { id: 'forge-shatter', durationMs: 9_000, caption: 'E toda liga quebrava: o que é feito de muitos fatores se parte exatamente onde eles se encontram.' },
        { id: 'forge-single', durationMs: 9_100, caption: 'Numa noite sem vento, ele fundiu um metal só. Indivisível. O martelo caiu, e nada se partiu.' },
        { id: 'forge-depart', durationMs: 10_300, caption: 'A lâmina que não se decompõe atravessa qualquer composição. Cael desceu a montanha com ela.' },
      ],
    ),
    'rsa-cryptographer': film(
      'rsa-cryptographer',
      'cipher-city',
      'n = p × q · quebrar n é achar p e q',
      'Trancar é fácil. Abrir sem as minhas duas chaves, impossível.',
      [
        { id: 'city-siege', durationMs: 8_600, caption: 'A cidade de Ada guardava tudo atrás de uma única chave — e uma noite essa chave foi copiada.' },
        { id: 'city-dark', durationMs: 7_500, caption: 'Portão por portão, as luzes caíram. Um segredo só, quando cai, derruba todos os outros.' },
        { id: 'city-keys', durationMs: 10_800, caption: 'Ada multiplicou dois primos enormes e pendurou o produto sobre os portões: trancar é fácil, desfazer é quase impossível.' },
        { id: 'city-dawn', durationMs: 13_600, caption: 'A cidade reacendeu atrás das duas chaves dela. Agora Ada caça os selos compostos dos outros.' },
      ],
    ),
    'modular-ranger': film(
      'modular-ranger',
      'residue-steppe',
      'a ≡ b (mod m)',
      'O mundo dá voltas. As minhas flechas também.',
      [
        { id: 'steppe-wheel', durationMs: 6_200, caption: 'Nara pastoreava sob um céu que girava como um relógio de doze casas.' },
        { id: 'steppe-fog', durationMs: 8_100, caption: 'Quando a névoa engoliu o rebanho, os outros contaram passos e se perderam nos números grandes.' },
        { id: 'steppe-remainder', durationMs: 9_000, caption: 'Nara guardou só os restos: quem anda em círculos volta sempre à mesma casa. Resto igual, caminho igual.' },
        { id: 'steppe-arrow', durationMs: 11_600, caption: 'A flecha que ela solta dá a volta no mundo e chega — porque o alvo é um resíduo, não um ponto.' },
      ],
    ),
    'mersenne-arcanist': film(
      'mersenne-arcanist',
      'organ-tower',
      'M_p = 2^p − 1',
      'Entre potências perfeitas, eu escuto o que falta.',
      [
        { id: 'tower-pipes', durationMs: 9_900, caption: 'Noa afinava o órgão de uma torre onde cada tubo dobrava o anterior: 2, 4, 8, 16, sem fim.' },
        { id: 'tower-chords', durationMs: 8_700, caption: 'As potências de dois soavam limpas demais — acordes perfeitos, previsíveis, vazios.' },
        { id: 'tower-voice', durationMs: 9_900, caption: 'Mas em noites raras um tubo cantava um semitom abaixo: dois elevado a p, menos um. Primo. Vivo.' },
        { id: 'tower-call', durationMs: 12_500, caption: 'Noa aprendeu a chamar essas vozes raras pelo nome. Hoje elas respondem em forma de relâmpago.' },
      ],
    ),
    'mobius-assassin': film(
      'mobius-assassin',
      'mirror-hall',
      'μ(n) = 0 se p² | n',
      'Se o seu fator se repete, você já não existe.',
      [
        { id: 'hall-mirrors', durationMs: 6_000, caption: 'Maia dançava num salão de espelhos que julgava tudo o que refletia.' },
        { id: 'hall-vanish', durationMs: 8_500, caption: 'Quem carregava um fator repetido simplesmente sumia do vidro: o espelho dava zero e apagava.' },
        { id: 'hall-signs', durationMs: 9_000, caption: 'Maia se fez livre de quadrados — leve, alternando entre mais um e menos um, visível só quando escolhia.' },
        { id: 'hall-invert', durationMs: 11_700, caption: 'Quem domina os sinais inverte qualquer soma. Ela saiu do salão pelo lado de dentro do espelho.' },
      ],
    ),
    'goldbach-berserker': film(
      'goldbach-berserker',
      'frozen-fjord',
      'todo par > 2 = p + q',
      'Dois golpes. Sempre bastaram dois.',
      [
        { id: 'fjord-ice', durationMs: 7_100, caption: 'No cais congelado, Otto partia gelo por ofício — blocos pares, sempre pares.' },
        { id: 'fjord-doubt', durationMs: 9_000, caption: 'Diziam que blocos grandes exigiam mil golpes. Otto apostou que dois bastavam, se fossem os dois certos.' },
        { id: 'fjord-split', durationMs: 10_600, caption: 'O bloco 98 caiu em 19 e 79. Dois golpes primos, toda vez — e ninguém nunca achou o contraexemplo.' },
        { id: 'fjord-rage', durationMs: 10_900, caption: 'Cada soma completada deixou os punhos dele mais pesados. A conjectura virou fúria.' },
      ],
    ),
    'sieve-engineer': film(
      'sieve-engineer',
      'sieve-greenhouse',
      'riscar múltiplos até restarem primos',
      'Eu risco o resto. O que fica é essencial.',
      [
        { id: 'greenhouse-grid', durationMs: 7_800, caption: 'Lena herdou uma estufa em grade onde tudo crescia junto — e por isso nada crescia direito.' },
        { id: 'greenhouse-cross', durationMs: 7_900, caption: 'Ela começou pelo dois: riscou fileira sim, fileira não. Depois o três. Depois o cinco.' },
        { id: 'greenhouse-glow', durationMs: 8_600, caption: 'O que nenhum risco alcançou floresceu sozinho, aceso. Os indivisíveis, de pé na grade limpa.' },
        { id: 'greenhouse-build', durationMs: 12_700, caption: 'Lena constrói crivos vivos desde então: estruturas que deixam passar só o que não se divide.' },
      ],
    ),
    'elliptic-oracle': film(
      'elliptic-oracle',
      'tide-observatory',
      'y² = x³ + ax + b',
      'A terceira colisão já aconteceu. Você só não viu ainda.',
      [
        { id: 'cliff-tides', durationMs: 7_000, caption: 'Íris vigiava marés do alto de um penhasco, anotando onde o mar tocava as estrelas.' },
        { id: 'cliff-tangent', durationMs: 7_500, caption: 'Uma noite ela ligou duas estrelas com uma régua — e o céu respondeu marcando uma terceira.' },
        { id: 'cliff-curve', durationMs: 9_000, caption: 'Havia uma curva escondida por trás das luzes: toda reta que a corta duas vezes é obrigada a cortá-la de novo.' },
        { id: 'cliff-fold', durationMs: 13_500, caption: 'Íris dobra pontos sobre a curva como quem dobra o destino: ela sempre sabe onde a terceira colisão cai.' },
      ],
    ),
  } as const)

export interface OriginFilmFrame {
  readonly beat: OriginBeat
  readonly beatIndex: number
  /** 0..1 inside the current beat. */
  readonly beatProgress: number
  /** 0..1 across the whole film. */
  readonly progress: number
  readonly finished: boolean
}

export function originFilmDurationMs(filmDefinition: HeroOriginFilm): number {
  return filmDefinition.beats.reduce((total, beat) => total + beat.durationMs, 0)
}

export function originFilmFrame(
  filmDefinition: HeroOriginFilm,
  elapsedMs: number,
): OriginFilmFrame {
  const total = originFilmDurationMs(filmDefinition)
  const clamped = Math.max(0, elapsedMs)
  let cursor = 0
  for (let index = 0; index < filmDefinition.beats.length; index += 1) {
    const beat = filmDefinition.beats[index]
    if (clamped < cursor + beat.durationMs) {
      return {
        beat,
        beatIndex: index,
        beatProgress: (clamped - cursor) / beat.durationMs,
        progress: clamped / total,
        finished: false,
      }
    }
    cursor += beat.durationMs
  }
  const lastIndex = filmDefinition.beats.length - 1
  return {
    beat: filmDefinition.beats[lastIndex],
    beatIndex: lastIndex,
    beatProgress: 1,
    progress: 1,
    finished: true,
  }
}

export function assertOriginFilmsCoverAllHeroes(): void {
  for (const heroClassId of HERO_CLASS_IDS) {
    if (!HERO_ORIGIN_FILMS[heroClassId]) {
      throw new Error(`Missing origin film for hero class ${heroClassId}`)
    }
  }
}
