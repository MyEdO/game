// `valeurDuCompteur`, `monteeParLaBranche`, `collisionDuCompteur` (#2222) : la valeur que la tête publie, déjà PRISE par le tronc.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COMPTEURS, CompteurIllisible, FICHIERS_DES_COMPTEURS, collisionDuCompteur, messageDeCollision, monteeParLaBranche, valeurDuCompteur } from './compteursDeVersion.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const SAVES = COMPTEURS.find((c) => c.symbole === 'SAVE_VERSION')

test('chaque compteur déclaré se lit à son site RÉEL', () => {
  for (const compteur of COMPTEURS) {
    const valeur = valeurDuCompteur(readFileSync(`${RACINE}/${compteur.fichier}`, 'utf8'), compteur, 'arbre')
    assert.ok(Number.isSafeInteger(valeur) && valeur > 0, `${compteur.symbole} = ${valeur}`)
  }
  assert.deepEqual([...FICHIERS_DES_COMPTEURS].sort(), [...new Set(COMPTEURS.map((c) => c.fichier))].sort())
})

test('valeurDuCompteur : la valeur, CRLF compris', () => {
  assert.equal(valeurDuCompteur('// entête\r\nexport const SAVE_VERSION = 61;\r\nexport const AUTRE = 3;\r\n', SAVES, 'tete'), 61)
  assert.equal(valeurDuCompteur('export const SAVE_VERSION = 7', SAVES, 'tete'), 7)
})

test('compteur illisible : erreur qui nomme le symbole, la révision et le fichier', () => {
  assert.throws(() => valeurDuCompteur(null, SAVES, 'origin/main'),
    (e) => e instanceof CompteurIllisible && e.message === '`SAVE_VERSION` illisible à la révision origin/main (src/state/saves.ts) : fichier absent')
  assert.throws(() => valeurDuCompteur('export const SAVE_VERSION = 60\nexport const SAVE_VERSION = 61\n', SAVES, 'HEAD'),
    (e) => e instanceof CompteurIllisible && /`SAVE_VERSION` illisible à la révision HEAD .*2 ligne\(s\)/.test(e.message))
  assert.throws(() => valeurDuCompteur('export const SAVE_VERSION = BASE + 1\n', SAVES, 'HEAD'), CompteurIllisible)
})

test('monteeParLaBranche : un commit propre qui change la VALEUR, ou une fusion qui rend une valeur absente de ses parents', () => {
  assert.equal(monteeParLaBranche({ propres: [{ avant: 60, apres: 61 }], fusions: [] }), true)
  assert.equal(monteeParLaBranche({ propres: [], fusions: [{ valeur: 62, parents: [61, 61] }] }), true)
  assert.equal(monteeParLaBranche({ propres: [{ avant: 61, apres: 61 }], fusions: [{ valeur: 61, parents: [60, 61] }] }), false, 'reformatage, fusion qui reçoit le tronc')
  assert.equal(monteeParLaBranche({ propres: [], fusions: [] }), false)
})

/** Les faits d'une tête qui publie `publiee` sur un tronc à `tronc`, partie de `depart`. */
const faits = (publiee, tronc, depart, montee = true) => ({ publiee, tronc, depart, montee })

test('collisionDuCompteur : montée par la branche ET par le tronc, publiée sans dépasser le tronc — PRISE', () => {
  assert.deepEqual(collisionDuCompteur(SAVES, faits(61, 61, 60)), { ...SAVES, publiee: 61, tronc: 61, depart: 60 })
  assert.deepEqual(collisionDuCompteur(SAVES, faits(59, 61, 58)), { ...SAVES, publiee: 59, tronc: 61, depart: 58 })
})

test('collisionDuCompteur : au-dessus du tronc, sans montée de la branche, ou tronc inchangé — aucune collision', () => {
  assert.equal(collisionDuCompteur(SAVES, faits(62, 61, 60)), null)
  assert.equal(collisionDuCompteur(SAVES, faits(61, 61, 60, false)), null)
  assert.equal(collisionDuCompteur(SAVES, faits(61, 60, 60)), null)
})

test('messageDeCollision nomme la valeur publiée, celle de main et la prochaine libre', () => {
  assert.equal(messageDeCollision({ symbole: 'SAVE_VERSION', publiee: 59, tronc: 61 }),
    '`SAVE_VERSION` : la branche publie 59, déjà prise par main (à 61) — prochaine libre : 62, à renuméroter avec sa migration/son golden')
})
