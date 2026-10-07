// Bancs de la garde `fermeture-hors-commit` (`scripts/hooks/fermeture-hors-commit-guard.mjs`) : son
// évaluateur pur, puis le répartiteur réel (`lancerHook`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { evaluateFermetureHorsCommit } from './fermeture-hors-commit-guard.mjs'

// ── Fermeture HORS commit ─────────────────────────────────────────────────────────────────────────
test('evaluateFermetureHorsCommit : `gh issue close` refusé, y compris derrière un sous-shell', () => {
  for (const cmd of [
    'gh issue close 1636 --comment "fait"',
    'bash -lc "gh issue close 1636"',
    'gh issue edit 1636 --state closed',
    `gh api repos/${DEPOT}/issues/1636 -X PATCH -f state=closed`,
    `gh api repos/${DEPOT}/issues/1636 --method PATCH --field state=closed`,
  ]) {
    const d = evaluateFermetureHorsCommit(cmd)
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.deepEqual(Object.keys(d), ['reason'])
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : silence sur ce qui ne ferme pas', () => {
  for (const cmd of [
    'gh issue create --title "x" --body-file b.md',
    'gh issue view 1636 --json state',
    'gh issue edit 1636 --add-label bug',
    'git commit -m "corrige #1636"',
  ]) {
    assert.equal(evaluateFermetureHorsCommit(cmd), null, `mordu à tort : ${cmd}`)
  }
})

// ── `gh api --input <fichier>` : le corps de la requête est LU (abstention D6/a levée) ───────────
test('evaluateFermetureHorsCommit : un corps `--input` porteur de "state": "closed" est refusé', () => {
  const lire = () => JSON.stringify({ state: 'closed', state_reason: 'completed' })
  for (const cmd of [
    `gh api -X PATCH /repos/${DEPOT}/issues/1679 --input corps.json`,
    'gh api --method PATCH /repos/o/r/issues/1 --input=corps.json',
    'bash -lc "gh api -X PATCH /repos/o/r/issues/1 --input corps.json"',
  ]) {
    const d = evaluateFermetureHorsCommit(cmd, { lire })
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.deepEqual(Object.keys(d), ['reason'])
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : les gestes `--input` qui ne peuvent pas FERMER passent en silence', () => {
  // Au PreToolUse le corps est souvent écrit APRÈS (par la commande elle-même) : refuser sur un
  // fichier absent mordrait 4 gestes routiniers (sonde J4). Le corps n'est lu que sur l'endpoint
  // d'UN ticket et une méthode qui ÉCRIT.
  const absent = () => { throw new Error('ENOENT') }
  for (const cmd of [
    `gh api repos/${DEPOT}/issues --input body.json`,
    'gh api graphql --input query.json',
    'gh api repos/o/r/issues --input filtre.json -X GET',
    'echo \'{"title":"x"}\' > body.json && gh api repos/o/r/issues --input body.json',
    'gh api repos/o/r/issues/1636 --input corps.json',
  ]) {
    assert.equal(evaluateFermetureHorsCommit(cmd, { lire: absent }), null, `mordu à tort : ${cmd}`)
  }
})

test('evaluateFermetureHorsCommit : un corps `--input` qui ne ferme pas passe ; `--input -` est HORS PORTÉE', () => {
  const ouvert = () => JSON.stringify({ body: 'commentaire' })
  assert.equal(evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input corps.json', { lire: ouvert }), null)
  // stdin : le corps n'existe nulle part avant l'exécution — silence DIT, jamais un refus muet.
  assert.equal(evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input -', {
    lire: () => { throw new Error('jamais lu') },
  }), null)
})

test('evaluateFermetureHorsCommit : sur l\'endpoint d\'UN ticket, un corps ILLISIBLE est refusé (fail-closed)', () => {
  const d = evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input absent.json', {
    lire: () => { throw new Error('ENOENT') },
  })
  assert.deepEqual(Object.keys(d ?? {}), ['reason'])
  assert.match(d.reason, /illisible ou non-JSON/)
  assert.match(d.reason, /absent\.json/)
})

test('répartiteur : `gh issue close` est refusé par la garde `fermeture-hors-commit`', () => {
  const { specifique } = lancerHook('repartiteur.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh issue close 1' } })
  assert.equal(specifique?.permissionDecision, 'deny')
  assert.match(specifique.permissionDecisionReason, /Fermeture de ticket HORS commit \(gh issue close\)/)
})
