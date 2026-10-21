/**
 * `mesurerCanaux` — c'est le TYPE déclaré qui décide du canal, jamais le nom du champ.
 * Banc sur sources FORGÉES (mkdtemp) : le rendu réel de la carte est gardé par `docs:check`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mesurerCanaux, canalDuMembre } from './canauxMecaniques.mjs'

function forger(nom, source) {
  const dir = mkdtempSync(join(tmpdir(), 'canaux-'))
  const f = join(dir, nom)
  writeFileSync(f, source, 'utf8')
  return f
}

test('les trois canaux sont relevés sur les DÉCLARATIONS de champs', () => {
  const f = forger('entite.ts', `
export interface FauxCapabilities { fumbleOn9?: boolean; crewedTeam?: boolean }
export interface FauxData {
  id: string;
  passive?: import('../engine/ops').GameOp[];
  effects?: import('../engine/flowCore').TriggeredEffect<Effect>[];
  capabilities?: FauxCapabilities;
}
`)
  const { entites, typesDrapeaux } = mesurerCanaux([f])
  const e = entites.find((x) => x.entite === 'FauxData')
  assert.ok(e, 'FauxData doit être mesurée')
  assert.equal(e.canaux.passive.champ, 'passive')
  assert.equal(e.canaux.effects.champ, 'effects')
  assert.equal(e.canaux.drapeaux.type, 'FauxCapabilities')
  assert.deepEqual(
    typesDrapeaux.map((t) => [t.nom, t.champs]),
    [['FauxCapabilities', ['fumbleOn9', 'crewedTeam']]],
  )
})

test('un champ au bon NOM mais au mauvais TYPE ne compte pour aucun canal', () => {
  const f = forger('homonymes.ts', `
export interface FauxSpell { effects?: import('../engine/flowCore').Flow<Effect> }
export interface FauxGroup { combat?: 'melee' | 'ranged' }
export interface FauxLibre { passive?: string }
`)
  const { entites, typesDrapeaux } = mesurerCanaux([f])
  assert.deepEqual(entites, [])
  assert.deepEqual(typesDrapeaux, [])
  assert.equal(canalDuMembre('effects', "import('../engine/flowCore').Flow<Effect>"), null)
  assert.equal(canalDuMembre('combat', "'melee' | 'ranged'"), null)
  assert.equal(canalDuMembre('combat', "import('../engine/combatFeatures/types').CombatFeature"), 'drapeaux')
})

test('une entité qui hérite déclare son héritage (les canaux du parent ne sont pas recopiés)', () => {
  const f = forger('heritage.ts', `
export interface Parent { passive?: import('./ops').GameOp[] }
export interface Enfant extends Parent { recover?: string }
`)
  const { entites } = mesurerCanaux([f])
  assert.deepEqual(entites.map((e) => e.entite), ['Parent'])
})
