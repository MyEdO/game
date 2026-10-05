// Garde de CAPTURE des runners : la sortie d'un runner qui n'écrit rien ne se lit pas par un filtre
// tronquant. Les cas SILENCE sont aussi importants que les refus — `npm test | tail` reste la
// pratique recommandée (le runner capture `vitest-run-<pid>.txt`), et un refus y bloquerait le
// travail courant. Le répartiteur est lancé POUR DE VRAI (spawnSync + stdin JSON) sur la forme de payload
// que produit `mcp__lean-ctx__ctx_shell`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evaluate, estRunnerNonCapturant, lecteurTronquantDeFlux, capture } from './runner-capture-guard.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const denies = (cmd) => evaluate(cmd) !== null
const allows = (cmd) => evaluate(cmd) === null

const REFUSEES = [
  'npx vitest run src/engine/x.test.ts | tail -20',
  'npm run typecheck | head',
  'npm run typecheck | head -30',
  'vitest run | tail -5',
  'tsc --noEmit | sed -n "1,20p"',
  'npx eslint src | grep -m 3 error',
  'npm run build | Select-Object -First 20',
  'sh -c "npx vitest run | tail -20"',
  'npm run lint | awk "NR<10"',
  'npx vitest run | cat | tail -5',
]

const SILENCIEUSES = [
  'npm test | tail -20',
  'npm test -- src/engine | tail -40',
  'npm run test:hooks',
  'node scripts/test/run.mjs | tail -20',
  'npm run typecheck:fast | tail -5',
  'npx vitest run | tee sortie.txt | tail -5',
  'tsc --noEmit | tail -n +1',
  'npm test > sortie.txt 2>&1 ; tail -20 sortie.txt',
  'npx vitest run > sortie.txt 2>&1 ; tail -40 sortie.txt',
  'npm run typecheck > out.txt ; head -30 out.txt',
  'npx tsc --noEmit | cut -c1-80',
  'npx vitest run | grep "FAIL"',
  'git status | head -5',
  'cat sortie.txt | tail -20',
  // Faux positifs MESURÉS avant le groupement par pipeline (juge T3) : deux commandes sans
  // rapport enchaînées par `;`/`&&` ne forment pas un tube — rien n'y tronque le runner.
  'npx eslint . ; git log | head -5',
  'npm run lint; ls | head',
  'npx tsc --noEmit ; cat notes.md | head -3',
  'tsc --noEmit && tail -f log.txt',
  '',
]

for (const cmd of REFUSEES) test('DENY : ' + cmd, () => assert.ok(denies(cmd), 'aurait dû être refusée'))
for (const cmd of SILENCIEUSES) test('SILENCE : ' + (cmd || '(commande vide)'), () => assert.ok(allows(cmd), 'aurait dû passer'))

test('le refus NOMME le runner et le geste attendu (fichier puis lecture)', () => {
  const r = evaluate('npx vitest run | tail -20')
  assert.equal(r.decision, 'deny')
  assert.match(r.reason, /vitest run/)
  assert.match(r.reason, /sortie\.txt/)
  assert.match(r.reason, /`npm test -- <chemins>`/, 'le refus d’un vitest nomme la porte qui capture')
  assert.match(r.reason, /vitest-run-<pid>\.txt/, 'et ce qu’elle apporte : la capture complète')
  assert.match(r.reason, /workers bornés/, 'et les bornes de charge')
})

test('estRunnerNonCapturant : les portes qui capturent sont exclues NOMMÉMENT', () => {
  assert.equal(estRunnerNonCapturant(['vitest', 'run']), true)
  assert.equal(estRunnerNonCapturant(['tsc', '--noEmit']), true)
  assert.equal(estRunnerNonCapturant(['npm', 'run', 'typecheck']), true)
  assert.equal(estRunnerNonCapturant(['node', 'scripts/lancer-local.mjs', '--port', '5173']), true)
  assert.equal(estRunnerNonCapturant(['npm', 'test']), false)
  assert.equal(estRunnerNonCapturant(['npm', 'run', 'test:hooks']), false)
  assert.equal(estRunnerNonCapturant(['npm', 'run', 'typecheck:fast']), false)
  assert.equal(estRunnerNonCapturant(['node', 'scripts/test/run.mjs']), false)
  assert.equal(estRunnerNonCapturant(['git', 'status']), false)
})

test('lecteurTronquantDeFlux : un OPÉRANDE de fichier vaut lecture d’après capture', () => {
  assert.equal(lecteurTronquantDeFlux(['tail', '-20']), 'tail')
  assert.equal(lecteurTronquantDeFlux(['tail', '-20', 'sortie.txt']), null)
  assert.equal(lecteurTronquantDeFlux(['tail', '-n', '+1']), null)
  assert.equal(lecteurTronquantDeFlux(['head', '-5']), 'head')
  assert.equal(lecteurTronquantDeFlux(['head', '-5', 'f.txt']), null)
  assert.equal(lecteurTronquantDeFlux(['grep', 'erreur']), null, 'un grep sans -m filtre, il ne borne pas')
  assert.equal(lecteurTronquantDeFlux(['grep', '-m', '2', 'erreur']), 'grep -m')
  assert.equal(lecteurTronquantDeFlux(['cut', '-c1-80']), null)
  assert.equal(lecteurTronquantDeFlux(['cat']), null)
})

// #2173 : le corps d'un bloc PowerShell se prolonge à travers le `|` jusqu'à son `}`.
test('le runner tronqué DANS un bloc PowerShell est vu', () => {
  assert.ok(denies('1 | % { npx vitest run | tail -5 }'))
  assert.ok(allows("1 | % { 'npx vitest run | tail -5' }"))
})

test('capture : les graphies de redirection', () => {
  assert.equal(capture(['tsc', '>', 'f.txt']), true)
  assert.equal(capture(['tsc', '>f.txt']), true)
  assert.equal(capture(['tsc', '2>&1']), true)
  assert.equal(capture(['tsc', '--noEmit']), false)
})

/** Décision RÉELLE du hook sur un payload `mcp__lean-ctx__ctx_shell` (`null` s'il se tait). */
function decisionOf(command) {
  const payload = JSON.stringify({
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: REPO },
  })
  const run = lancerHook('repartiteur.mjs', payload)
  assert.equal(run.code, 0, 'le hook a quitté en ' + run.code + ' : ' + run.err)
  return run.specifique?.permissionDecision ?? null
}

test('DRIVER : le hook décide de bout en bout sur un payload ctx_shell', () => {
  assert.equal(decisionOf('npx vitest run | tail -20'), 'deny')
  assert.equal(decisionOf('npm test | tail -20'), null)
  assert.equal(decisionOf('git status'), null)
})

test('une commande trop imbriquée pour être jugée est refusée', () => {
  assert.match(evaluate('echo $($($($($(npx vitest run | tail -5)))))')?.reason ?? '', /commande trop imbriquée pour être jugée/)
})
