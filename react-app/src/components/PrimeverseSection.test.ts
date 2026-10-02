import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('PrimeverseSection on landing page', () => {
  const componentPath = path.resolve(__dirname, 'PrimeverseSection.jsx')
  const cssPath = path.resolve(__dirname, 'PrimeverseSection.css')
  const landingPagePath = path.resolve(__dirname, '../pages/LandingPage.jsx')

  it('is placed directly below RsaGame in LandingPage', () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf-8')
    const rsaIndex = landingContent.indexOf('<RsaGame />')
    const primeverseIndex = landingContent.indexOf('<PrimeverseSection />')
    const missionIndex = landingContent.indexOf('<Mission />')

    expect(rsaIndex).toBeGreaterThan(-1)
    expect(primeverseIndex).toBeGreaterThan(-1)
    expect(primeverseIndex).toBeGreaterThan(rsaIndex)
    expect(missionIndex).toBeGreaterThan(primeverseIndex)
  })

  it('explains what Primeverse is in one sentence before any details', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')
    const leadSentenceMatch = componentContent.match(
      /<p className="primeverse-lead-sentence">([\s\S]*?)<\/p>/
    )

    expect(leadSentenceMatch).not.toBeNull()
    const leadSentence = leadSentenceMatch![1].trim()

    // Check that it's a single sentence explaining what Primeverse is
    expect(leadSentence).toMatch(/^O Primeverse é .*?\.$/)
    expect(leadSentence).toContain('portal de jogos matemáticos')
    expect(leadSentence).toContain('números primos')
    expect(leadSentence).toContain('criptografia')
  })

  it('derives game count dynamically from PRIMEVERSE_GAMES.length', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    // Must import PRIMEVERSE_GAMES
    expect(componentContent).toContain("import { PRIMEVERSE_GAMES } from '../features/primeverse/catalog'")
    expect(componentContent).toContain('PRIMEVERSE_GAMES.length')

    // Must not contain hardcoded "12 jogos" or "doze jogos"
    expect(componentContent).not.toMatch(/\b12 jogos\b/i)
    expect(componentContent).not.toMatch(/\bdoze jogos\b/i)
  })

  it('considers additional games and expeditions inside Primeverse Online', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    // Must reference expeditions inside Primeverse Online
    expect(componentContent).toContain('PRIMEVERSE_EXPEDITIONS')
    expect(componentContent).toContain('Primeverse Online')
    expect(componentContent).toContain('Cripta do Crivo')
    expect(componentContent).toContain('Cerco de Euclides')
    expect(componentContent).toContain('Fenda de Ulam')
  })

  it('displays only three games chosen randomly in the highlights', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    // Picks 3 random games
    expect(componentContent).toContain('pickRandomGames(PRIMEVERSE_GAMES, 3)')
    expect(componentContent).toContain('Math.random()')
  })

  it('does not display the shuffle button and does not display conceito in cards', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    // No shuffle button
    expect(componentContent).not.toContain('primeverse-shuffle-btn')
    expect(componentContent).not.toContain('Sortear outros')

    // No "conceito" in cards
    expect(componentContent).not.toContain('primeverse-math-pill')
    expect(componentContent).not.toContain('Conceito:')
  })

  it('removes the count number from the final cta heading', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    expect(componentContent).toContain('Descubra todas as experiências no portal.')
    expect(componentContent).not.toMatch(/Descubra todas as \d+ experiências no portal\./)
    expect(componentContent).not.toMatch(/Descubra todas as \{totalGames\} experiências no portal\./)
  })

  it('does not underline game names in Nexus Online banner to avoid hyperlink appearance', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    expect(cssContent).toContain('.primeverse-online-banner-desc em')
    expect(cssContent).toContain('text-decoration: none')
    expect(cssContent).not.toContain('text-decoration: underline')
  })

  it('provides a clear navigation route to /jogos', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf-8')

    // Must link to /jogos
    expect(componentContent).toContain('to="/jogos"')
  })

  it('includes responsive rules for mobile 390x844 without horizontal scroll', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    expect(cssContent).toContain('overflow: hidden')
    expect(cssContent).toContain('@media (max-width: 640px)')
    expect(cssContent).toContain('@media (max-width: 480px)')
    // Verifies single column layout on mobile
    expect(cssContent).toMatch(/grid-template-columns:\s*1fr/)
  })
})
