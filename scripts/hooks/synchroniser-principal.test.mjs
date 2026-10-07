// node --test scripts/hooks/synchroniser-principal.test.mjs
// Le hook SessionStart Codex de synchronisation du principal (#2187) : l'état reçu de la CLI, rendu tel
// quel à la session quand il n'est pas muet (`texteDeSynchro`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { texteDeSynchro } from './synchroniser-principal.mjs'

const sortie = (vu) => ({ stdout: `${JSON.stringify(vu)}\n`, status: vu.etat === 'avance' || vu.etat === 'a-jour' ? 0 : 1 })

test('`a-jour` et `avance` : rien à dire', () => {
  assert.equal(texteDeSynchro(sortie({ etat: 'a-jour', sha: 'a' })), '')
  assert.equal(texteDeSynchro(sortie({ etat: 'avance', de: 'a', vers: 'b', configurationClientChangee: [] })), '')
})

test('tout autre état : rendu TEL QUEL, avec la reprise', () => {
  for (const vu of [
    { etat: 'avance-non-prete', de: 'a', vers: 'b', code: 1 },
    { etat: 'conflit', chemins: [{ chemin: 'x', raison: 'r' }], versions: '/v' },
    { etat: 'interrompu', raison: 'r', journal: '/j', verrous: ['/i'] },
  ]) assert.equal(texteDeSynchro(sortie(vu)), `[synchroniser] principal : ${JSON.stringify(vu)} — reprise : \`npm run ops:synchroniser\``)
})

test('configuration client changée : même `avance` parle, et nomme les chemins de la configuration d’avant (#2187 commentaire 6029118597, C4)', () => {
  const avance = { etat: 'avance', de: 'a', vers: 'b', configurationClientChangee: ['.claude/settings.json', '.codex/hooks.json'] }
  assert.equal(texteDeSynchro(sortie(avance)),
    `[synchroniser] principal : ${JSON.stringify(avance)} — la session tourne sur la configuration d'avant : .claude/settings.json, .codex/hooks.json`)
  const nonPrete = { etat: 'avance-non-prete', de: 'a', vers: 'b', code: 1, configurationClientChangee: ['.claude/settings.json'] }
  assert.equal(texteDeSynchro(sortie(nonPrete)),
    `[synchroniser] principal : ${JSON.stringify(nonPrete)} — la session tourne sur la configuration d'avant : .claude/settings.json — reprise : \`npm run ops:synchroniser\``)
})

test('aucun état lisible (CLI tuée, sortie vide) : dit, jamais une exception', () => {
  assert.match(texteDeSynchro({ stdout: '', status: null, error: new Error('spawnSync node ETIMEDOUT') }), /aucun état lisible \(spawnSync node ETIMEDOUT\)/)
  assert.match(texteDeSynchro({ stdout: 'pas du json', status: 2 }), /aucun état lisible \(code 2\)/)
})
