// La déclaration du corps d'une base validée contre la donnée (#3106) : `lireDeclaration`, `jugerDeclaration` ; sa part
// du manifeste de base (#3253) : `champsDeclares`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { champsDeclares, jugerDeclaration, lireDeclaration } from './declaration.mjs'

const HUMANOIDE = fileURLToPath(new URL('./humanoide.json', import.meta.url))

/** `humanoide.json` au porteur surchargé par `porteur`, jugé sous le nom `<nom>.json`. */
function jugerAvec(nom, porteur, lireDonnee) {
  const declaration = JSON.parse(readFileSync(HUMANOIDE, 'utf8'))
  return jugerDeclaration({ ...declaration, porteur: { ...declaration.porteur, ...porteur } }, `${nom}.json`, lireDonnee)
}

describe('lireDeclaration', () => {
  it('accepte la déclaration de la base humanoïde', async () => {
    assert.equal((await lireDeclaration(HUMANOIDE)).porteur.espece, 'humain')
  })

  it('refuse une déclaration sans clip du rôle `walk`, en nommant le champ', async () => {
    const declaration = JSON.parse(readFileSync(HUMANOIDE, 'utf8'))
    await assert.rejects(jugerDeclaration({ ...declaration, clips: { idle: 'Idle_Loop' } }, 'sans-marche.json'), /^Error: sans-marche\.json : clips\.walk, nom de clip attendu$/)
  })

  it('refuse une Taille que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(jugerAvec('taille', { taille: 'grande' }), /porteur\.taille grande, la donnée donne moyenne à la race humain/)
  })

  it('refuse une espèce dont la donnée ne détermine pas la Taille de la race, en nommant champ, déclaré et race', async () => {
    await assert.rejects(jugerAvec('sans-espece', { espece: 'orc' }), /porteur\.taille moyenne, Taille de la race orc indéterminée dans la donnée \(aucune espèce\)/)
  })

  it('refuse une race à plusieurs Tailles dans la donnée, en les nommant', async () => {
    const donnee = { planDeBestiaire: [{ id: 'humain', race: { id: 'humain' }, echelle: 1 }], gabarits: [{ id: 'moyen' }], taillesDeLaRace: () => ['moyenne', 'grande'] }
    await assert.rejects(jugerAvec('deux-tailles', { espece: 'humain', gabarit: 'moyen' }, async () => donnee), /porteur\.taille moyenne, Taille de la race humain indéterminée dans la donnée \(moyenne, grande\)/)
  })

  it('refuse une échelle d’art que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(jugerAvec('echelle', { echelleDArt: 1.2 }), /porteur\.echelleDArt 1\.2, la donnée donne 1 à l'espèce humain/)
  })

  it('juge l’échelle d’art contre l’`echelle` de l’espèce au plan de bestiaire', async () => {
    const donnee = { planDeBestiaire: [{ id: 'humain', race: { id: 'humain' }, echelle: 1.2 }], gabarits: [{ id: 'moyen' }], taillesDeLaRace: () => ['moyenne'] }
    await assert.rejects(jugerAvec('echelle-d-espece', { espece: 'humain', gabarit: 'moyen' }, async () => donnee), /porteur\.echelleDArt 1, la donnée donne 1\.2 à l'espèce humain/)
  })

  it('refuse une espèce que le plan de bestiaire ne porte pas sur la base humanoïde, en nommant champ et déclaré', async () => {
    await assert.rejects(jugerAvec('corps-de-creature', { espece: 'loup' }), /porteur\.espece loup, le plan de bestiaire ne la porte pas sur la base humanoïde/)
  })
})

describe('champsDeclares', () => {
  const porteur = { espece: 'humain', gabarit: 'moyen', taille: 'moyenne', echelleDArt: 1 }
  const clips = { walk: 'Marche', idle: 'Repos', melee: 'Taille' }

  it('écrit au manifeste la base, le porteur et la table rôle → clip de la déclaration, et rien d’autre', () => {
    assert.deepEqual(champsDeclares({ base: 'corps', porteur, clips, autre: 1 }), { base: 'corps', porteur, clips })
  })

  it('y ajoute les surfaces déclarées', () => {
    const surfaces = [{ nom: 'Peau', palette: 'peau' }]
    assert.deepEqual(champsDeclares({ base: 'corps', porteur, clips, surfaces }), { base: 'corps', porteur, clips, surfaces })
  })
})
