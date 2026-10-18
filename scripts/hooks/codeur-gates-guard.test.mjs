// #2436
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
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { contexteSonde } from '../guards/lib/sondeVitest.mjs'


/** Sortie BRUTE du répartiteur pour un payload de hook (stdin tel que l'hôte l'envoie). */
function sortieDriver(payload) {
  const run = lancerHook('repartiteur.mjs', payload)
  assert.equal(run.code, 0, `le hook a quitté en ${run.code} : ${run.err}`)
  return run.out
}

/** Payload PreToolUse, champs d'agent `agent` compris (`SOUS_AGENT`, `SESSION_AGENT`, aucun = session principale). */
const payload = (command, agent = {}) =>
  JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    ...agent,
    tool_name: 'Bash',
    tool_input: { command },
  })

const GATES = ['lint', 'deps:unused', 'docs:build', 'test:ops', 'typecheck']

/** La décision du hook pour un `codeur` (la liste de gates est injectée, jamais lue du dépôt). */
const pourCodeur = (commande) => evaluate({ sousAgent: true, commande, gates: GATES })
/** Les champs d'agent d'un sous-agent, et ceux d'une session principale lancée sous `--agent` (doc des hooks Claude Code,
 *  « Common input fields » : `agent_id` « for the subagent », `agent_type` « Present when the session uses --agent »). */
const SOUS_AGENT = { agent_id: 'a1', agent_type: 'codeur' }
const SESSION_AGENT = { agent_type: 'codeur' }

/** Commandes REFUSÉES : la gate est jouée une fois par le run CI de la branche. */
const REFUSEES = [
  'npm run lint',
  'npm test',
  // Les alias de `npm test` (`npm help test`) sont la même suite entière ; `npm exec` est `npx`.
  'npm t',
  'npm tst',
  'npm exec vitest run',
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
  'node --test scripts/ops/board.test.mjs',
  'npx eslint scripts/ops/board.mjs',
  'npm run ops:board -- --liste',
  'npm test -- src/a.test.ts',
  'npm t -- src/a.test.ts',
  'npm run test:perimetre',
  'npm run test:perimetre -- --liste',
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
    assert.match(decision.reason, /\[gates-ci\]/)
    assert.match(decision.reason, /npm run ops:ci -- --attendre/)
    assert.match(decision.reason, /npm run ops:ci -- --echecs <run>/)
  })
}

for (const commande of PASSANTES) {
  test(`PASSE pour un codeur : ${commande}`, () => {
    assert.equal(pourCodeur(commande), null, `refus parasite sur « ${commande} »`)
  })
}

test('tous les appelants refusent toutes les gates ECRIT_LU', () => {
  for (const sousAgent of [false, true]) {
    for (const nom of Object.keys(ECRIT_LU)) {
      assert.equal(evaluate({ sousAgent, commande: `npm run ${nom}` })?.decision, 'deny', `${sousAgent}: ${nom}`)
    }
  }
})

test('la raison NOMME la commande refusée et le geste de remplacement', () => {
  const { reason } = pourCodeur('npm run lint')
  assert.match(reason, /« npm run lint »/)
  assert.match(reason, /pousser la branche/)
  assert.match(reason, /puce « Auto-contrôle » de `\.claude\/agents\/codeur\.md`/)
  assert.doesNotMatch(reason, /\b(?:te|tu|joue)\b/, 'la raison vaut pour tout appelant, jamais adressée au seul codeur')
})

