// Contrat du verrou « un `codeur` ne joue pas les gates de la CI ».
// POURQUOI — verbatims utilisateur du 2026-09-15 :
//   « C'est absurde ... on a dépêché un agent pour créer un fichier (+ son test, + le lien pour
//     l'appeler) et ça va nous prendre 25 min ? »
//   « La mémoire c'est cool mais ça n'empêche pas de réitérer la même erreur plus tard »
// Le sujet est la FRONTIÈRE : le test du PÉRIMÈTRE passe, la gate que la CI joue est refusée. Les cas
// jouent la fonction PURE avec une liste de gates INJECTÉE — un test qui lirait `ECRIT_LU` mesurerait
// un cardinal vivant. UN cas, nommé, prouve séparément que le hook lit bien cette table réelle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evaluate, gatesDeLaCi } from './codeur-gates-guard.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'codeur-gates-guard.mjs')

/** Sortie BRUTE du driver pour un payload de hook (stdin tel que l'hôte l'envoie). */
function sortieDriver(payload) {
  const run = spawnSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8', cwd: REPO })
  assert.equal(run.status, 0, `le hook a quitté en ${run.status} : ${run.stderr}`)
  return run.stdout
}

/** Payload PreToolUse d'un sous-agent (`agent_type` absent = session principale). */
const payload = (command, agentType) =>
  JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    ...(agentType === undefined ? {} : { agent_type: agentType }),
    tool_name: 'Bash',
    tool_input: { command },
  })

const GATES = ['lint', 'deps:unused', 'docs:check:tout', 'test:ops', 'typecheck']

/** La décision du hook pour un `codeur` (la liste de gates est injectée, jamais lue du dépôt). */
const pourCodeur = (commande) => evaluate({ agentType: 'codeur', commande, gates: GATES })

/** Commandes REFUSÉES : la gate est jouée une fois par le run CI de la branche. */
const REFUSEES = [
  'npm run lint',
  'npm test',
  'npm run deps:unused',
  // Gate dont la RÉSOLUTION n'est refusée par aucune autre règle
  // (`node scripts/docs/build-all.mjs --check --tout`) : seul son NOM, clé d'`ECRIT_LU`, la refuse.
  'npm run docs:check:tout',
  'npx vitest run',
  'npx tsc --noEmit',
  'npx eslint .',
  'npx knip',
  'node scripts/test/node-tests.mjs test:ops',
  'node scripts/gates/toutes.mjs',
  // Décision par SEGMENT : la gate cachée derrière un enchaînement est la même gate.
  'echo ok && npm run docs:check:tout',
  // Le REJEU LOCAL ENTIER : `gates` n'est pas une clé d'ECRIT_LU, c'est sa RÉSOLUTION
  // (`node scripts/gates/toutes.mjs`) qui le refuse — la promesse de `codeur.md` tient.
  'npm run gates',
  'npm run gates -- --serie',
  // Enrobages mesurés PASSANTS avant le socle partagé (#1768, sonde du juge de diff).
  'sh -c "npm run lint"',
  'bash -lc "npm test"',
  'pwsh -Command "npm run lint"',
  '(npm run lint)',
  'time npm run lint',
  'npm run --silent lint',
  'npm.cmd run lint',
  // Un dossier-gate reste un dossier-gate avec son slash final.
  'npx vitest run src/',
  // Un `cd` qui ne mène PAS au sous-projet server/ ne change aucune portée.
  'cd src && npm run lint',
]

/** Commandes PASSANTES : test du périmètre, porte incrémentale, lecture, outil hors gates. */
const PASSANTES = [
  'npm run typecheck:fast',
  'npx vitest run src/a.test.ts',
  'node --test scripts/ops/board.test.mjs',
  'npx eslint scripts/ops/board.mjs',
  'npm run ops:board -- --liste',
  'npm run agents:check',
  'npm test -- src/a.test.ts',
  // Le sous-projet `server/` a son propre tsconfig et ses propres scripts : les gates de la RACINE
  // n'y répondent pas, et son typecheck est le périmètre du codeur dépêché dessus.
  'cd server && npm run typecheck',
  'cd server; npm run lint',
  'npm --prefix server run typecheck',
  // Mention, pas appel.
  'grep "npm run lint" x.md',
]

for (const commande of REFUSEES) {
  test(`REFUS pour un codeur : ${commande}`, () => {
    const decision = pourCodeur(commande)
    assert.ok(decision, `aucun refus sur « ${commande} » — la gate du train passe`)
    assert.equal(decision.decision, 'deny')
    assert.match(decision.reason, /\[codeur\]/)
    assert.match(decision.reason, /BRIEF REFUSÉ : gates hors périmètre/)
  })
}

for (const commande of PASSANTES) {
  test(`PASSE pour un codeur : ${commande}`, () => {
    assert.equal(pourCodeur(commande), null, `refus parasite sur « ${commande} »`)
  })
}

test('un agent qui n’est PAS un codeur n’est jamais visé', () => {
  assert.equal(evaluate({ agentType: 'juge', commande: 'npm run lint', gates: GATES }), null)
  assert.equal(evaluate({ agentType: null, commande: 'npm run lint', gates: GATES }), null)
  assert.equal(evaluate({ commande: 'npm run lint', gates: GATES }), null)
})

test('la raison NOMME la commande refusée et le geste de remplacement', () => {
  const { reason } = pourCodeur('npm run lint')
  assert.match(reason, /« npm run lint »/)
  assert.match(reason, /le run de la branche la joue une fois sur la tête poussée/)
  assert.match(reason, /typecheck:fast/)
})

test('DRIVER : un refus rend le JSON exact attendu par le hook (deny + raison)', () => {
  const { hookSpecificOutput } = JSON.parse(sortieDriver(payload('npm run lint', 'codeur')))
  assert.equal(hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(hookSpecificOutput.permissionDecision, 'deny')
  assert.match(hookSpecificOutput.permissionDecisionReason, /\[codeur\]/)
  assert.deepEqual(
    Object.keys(hookSpecificOutput).sort(),
    ['hookEventName', 'permissionDecision', 'permissionDecisionReason'],
  )
})

test('DRIVER : silence (aucune sortie) hors du cas visé, et jamais une sortie non nulle', () => {
  assert.equal(sortieDriver(payload('npm run lint')).trim(), '', 'session principale : pas d’agent_type')
  assert.equal(sortieDriver(payload('npm run lint', 'juge')).trim(), '', 'un juge ne joue pas de gate')
  assert.equal(sortieDriver(payload('node --test scripts/ops/board.test.mjs', 'codeur')).trim(), '')
  assert.equal(sortieDriver('').trim(), '', 'stdin vide')
  assert.equal(sortieDriver('{pas du json').trim(), '', 'stdin illisible')
})

test('la liste est LUE dans ECRIT_LU (une gate ajoutée là est couverte sans toucher au hook)', () => {
  const lues = gatesDeLaCi()
  for (const gate of ['lint', 'docs:check:tout', 'test:ops']) {
    assert.ok(lues.includes(gate), `« ${gate} » est une clé d’ECRIT_LU mais le hook ne la voit pas`)
    assert.ok(gate in ECRIT_LU, `« ${gate} » a quitté ECRIT_LU : le verrou perd sa source`)
  }
  assert.equal(
    evaluate({ agentType: 'codeur', commande: 'npm run docs:check:tout' })?.decision,
    'deny',
    'sans liste injectée, le hook doit refuser en lisant la table réelle',
  )
})
