// `collisionsDeCompteurs` (#2222) : la branche ET le tronc changent un compteur depuis leur base.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COMPTEURS, CompteurIllisible, FICHIERS_DES_COMPTEURS, collisionsDeCompteurs, messageDeCollision, valeurDuCompteur } from './compteursDeVersion.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const SAVES = COMPTEURS.find((c) => c.symbole === 'SAVE_VERSION')
const PROJET = COMPTEURS.find((c) => c.symbole === 'SCHEMA_PROJET')

/** Les textes d'une révision où `SAVE_VERSION` vaut `saves` et `SCHEMA_PROJET` vaut `projet`. */
const revision = (saves, projet) => new Map([
  [SAVES.fichier, `// entête\nexport const SAVE_VERSION = ${saves};\nexport const AUTRE = 3;\n`],
  [PROJET.fichier, `export const SCHEMA_PROJET = ${projet}\n`],
])

test('chaque compteur déclaré se lit à son site RÉEL', () => {
  for (const compteur of COMPTEURS) {
    const valeur = valeurDuCompteur(readFileSync(`${RACINE}/${compteur.fichier}`, 'utf8'), compteur, 'arbre')
    assert.ok(Number.isSafeInteger(valeur) && valeur > 0, `${compteur.symbole} = ${valeur}`)
  }
  assert.deepEqual([...FICHIERS_DES_COMPTEURS].sort(), COMPTEURS.map((c) => c.fichier).sort())
})

test('aucun changement : aucune collision', () => {
  assert.deepEqual(collisionsDeCompteurs({ base: revision(60, 17), branche: revision(60, 17), tronc: revision(60, 17) }), [])
})

test('la branche ET le tronc montent SAVE_VERSION : collision nommée, SCHEMA_PROJET intact', () => {
  const vu = collisionsDeCompteurs({ base: revision(60, 17), branche: revision(61, 17), tronc: revision(61, 17) })
  assert.deepEqual(vu, [{ ...SAVES, base: 60, branche: 61, tronc: 61 }])
  assert.equal(messageDeCollision(vu[0]), '`SAVE_VERSION` : main est passé à 61 depuis ta base, la tienne doit viser 62 et rejouer sa migration/son golden')
})

test('SYMÉTRIQUE : branche et tronc échangés, les mêmes compteurs en collision', () => {
  const [a, b] = [revision(61, 18), revision(62, 17)]
  const symboles = (vu) => vu.map((c) => c.symbole)
  assert.deepEqual(symboles(collisionsDeCompteurs({ base: revision(60, 17), branche: a, tronc: b })), ['SAVE_VERSION'])
  assert.deepEqual(symboles(collisionsDeCompteurs({ base: revision(60, 17), branche: b, tronc: a })), ['SAVE_VERSION'])
})

test('seule la branche monte : aucune collision', () => {
  assert.deepEqual(collisionsDeCompteurs({ base: revision(60, 17), branche: revision(61, 18), tronc: revision(60, 17) }), [])
})

test('seul le tronc monte : aucune collision', () => {
  assert.deepEqual(collisionsDeCompteurs({ base: revision(60, 17), branche: revision(60, 17), tronc: revision(61, 18) }), [])
})

test('compteur illisible : erreur qui nomme le symbole, la révision et le fichier', () => {
  const absent = new Map([[SAVES.fichier, null], [PROJET.fichier, 'export const SCHEMA_PROJET = 17\n']])
  assert.throws(
    () => collisionsDeCompteurs({ base: revision(60, 17), branche: absent, tronc: revision(60, 17) }),
    (e) => e instanceof CompteurIllisible && e.message === '`SAVE_VERSION` illisible à la révision branche (src/state/saves.ts) : fichier absent',
  )
  const double = revision(60, 17)
  double.set(PROJET.fichier, 'export const SCHEMA_PROJET = 17\nexport const SCHEMA_PROJET = 18\n')
  assert.throws(
    () => collisionsDeCompteurs({ base: revision(60, 17), branche: revision(60, 17), tronc: double }),
    (e) => e instanceof CompteurIllisible && /`SCHEMA_PROJET` illisible à la révision tronc .*2 ligne\(s\)/.test(e.message),
  )
  const calcule = revision(60, 17)
  calcule.set(SAVES.fichier, 'export const SAVE_VERSION = BASE + 1\n')
  assert.throws(() => collisionsDeCompteurs({ base: calcule, branche: revision(60, 17), tronc: revision(60, 17) }), CompteurIllisible)
})
