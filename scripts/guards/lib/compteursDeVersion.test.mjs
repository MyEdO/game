// `lectureDuCompteur`, `collisionDuCompteur` (#2222) : la valeur que la tête publie, déjà PRISE par le tronc.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COMPTEURS, CompteurIllisible, FICHIERS_DES_COMPTEURS, collisionDuCompteur, lectureDuCompteur, messageDeCollision } from './compteursDeVersion.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const SAVES = COMPTEURS.find((c) => c.symbole === 'SAVE_VERSION')

test('chaque compteur déclaré se lit à son site RÉEL', () => {
  for (const compteur of COMPTEURS) {
    const { valeur, ligne } = lectureDuCompteur(readFileSync(`${RACINE}/${compteur.fichier}`, 'utf8'), compteur, 'arbre')
    assert.ok(Number.isSafeInteger(valeur) && valeur > 0, `${compteur.symbole} = ${valeur}`)
    assert.ok(Number.isSafeInteger(ligne) && ligne > 0, `${compteur.symbole} ligne ${ligne}`)
  }
  assert.deepEqual([...FICHIERS_DES_COMPTEURS].sort(), [...new Set(COMPTEURS.map((c) => c.fichier))].sort())
})

test('lectureDuCompteur : la valeur et le numéro de ligne, CRLF compris', () => {
  assert.deepEqual(lectureDuCompteur('// entête\r\nexport const SAVE_VERSION = 61;\r\nexport const AUTRE = 3;\r\n', SAVES, 'tete'), { valeur: 61, ligne: 2 })
  assert.deepEqual(lectureDuCompteur('export const SAVE_VERSION = 7', SAVES, 'tete'), { valeur: 7, ligne: 1 })
})

test('compteur illisible : erreur qui nomme le symbole, la révision et le fichier', () => {
  assert.throws(() => lectureDuCompteur(null, SAVES, 'origin/main'),
    (e) => e instanceof CompteurIllisible && e.message === '`SAVE_VERSION` illisible à la révision origin/main (src/state/saves.ts) : fichier absent')
  assert.throws(() => lectureDuCompteur('export const SAVE_VERSION = 60\nexport const SAVE_VERSION = 61\n', SAVES, 'HEAD'),
    (e) => e instanceof CompteurIllisible && /`SAVE_VERSION` illisible à la révision HEAD .*2 ligne\(s\)/.test(e.message))
  assert.throws(() => lectureDuCompteur('export const SAVE_VERSION = BASE + 1\n', SAVES, 'HEAD'), CompteurIllisible)
})

/** Les faits d'une tête qui publie `publiee`, écrite par la branche, sur un tronc à `tronc`, partie de `depart`. */
const faits = (publiee, tronc, depart, ecriteParLaBranche = true) => ({ publiee, tronc, depart, ecriteParLaBranche })

test('collisionDuCompteur : la valeur publiée, écrite par la branche, neuve depuis le départ et atteinte par le tronc, est PRISE', () => {
  assert.deepEqual(collisionDuCompteur(SAVES, faits(61, 61, 60)), { ...SAVES, publiee: 61, tronc: 61, depart: 60 })
  assert.deepEqual(collisionDuCompteur(SAVES, faits(59, 61, 58)), { ...SAVES, publiee: 59, tronc: 61, depart: 58 })
})

test('collisionDuCompteur : au-dessus du tronc, reçue du tronc, ou revenue au départ — aucune collision', () => {
  assert.equal(collisionDuCompteur(SAVES, faits(62, 61, 60)), null)
  assert.equal(collisionDuCompteur(SAVES, faits(61, 61, 60, false)), null)
  assert.equal(collisionDuCompteur(SAVES, faits(60, 61, 60)), null)
})

test('messageDeCollision nomme la valeur publiée, celle de main et la prochaine libre', () => {
  assert.equal(messageDeCollision({ symbole: 'SAVE_VERSION', publiee: 59, tronc: 61 }),
    '`SAVE_VERSION` : la branche publie 59, déjà prise par main (à 61) — prochaine libre : 62, à renuméroter avec sa migration/son golden')
})
