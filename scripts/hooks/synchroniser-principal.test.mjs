// node --test scripts/hooks/synchroniser-principal.test.mjs
// Le hook SessionStart Codex de synchronisation du principal (#2187, #2493) : le `texte` de l'état reçu de la
// CLI, ou, sans état lisible, la cause et la re-mesure du principal (`--mesurer --json`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { texteDuLancement } from './synchroniser-principal.mjs'

/** La sortie de la CLI pour l'état `vu` et son `texte` (`texteDeSession`, `scripts/ops/synchroniser.mjs`). */
const sortie = (vu, texte = '') => ({ stdout: `${JSON.stringify({ ...vu, texte })}\n`, status: vu.etat === 'avance' || vu.etat === 'a-jour' ? 0 : 1 })
const pas = { mesurer: () => assert.fail('aucune re-mesure quand l’état est lisible') }

test('`a-jour` et `avance` sans consommateur ni configuration : rien à dire', () => {
  assert.equal(texteDuLancement(sortie({ etat: 'a-jour', sha: 'a'.repeat(40) }), pas), '')
  assert.equal(texteDuLancement(sortie({ etat: 'avance', de: 'a'.repeat(40), vers: 'b'.repeat(40), configurationClientChangee: [] }), pas), '')
})

test('tout autre état : le `texte` de la CLI, tel quel', () => {
  const conflit = '[synchroniser] principal refusé (conflit) : x — reprise : `npm run ops:synchroniser`'
  assert.equal(texteDuLancement(sortie({ etat: 'conflit', chemins: [{ chemin: 'x', raison: 'r' }], versions: '/v' }, conflit), pas), conflit)
  const enFond = '[synchroniser] principal avancé de aaaaaaaaa à bbbbbbbbb ; post-merge aaaaaaaaa..bbbbbbbbb en fond : PID 7 depuis 2026-10-08T10:00:00.000Z (3 s), issue : /l/7.log'
  assert.equal(texteDuLancement(sortie({ etat: 'avance', de: 'a'.repeat(40), vers: 'b'.repeat(40), configurationClientChangee: [] }, enFond), pas), enFond)
})

test('aucun état lisible (CLI tuée, sortie vide) : la cause et la re-mesure, jamais une exception', () => {
  const ligne = 'interrompu : avance aaaaaaaaa..bbbbbbbbb entamée (étape avance), HEAD bbbbbbbbb — reprise due (journal /j)'
  const mesure = { stdout: JSON.stringify({ etat: 'interrompu', mesure: true, ligne, texte: `[synchroniser] principal ${ligne}` }), status: 1 }
  assert.equal(texteDuLancement({ stdout: '', status: null, signal: 'SIGTERM', error: new Error('spawnSync node ETIMEDOUT') }, { mesurer: () => mesure }),
    `[synchroniser] principal : synchroniseur sorti sans état (spawnSync node ETIMEDOUT) ; re-mesure : ${ligne} — reprise : \`npm run ops:synchroniser\``)
  assert.equal(texteDuLancement({ stdout: 'pas du json', status: 2 }, { mesurer: () => ({ stdout: '', status: null, signal: 'SIGKILL' }) }),
    '[synchroniser] principal : synchroniseur sorti sans état (code 2) ; re-mesure : code null signal SIGKILL — reprise : `npm run ops:synchroniser`')
})
