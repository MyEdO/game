// La déclaration du corps d'une base validée contre la donnée (#3106) : `lireDeclaration`, `jugerDeclaration`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { jugerDeclaration, lireDeclaration } from './declaration.mjs'

const HUMANOIDE = fileURLToPath(new URL('./humanoide.json', import.meta.url))

/** `humanoide.json` au porteur surchargé par `porteur`, jugé sous le nom `<nom>.json`. */
function jugerAvec(nom, porteur, lireDonnee) {
  const declaration = JSON.parse(readFileSync(HUMANOIDE, 'utf8'))
  return jugerDeclaration({ ...declaration, porteur: { ...declaration.porteur, ...porteur } }, `${nom}.json`, lireDonnee)
}

describe('lireDeclaration', () => {
  it('accepte la déclaration de la base humanoïde', async () => {
    assert.equal((await lireDeclaration(HUMANOIDE)).porteur.race, 'humain')
  })

  it('refuse une Taille que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(jugerAvec('taille', { taille: 'grande' }), /porteur\.taille grande, la donnée donne moyenne à la race humain/)
  })

  it('refuse une race dont la donnée ne détermine pas la Taille, en nommant champ, déclaré et race', async () => {
    await assert.rejects(jugerAvec('sans-espece', { race: 'orc' }), /porteur\.taille moyenne, Taille de la race orc indéterminée dans la donnée \(aucune espèce\)/)
  })

  it('refuse une race à plusieurs Tailles dans la donnée, en les nommant', async () => {
    const donnee = { raceAppearance: [{ id: 'humain' }], gabarits: [{ id: 'moyen' }], taillesDeLaRace: () => ['moyenne', 'grande'], speciesScale: () => 1 }
    await assert.rejects(jugerAvec('deux-tailles', { race: 'humain', gabarit: 'moyen' }, async () => donnee), /porteur\.taille moyenne, Taille de la race humain indéterminée dans la donnée \(moyenne, grande\)/)
  })

  it('refuse une échelle d’art que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(jugerAvec('echelle', { echelleDArt: 1.2 }), /porteur\.echelleDArt 1\.2, la donnée donne 1 à la race humain/)
  })
})
