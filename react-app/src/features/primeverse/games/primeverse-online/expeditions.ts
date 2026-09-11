import type { PortalId } from './shared/realms'

export interface PrimeverseExpedition {
  readonly id: 'ulam-rift' | 'euclid-siege' | 'sieve-catacombs' | 'nucleus-257' | 'primebound'
  readonly portalId: PortalId
  readonly title: string
  readonly overline: string
  readonly genre: string
  readonly objective: string
  readonly path: string
  readonly accent: string
  readonly glyph: string
}

export const PRIMEVERSE_EXPEDITIONS: readonly PrimeverseExpedition[] = Object.freeze([
  {
    id: 'ulam-rift',
    portalId: 'portal-ulam',
    title: 'Fenda de Ulam',
    overline: 'EXPEDIÇÃO 01',
    genre: 'Corrida e exploração vertical',
    objective: 'Atravesse setores suspensos e reconstrua a sequência prima.',
    path: '/jogos/fenda-de-ulam',
    accent: '#ff6ec7',
    glyph: '↟',
  },
  {
    id: 'euclid-siege',
    portalId: 'portal-forge',
    title: 'Cerco de Euclides',
    overline: 'EXPEDIÇÃO 02',
    genre: 'Ação e defesa da forja',
    objective: 'Fatore os escudos compostos e mantenha o reator vivo.',
    path: '/jogos/cerco-de-euclides',
    accent: '#ffba6c',
    glyph: '×',
  },
  {
    id: 'sieve-catacombs',
    portalId: 'portal-catacombs',
    title: 'Cripta do Crivo',
    overline: 'EXPEDIÇÃO 03',
    genre: 'Survival horror matemático',
    objective: 'Use o Crivo, preserve a lanterna e encontre a saída.',
    path: '/jogos/cripta-do-crivo',
    accent: '#9bf0bd',
    glyph: '⦿',
  },
  {
    id: 'nucleus-257',
    portalId: 'portal-nucleus',
    title: 'Núcleo 257',
    overline: 'EXPEDIÇÃO 04',
    genre: 'Arena FPS de superpoderes',
    objective: 'Domine 2, 3, 5 e 7 enquanto enfrenta operadores rivais.',
    path: '/jogos/nucleo-257',
    accent: '#58f5b5',
    glyph: '257',
  },
  {
    id: 'primebound',
    portalId: 'portal-primebound',
    title: 'Primebound: O Último Primo',
    overline: 'EXPEDIÇÃO 05',
    genre: 'Aventura pixel cooperativa',
    objective: 'Desperte as runas primas ao lado dos seus aliados.',
    path: '/jogos/primebound',
    accent: '#f2c15c',
    glyph: '†',
  },
])

export const EXPEDITION_BY_PORTAL = Object.freeze(
  Object.fromEntries(PRIMEVERSE_EXPEDITIONS.map((expedition) => [expedition.portalId, expedition])) as Partial<
    Record<PortalId, PrimeverseExpedition>
  >,
)
