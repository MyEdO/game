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
import { evaluate, gatesDeLaCi } from './codeur-gates-guard.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'


/** Sortie BRUTE du répartiteur pour un payload de hook (stdin tel que l'hôte l'envoie). */
function sortieDriver(payload) {
  const run = lancerHook('repartiteur.mjs', payload)
  assert.equal(run.code, 0, `le hook a quitté en ${run.code} : ${run.err}`)
  return run.out
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

const GATES = ['lint', 'deps:unused', 'docs:build', 'test:ops', 'typecheck']

/** La décision du hook pour un `codeur` (la liste de gates est injectée, jamais lue du dépôt). */
const pourCodeur = (commande) => evaluate({ agentType: 'codeur', commande, gates: GATES })

/** Commandes REFUSÉES : la gate est jouée une fois par le run CI de la branche. */
const REFUSEES = [
  'npm run lint',
  'npm test',
  'npm run deps:unused',
  // Gate dont la RÉSOLUTION n'est refusée par aucune autre règle
  // (`node scripts/docs/build-all.mjs`) : seul son NOM, clé d'`ECRIT_LU`, la refuse.
  'npm run docs:build',
  'npx vitest run',
  'npx tsc --noEmit',
  'npx eslint .',
  'npx knip',
  'node scripts/test/node-tests.mjs test:ops',
  'node scripts/gates/toutes.mjs',
  // Décision par SEGMENT : la gate cachée derrière un enchaînement est la même gate.
  'echo ok && npm run docs:build',
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

// #2173 (juge de diff, `cas3.json`) : la commande d'un bloc PowerShell est une gate ; une chaîne qui la cite n'en
// est pas une.
test('une gate DANS un bloc PowerShell est refusée ; la même gate CITÉE dans une chaîne passe', () => {
  for (const cmd of ['1 | % { npx vitest run }', '1 | % { npx vitest run | tail -5 }', 'Get-ChildItem *.test.ts | % { npx vitest run $_.FullName }']) {
    assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
  }
  for (const cmd of [
    "1 | % { 'npx vitest run' }", '1 | % { "vitest hors suite : PID $_" }', 'git worktree list | % { "npm test $_" }',
    'foreach ($w in git worktree list) { Write-Output "npm run lint dans $w" }',
  ]) assert.equal(pourCodeur(cmd), null, cmd)
})

test('une gate dans une substitution `$(…)` est refusée', () => {
  for (const cmd of ['x=$(npx vitest run)', 'out=$(npx vitest run 2>&1 | tail -5)', 'x=$(npx tsc --noEmit)']) {
    assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
  }
})

test('le corps d’un heredoc est une donnée : la gate qu’il cite passe, celle qui le suit est refusée', () => {
  const ecrit = "cat > note.md <<'EOF'\nVerrou : `npm run gates` (suite (complète) ; types).\nEOF\n"
  assert.equal(pourCodeur(`${ecrit}gh issue comment 1 --body-file note.md`), null)
  assert.equal(pourCodeur(`${ecrit}npm run typecheck 2>&1 | tail -5`)?.decision, 'deny')
})

test('la liste est LUE dans ECRIT_LU (une gate ajoutée là est couverte sans toucher au hook)', () => {
  const lues = gatesDeLaCi()
  for (const gate of ['lint', 'docs:build', 'test:ops']) {
    assert.ok(lues.includes(gate), `« ${gate} » est une clé d’ECRIT_LU mais le hook ne la voit pas`)
    assert.ok(gate in ECRIT_LU, `« ${gate} » a quitté ECRIT_LU : le verrou perd sa source`)
  }
  assert.equal(
    evaluate({ agentType: 'codeur', commande: 'npm run docs:build' })?.decision,
    'deny',
    'sans liste injectée, le hook doit refuser en lisant la table réelle',
  )
})

// #2173 (juge de diff, 3e passe, `cas-amp2.json`) : la garde lit les segments profonds de la commande BRUTE ;
// l'opérateur d'appel `&` devant un exécutable cité, dans un bloc, ne s'efface plus.
test('une gate appelée par `&` sur un exécutable cité, dans un bloc PowerShell, est refusée', () => {
  for (const cmd of [
    "1 | % { & 'C:/Program Files/nodejs/npx.cmd' vitest run }",
    '1 | % { & "$env:APPDATA/npm/npx.cmd" tsc --noEmit }',
    "try { & 'npx' vitest run } catch {}",
    "if ($true) { & 'npm' run gates }",
  ]) assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
})

test('la portée server/ suit le shell du `cd` : ses segments et les shells qu’il lance, jamais son hôte', () => {
  for (const cmd of ['cd server && bash -c "npm run lint"', 'cd server && npx vitest run', '1 | % { cd server; npm run lint }']) {
    assert.equal(pourCodeur(cmd), null, cmd)
  }
  for (const cmd of [
    'bash -c "cd server && npm run typecheck" && npx tsc --noEmit',
    'x=$(cd server && npm run lint); npx vitest run',
    'cd server && cd .. && npm run lint',
    'npm --prefix server run typecheck && npx tsc --noEmit',
  ]) assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
})

// #2173 (juge de diff, 4e passe, `cas-server.json`) : une redirection se retire avec sa cible, les arguments qui la
// suivent restent.
test('une redirection n’est pas un argument : elle se retire avec sa cible, les arguments qui la suivent restent', () => {
  for (const cmd of [
    'npx vitest run --minWorkers=1 2>&1 > tmp/suite.log', 'npm test > /tmp/suite.log 2>&1', 'npx vitest run > out/x.txt',
    'npx vitest run > out.txt', 'npx tsc >x.txt --noEmit', 'npx tsc 2>&1 --noEmit', 'npx vitest run <in.txt', 'npx eslint 2>e.txt .',
    'npx tsc >|x.txt --noEmit',
  ]) {
    assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
  }
  for (const cmd of [
    'npx vitest run src/a.test.ts > tmp/a.log 2>&1', 'npm test -- src/a.test.ts > /tmp/a.log',
    'npx vitest run 2>err.txt src/x.test.ts', 'npx eslint 2>e.txt src/a.ts',
  ]) {
    assert.equal(pourCodeur(cmd), null, cmd)
  }
})

test('la portée server/ est prudente : un shell enfant ne la porte pas au parent, tout autre changement de répertoire la rend à la racine', () => {
  for (const cmd of [
    '(cd server) && npx vitest run', 'cd server | true; npx vitest run', 'cd server; Set-Location ..; npx vitest run',
    'cd server; popd; npx vitest run', '(cd server && npm test); npx vitest run', 'cd $D && npx vitest run', 'cd - && npx vitest run',
    '1 | % { cd server }; npx vitest run',
  ]) assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
  for (const cmd of ['cd server && npx vitest run', 'cd server 2>/dev/null && npx vitest run', 'cd ./server && npm run typecheck']) {
    assert.equal(pourCodeur(cmd), null, cmd)
  }
})

// #2173 (juge de diff, 5e passe) : `eval` relit sa chaîne dans le shell hôte ; `builtin` s'épluche ; un argument
// qui remonte d'un cran (`..`) se juge à la racine.
test('la portée server/ : `eval` et `builtin` agissent sur le shell hôte, un argument `..` se juge à la racine', () => {
  for (const cmd of [
    "cd server; eval 'cd ..'; npx vitest run", 'cd server; builtin cd ..; npx vitest run', "cd server; Invoke-Expression 'cd ..'; npx vitest run",
    'cd server; npx vitest run --root ..', 'cd server; npx --prefix .. vitest run', 'cd server; npm --prefix .. test',
    'cd server; npx tsc -p ../tsconfig.json --noEmit',
  ]) assert.equal(pourCodeur(cmd)?.decision, 'deny', cmd)
  for (const cmd of ["cd server; sh -c 'cd ..'; npx vitest run", 'cd server && npx vitest run src/x.test.ts', "eval 'cd server'; npx vitest run"]) {
    assert.equal(pourCodeur(cmd), null, cmd)
  }
})

test('une commande trop imbriquée pour être lue est refusée', () => {
  const decision = pourCodeur('echo $($($($($(npx vitest run)))))')
  assert.equal(decision?.decision, 'deny')
  assert.match(decision.reason, /commande trop imbriquée pour être jugée/)
})