test('DRIVER : un refus rend le JSON exact attendu par le hook (deny + raison)', () => {
  const { hookSpecificOutput } = JSON.parse(sortieDriver(payload('npm run lint', SOUS_AGENT)))
  assert.equal(hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(hookSpecificOutput.permissionDecision, 'deny')
  assert.match(hookSpecificOutput.permissionDecisionReason, /\[gates-ci\]/)
  assert.deepEqual(
    Object.keys(hookSpecificOutput).sort(),
    ['hookEventName', 'permissionDecision', 'permissionDecisionReason'],
  )
})

test('DRIVER : silence (aucune sortie) hors du cas visé, et jamais une sortie non nulle', () => {
  for (const agent of [{}, SESSION_AGENT]) {
    assert.equal(JSON.parse(sortieDriver(payload('npm run lint', agent))).hookSpecificOutput.permissionDecision, 'deny')
  }
  assert.equal(sortieDriver(payload('node --test scripts/ops/board.test.mjs')).trim(), '')
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
    evaluate({ sousAgent: true, commande: 'npm run docs:build' })?.decision,
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
    'npm test -- src/a.test.ts > /tmp/a.log', 'npx eslint 2>e.txt src/a.ts',
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

test('SONDE : configuration externe réelle, un fichier ; suite et formes inconnues refusées', () => {
  const dir = mkdtempSync(join(tmpdir(), '2436-sonde-'))
  try {
    const fichier = join(dir, 'unique.test.ts').replaceAll('\\', '/')
    const config = join(dir, 'vitest.config.mts').replaceAll('\\', '/')
    writeFileSync(fichier, 'export {}')
    const commande = `npx vitest run --config "${config}"`
    const contexte = contexteSonde({ dir: process.cwd(), racineNpm: process.cwd() })
    for (const text of [
      `export default ({ test: { include: ['${fichier}'] } })`,
      `import { defineConfig } from 'vitest/config'; export default defineConfig({test:{include:['${fichier}']}})`,
      `const R = '${process.cwd().replaceAll('\\', '/')}'; export default ({ root: R, test: { environment: 'node', include: ['${fichier}'], setupFiles: [R + '/src/test-setup.ts'] } });`,
    ]) {
      writeFileSync(config, text)
      assert.equal(evaluate({ commande, contexte }), null)
      assert.equal(sortieDriver(payload(commande)).trim(), '')
      assert.match(evaluate({ commande: `${commande} "${fichier}"`, contexte }).reason, /lance Vitest directement/)
      assert.match(JSON.parse(sortieDriver(payload(`${commande} "${fichier}"`))).hookSpecificOutput.permissionDecisionReason, /lance Vitest directement/)
    }
    for (const text of [
      `export default {test:{include:['**/*.test.ts']}}`,
      `export default {test:{include:['${fichier}','${fichier}']}}`,
      `export default {test:{include:['${fichier}'],projects:[]}}`,
      `export default {test:{include:['${fichier}']}}; mutate()`,
      `export default {test:{...x,include:['${fichier}']}}`,
      `export default {test:{include:['${fichier}'],include:['${fichier}']}}`,
      `let R = '/tmp'; export default { root: R, test:{include:['${fichier}']}}`,
      `const R = readRoot(); export default { root: R, test:{include:['${fichier}']}}`,
      `export default {test:{include:['${fichier}'],setupFiles:[setup()]}}`,
    ]) {
      writeFileSync(config, text)
      assert.equal(evaluate({ commande, contexte })?.decision, 'deny', text)
    }
    writeFileSync(config, `export default {test:{include:['${fichier}']}}`)
    for (const suffix of [' --root .', ` --config "${config}"`, ' --project all']) {
      assert.equal(evaluate({ commande: commande + suffix, contexte })?.decision, 'deny')
    }
    assert.equal(evaluate({ commande: 'npx vitest run --config vite.config.ts', contexte })?.decision, 'deny')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('EXCEPTION : au site exact, raison littérale ; le segment suivant reste refusé', () => {
  const site = resolve('scripts/gates/sur-demande-utilisateur.mjs').replaceAll('\\', '/')
  const commande = `node "${site}" --raison "demande utilisateur" --gates lint`
  assert.equal(evaluate({ commande }), null)
  assert.equal(evaluate({ commande: commande.replace('demande utilisateur', 'demande utilisateur : npx vitest run src/a.test.ts') }), null)
  for (const cmd of [
    commande + '; npm run lint',
    commande.replace('--raison "demande utilisateur"', '--raison "$RAISON"'),
    commande.replace(' --raison "demande utilisateur"', ''),
    commande.replace('--gates lint', '--gates inconnue'),
    'node scripts/gates/toutes.mjs --raison "demande utilisateur" --gates lint',
    commande.replace(site, '/tmp/scripts/gates/sur-demande-utilisateur.mjs'),
    'cd autre; node scripts/gates/sur-demande-utilisateur.mjs --raison demande --gates lint',
    'node scripts/gates/sur-demande-utilisateur.mjs --raison demande --gates lint; cd docs',
  ]) assert.equal(evaluate({ commande: cmd })?.decision, 'deny', cmd)
})

test('DRIVER Codex : canal shell sans agent_type refuse une gate', () => {
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command: 'npm run lint' } }
  const run = lancerHook('repartiteur.mjs', entree, { surface: 'codex' })
  assert.equal(run.code, 0)
  assert.equal(run.specifique.permissionDecision, 'deny')
})

test('EXTGLOB : un fichier littéral existant ne certifie pas un motif de plusieurs suites', () => {
  const dir = mkdtempSync(join(tmpdir(), '2436-extglob-'))
  try {
    const cible = join(dir, 'unique+(x).test.ts').replaceAll('\\', '/')
    writeFileSync(cible, 'export {}')
    writeFileSync(join(dir, 'uniquex.test.ts'), 'export {}')
    writeFileSync(join(dir, 'uniquexx.test.ts'), 'export {}')
    const config = join(dir, 'vitest.config.mts').replaceAll('\\', '/')
    writeFileSync(config, `export default {test:{include:['${cible}']}}`)
    assert.equal(evaluate({ commande: `npx vitest run --config "${config}"`, contexte: contexteSonde({ dir: process.cwd(), racineNpm: process.cwd() }) })?.decision, 'deny')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('SERVER LANCEUR : les lanceurs de racine restent jugés après cd server', () => {
  const racine = process.cwd().replaceAll('\\', '/')
  const wrapper = `${racine}/scripts/gates/sur-demande-utilisateur.mjs`
  for (const cmd of [
    `cd server; node ${racine}/scripts/gates/toutes.mjs`,
    'cd server; node ../scripts/gates/toutes.mjs',
    `cd server; node ${racine}/scripts/test/node-tests.mjs test:ops`,
    `cd server; node ${wrapper}`,
    `cd server; node ${wrapper} --raison demande --gates inconnue`,
    `cd server; node ${wrapper} --raison demande --gates lint; node ${racine}/scripts/gates/toutes.mjs`,
  ]) assert.equal(evaluate({ commande: cmd })?.decision, 'deny', cmd)
  assert.equal(evaluate({ commande: `cd server; node ${wrapper} --raison demande --gates lint` }), null)
  assert.equal(evaluate({ commande: 'cd server; npm run typecheck' }), null)
})

test('REPERTOIRE SONDE : après cd, seules les adresses indépendantes du cwd certifient un fichier', () => {
  const dir = mkdtempSync(join(tmpdir(), '2436-cwd-'))
  try {
    const fichier = join(dir, 'unique.test.ts').replaceAll('\\', '/')
    const config = join(dir, 'vitest.config.mts').replaceAll('\\', '/')
    const contexte = contexteSonde({ dir, racineNpm: process.cwd() })
    writeFileSync(fichier, 'export {}')
    writeFileSync(config, `export default {test:{include:['${fichier}']}}`)
    assert.equal(evaluate({ commande: 'cd docs; npx vitest run --config vitest.config.mts', contexte })?.decision, 'deny')
    assert.equal(evaluate({ commande: 'npx vitest run --config vitest.config.mts; cd docs', contexte })?.decision, 'deny')
    assert.equal(evaluate({ commande: `cd docs; npx vitest run --config "${config}"`, contexte }), null)
    writeFileSync(config, "export default {test:{include:['unique.test.ts']}}")
    assert.equal(evaluate({ commande: `cd docs; npx vitest run --config "${config}"`, contexte })?.decision, 'deny')
    writeFileSync(config, `export default {root:'${dir.replaceAll('\\', '/')}',test:{include:['unique.test.ts']}}`)
    assert.equal(evaluate({ commande: `cd docs; npx vitest run --config "${config}"`, contexte }), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

/** #2568 : `test:perimetre` enchaîné à un autre runner dans un même appel. */
const CHAINES = [
  ['pass', 'npm run typecheck:fast && npm run test:perimetre'],
  ['pass', 'npm run test:perimetre; node --test scripts/ops/board.test.mjs'],
  ['pass', 'npm test -- src/a.test.ts && npm run test:perimetre'],
  ['direct', 'npx vitest run src/a.test.ts; npm run test:perimetre'],
  ['pass', 'npx eslint scripts/ops/board.mjs && npm run test:perimetre -- --budget 60'],
  ['pass', 'sh -c "npm run test:perimetre && npm run typecheck:fast"'],
  ['pass', 'node scripts/test/perimetre.mjs && node --test scripts/ops/board.test.mjs'],
  // Drapeau de node à valeur séparée, des deux côtés.
  ['pass', 'node --import tsx --test scripts/a.test.mjs && npm run test:perimetre'],
  ['direct', 'node --import tsx scripts/test/perimetre.mjs; npx vitest run src/a.test.ts'],
  // Alias et lanceurs : `npm t`, `npm exec`, `scripts/lancer-local.mjs` (corps de `test:map`), `playwright test`.
  ['pass', 'npm t -- src/a.test.ts && npm run test:perimetre'],
  ['direct', 'npm exec vitest run src/a.test.ts && npm run test:perimetre'],
  ['pass', 'node scripts/lancer-local.mjs vitest -- vitest run scripts/map && npm run test:perimetre'],
  ['pass', 'npx playwright test && npm run test:perimetre'],
]

test('SOUS-AGENT : `test:perimetre` enchaîné à un autre runner est refusé, la raison porte la consigne', () => {
  for (const [, commande] of CHAINES) {
    const decision = pourCodeur(commande)
    assert.equal(decision?.decision, 'deny', commande)
    assert.match(decision.reason, /enchaîne `npm run test:perimetre` à un autre runner|lance Vitest directement/, commande)
    assert.match(decision.reason, /puce « Auto-contrôle » de `\.claude\/agents\/codeur\.md`/, commande)
    assert.doesNotMatch(decision.reason, /\b(?:te|tu|joue)\b/, commande)
  }
})

test('SESSION PRINCIPALE : le même enchaînement passe par les lanceurs canoniques', () => {
  for (const [attendu, commande] of CHAINES) {
    const decision = evaluate({ commande, gates: GATES })
    if (attendu === 'direct') {
      assert.equal(decision?.decision, 'deny', commande)
      assert.match(decision.reason, /lance Vitest directement/, commande)
    } else assert.equal(decision, null, commande)
  }
})

test('SOUS-AGENT : `test:perimetre` seul, un runner seul, ou une mention, passent', () => {
  for (const commande of [
    'npm run test:perimetre',
    'npm run typecheck:fast && npm test -- src/a.test.ts',
    'grep "npm run typecheck:fast" x.md && npm run test:perimetre',
    'git status --short && npm run test:perimetre',
    // `--liste` dérive et liste sans rien lancer (`scripts/test/perimetre.mjs`, `lireArguments`).
    'npm run test:perimetre -- --liste && npm run typecheck:fast',
    'node scripts/test/perimetre.mjs --liste; node --test scripts/ops/board.test.mjs',
    'node scripts/lancer-local.mjs vite -- vite build && npm run test:perimetre',
  ]) assert.equal(pourCodeur(commande), null, commande)
})

test('DRIVER : l’`agent_id` de la charge désigne le sous-agent — refus pour lui, silence pour une session principale, sous `--agent` comprise', () => {
  const commande = 'npm run typecheck:fast && npm run test:perimetre'
  const { hookSpecificOutput } = JSON.parse(sortieDriver(payload(commande, SOUS_AGENT)))
  assert.equal(hookSpecificOutput.permissionDecision, 'deny')
  assert.match(hookSpecificOutput.permissionDecisionReason, /enchaîne `npm run test:perimetre`/)
  assert.equal(sortieDriver(payload(commande)).trim(), '')
  assert.equal(sortieDriver(payload(commande, SESSION_AGENT)).trim(), '', 'session lancée sous --agent : agent_type sans agent_id')
})

/** Sonde du 2e juge de #2568 (2026-10-11) : verdict attendu pour un sous-agent — `null` passe, `'chaîne'` refuse
 *  l'enchaînement, `'gate'` refuse une gate de la CI. */
const SONDE_DU_JUGE = [
  [null, "npm run test:perimetre"],
  [null, "npm run test:perimetre -- --liste"],
  [null, "npm run test:perimetre > p.txt 2>&1; echo $?"],
  [null, "npm run test:perimetre 2>&1 | tail -40"],
  [null, "cd /srv/x && npm run test:perimetre"],
  [null, "git -C /srv/x status --short && npm run test:perimetre"],
  [null, "npx tsx scripts/qc/x.mts && npm run test:perimetre"],
  [null, "node scripts/ops/board.mjs --liste && npm run test:perimetre"],
  [null, "npm run test:perimetre -- --liste && npm run test:perimetre"],
  [null, "npm run test:perimetre -- --budget 60 --liste; npm run typecheck:fast"],
  [null, "npm run typecheck:fast && npm test -- src/a.test.ts"],
  [null, "node scripts/lancer-local.mjs oxlint -- oxlint --config oxlint.config.mjs --disable-nested-config --max-warnings 0 src/a.ts"],
  [null, "npm test -- src/a.test.ts src/b.test.ts"],
  [null, "node --test scripts/n.test.mjs"],
  [null, "node --test \"scripts/un dossier/n.test.mjs\""],
  [null, "npm run test:perimetre; Write-Output $LASTEXITCODE"],
  [null, "npm run test:perimetre -- --base origin/main"],
  ["direct", "npx --yes vitest run src/a.test.ts && npm run test:perimetre"],
  ["gate", "npx -y tsc -p server --noEmit; npm run test:perimetre"],
  ["direct", "& npx vitest run src/a.test.ts; npm run test:perimetre"],
  ["chaîne", "& node --test scripts/a.test.mjs; npm run test:perimetre"],
  ["chaîne", "npm run test:perimetre; & npm run typecheck:fast"],
  ["chaîne", "npm.cmd run test:perimetre; npm.cmd run typecheck:fast"],
  ["direct", "npx.cmd vitest run src/a.test.ts; npm run test:perimetre"],
  ["chaîne", "node.exe --test scripts/a.test.mjs; npm run test:perimetre"],
  ["chaîne", "timeout 600 npm run test:perimetre && npm run typecheck:fast"],
  ["chaîne", "time npm run test:perimetre && npm run typecheck:fast"],
  ["chaîne", "env CI=1 npm run test:perimetre && npm run typecheck:fast"],
  ["chaîne", "CI=1 npm run test:perimetre && npm run typecheck:fast"],
  ["chaîne", "bash -c 'npm run test:perimetre' && npm run typecheck:fast"],
  ["chaîne", "cmd /c \"npm run test:perimetre && npm run typecheck:fast\""],
  ["chaîne", "pwsh -Command \"npm run test:perimetre; npm run typecheck:fast\""],
  ["chaîne", "npm run test:perimetre; if ($?) { npm run typecheck:fast }"],
  ["chaîne", "npm run test:perimetre || npm test -- src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && npx tsx --test scripts/a.test.mts"],
  ["chaîne", "npm run test:perimetre && node --experimental-strip-types --test scripts/a.test.mjs"],
  ["chaîne", "npm run test:perimetre && node --test-reporter spec --test scripts/a.test.mjs"],
  ["chaîne", "npm run test:perimetre && node -r tsx/cjs --test scripts/a.test.mjs"],
  ["chaîne", "npm run test:perimetre && npm --prefix server test"],
  ["chaîne", "npm run test:perimetre && npm -s run typecheck:fast"],
  ["chaîne", "npm run test:perimetre && npm run-script typecheck:fast"],
  ["chaîne", "npm run test:perimetre && npm rum typecheck:fast"],
  ["direct", "npm run test:perimetre && npm x -- vitest run src/a.test.ts"],
  ["direct", "npm run test:perimetre && npm exec --yes -- vitest run src/a.test.ts"],
  ["direct", "npm run test:perimetre && node node_modules/vitest/vitest.mjs run src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && node scripts/test/run.mjs src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && node ./scripts/typecheck-fast.mjs"],
  ["chaîne", "npm run test:perimetre && npx playwright test e2e/a.spec.ts"],
  ["chaîne", "npm run test:perimetre && node scripts/lancer-local.mjs typescript -- tsc -p server"],
  ["chaîne", "npm run test:perimetre && node scripts/lancer-local.mjs vitest --cwd server -- vitest run src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && npm run test:map"],
  ["chaîne", "npm run test:perimetre && npm run bench"],
  ["gate", "npm run test:perimetre && npm run test:watch"],
  ["chaîne", "node --import=./scripts/guards/lib/perimetreSansEcriture.mjs scripts/test/perimetre.mjs && npm run typecheck:fast"],
  ["chaîne", "node ./scripts/test/perimetre.mjs; npm run typecheck:fast"],
  ["chaîne", "node /srv/x/.wt-2568/scripts/test/perimetre.mjs; npm run typecheck:fast"],
  ["chaîne", "npm run test:perimetre -- --docs && npm run typecheck:fast"],
  ["chaîne", "npm run test:perimetre && npm run typecheck:fast -- --liste"],
  ["chaîne", "npm run typecheck:fast && npm run test:perimetre -- --base main --liste-x"],
  ["chaîne", "npm run typecheck:fast; npm run test:perimetre -- --base --liste"],
  ["chaîne", "npm run test:perimetre && cd server && npx vitest run src/a.test.ts"],
  ["chaîne", "cd server; npm test -- src/a.test.ts; cd ..; npm run test:perimetre"],
  ["chaîne", "npm run test:perimetre && npx oxlint src/a.ts"],
  ["chaîne", "npm run test:perimetre && npx eslint src/a.ts"],
  [null, "gh issue comment 2568 -R MyEdO/game --body \"npm run test:perimetre && npm run typecheck:fast\""],
  [null, "git commit -m \"npm run test:perimetre; npm run typecheck:fast\" -- scripts/a.mjs"],
  [null, "node -e \"console.log('npm run test:perimetre')\" && npm run typecheck:fast"],
  [null, "Select-String -Path x.md -Pattern 'test:perimetre'; npm run typecheck:fast"],
  [null, "npm run test:perimetre -- --liste 2>&1 | Select-String rang; npm run typecheck:fast"],
  [null, "npx vitest --version && npm run test:perimetre"],
  [null, "npx tsc --version; npm run test:perimetre"],
  [null, "node --version && npm run test:perimetre"],
  [null, "npm run typecheck:fast -- --help; npm run test:perimetre -- --liste"],
  [null, "git hash-object scripts/a.mjs && npm run test:perimetre"],
  [null, "npm run test:perimetre && git hash-object scripts/a.mjs"],
  [null, "npm run test:perimetre -- --liste && npm run test:perimetre -- --liste"],
  [null, "npm run docs:sorts && npm run test:perimetre"],
  [null, "npx tsx scripts/qc/mesure-volume.mts t1 && npm run test:perimetre"],
  [null, "node scripts/lancer-local.mjs tsx -- tsx scripts/map/check.mts; npm run test:perimetre"],
  ["chaîne", "npm run test:perimetre --liste && npm run typecheck:fast"],
  ["chaîne", "npm --liste run test:perimetre && npm run typecheck:fast"],
  ["chaîne", "npm run test:perimetre -- --base --liste && npm run typecheck:fast"],
]

/** Sonde du juge de fermeture de #2568 (2026-10-12), même lecture que `SONDE_DU_JUGE`. */
const SONDE_DE_FERMETURE = [
  ["chaîne", "npm run test:perimetre && node --run typecheck:fast"],
  ["chaîne", "npm run test:perimetre && node --run=typecheck:fast"],
  ["direct", "npm run test:perimetre && npx tsx node_modules/vitest/vitest.mjs run src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && tsx scripts/test/run.mjs src/a.test.ts"],
  ["chaîne", "npm run test:perimetre && npm run test:perimetre"],
  ["chaîne", "node scripts/test/perimetre.mjs; npm run test:perimetre -- --base main"],
  ["chaîne", "npm run test:perimetre && npm run docs:check"],
  ["chaîne", "npm run test:perimetre && node scripts/docs/build-all.mjs --check"],
  [null, "npm run typecheck:fast -- --help && npm run test:perimetre"],
  [null, "node --run typecheck:fast -- --version; npm run test:perimetre"],
  [null, "npm run test:perimetre && npm run docs:check -- --help"],
]

test('SONDE DU JUGE : chaque commande rend, pour un sous-agent, le verdict attendu', () => {
  const verdict = (d) => (d === null ? null : d.reason.includes('lance Vitest directement') ? 'direct' : d.reason.includes('enchaîne') ? 'chaîne' : 'gate')
  for (const [attendu, commande] of [...SONDE_DU_JUGE, ...SONDE_DE_FERMETURE]) {
    const decision = evaluate({ sousAgent: true, commande })
    assert.equal(verdict(decision), attendu, commande)
    if (attendu !== null) assert.equal(decision?.decision, 'deny', commande)
  }
})

test('Vitest direct à fichier : chemins, drapeaux et enrobeurs passent par la porte canonique', () => {
  const commandes = [
    'npx vitest run src/a.test.ts',
    'npm exec vitest run src/a.test.ts',
    'npx vitest run --reporter verbose --testNamePattern motif src/a.test.ts',
    'npx vitest run src/a.test.ts > tmp/a.log 2>&1',
    'npx vitest run 2>err.txt src/x.test.ts',
    'node node_modules/vitest/vitest.mjs run src/a.test.ts',
    'bash -lc "npx vitest run src/a.test.ts"',
    'pwsh -Command "& npx vitest run src/a.test.ts"',
    '1 | % { npx vitest run src/a.test.ts }',
  ]
  for (const commande of commandes) {
    for (const sousAgent of [false, true]) {
      const decision = evaluate({ commande, sousAgent })
      assert.equal(decision?.decision, 'deny', commande)
      assert.match(decision.reason, /npm test -- <chemins>/)
      assert.match(decision.reason, /scripts\/test\/run\.mjs/)
    }
    const run = lancerHook('repartiteur.mjs', JSON.parse(payload(commande)), { surface: 'codex' })
    assert.equal(run.code, 0)
    assert.equal(run.specifique.permissionDecision, 'deny', commande)
    assert.match(run.specifique.permissionDecisionReason, /lance Vitest directement/)
  }
})

test('Vitest cité, informatif ou interactif reste hors du refus de capture', () => {
  for (const commande of [
    'echo "npx vitest run src/a.test.ts"',
    'rg "vitest run src/a.test.ts" note.md',
    'npx vitest --help src/a.test.ts',
    'npx vitest --version src/a.test.ts',
    'npx vitest list src/a.test.ts',
    'npx vitest --watch src/a.test.ts',
    'npm test -- src/a.test.ts',
  ]) assert.equal(evaluate({ commande }), null, commande)
})

test('`--liste` ne vaut que reçu par `scripts/test/perimetre.mjs` : après `--` sous npm, valeur d’un autre drapeau exclue', () => {
  for (const commande of [
    'npm run test:perimetre --liste && npm run typecheck:fast',
    'npm --liste run test:perimetre && npm run typecheck:fast',
    'npm run test:perimetre -- --base --liste && npm run typecheck:fast',
    'npm run typecheck:fast && npm run test:perimetre -- --liste-x',
  ]) assert.equal(pourCodeur(commande)?.decision, 'deny', commande)
  for (const commande of [
    'npm run test:perimetre -- --liste && npm run typecheck:fast',
    'npm run test:perimetre -- --budget 60 --liste; npm run typecheck:fast',
    'node scripts/test/perimetre.mjs --base main --liste && npm run typecheck:fast',
  ]) assert.equal(pourCodeur(commande), null, commande)
})

test('un drapeau d’INFORMATION (`--version`, `-v`, `--help`, `-h`) ne lance aucun runner', () => {
  for (const commande of ['npx vitest --version && npm run test:perimetre', 'npx tsc --version; npm run test:perimetre',
    'npx oxlint -h; npm run test:perimetre', 'npx playwright test --help && npm run test:perimetre', 'node --test --help && npm run test:perimetre'])
    assert.equal(pourCodeur(commande), null, commande)
  assert.equal(pourCodeur('npx vitest --watch && npm run test:perimetre')?.decision, 'deny', 'un mode interactif reste un runner')
})

test('l’exécutable de tête se juge sous son nom nu : `node.exe`, chemin absolu, `tsx`', () => {
  for (const commande of ['node.exe --test scripts/a.test.mjs; npm run test:perimetre',
    '/opt/nodejs/node.exe scripts/test/run.mjs src/a.test.ts && npm run test:perimetre',
    'node.exe /srv/x/scripts/test/perimetre.mjs; npm run typecheck:fast',
    'npm run test:perimetre && npx tsx --test scripts/a.test.mts'])
    assert.equal(pourCodeur(commande)?.decision, 'deny', commande)
  assert.equal(pourCodeur('node.exe scripts/gates/toutes.mjs')?.decision, 'deny', 'lanceur de gate sous node.exe')
})

test('la raison d’un enchaînement RENVOIE à la puce « Auto-contrôle », sans recopier sa règle', () => {
  const { reason } = pourCodeur('npm run test:perimetre && npm run typecheck:fast')
  assert.match(reason, /puce « Auto-contrôle » de `\.claude\/agents\/codeur\.md`/)
  assert.doesNotMatch(reason, /cache|5 min|contexte/)
})
