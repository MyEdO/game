// Tests de `runner-fast-reminder` : le rappel doit distinguer un APPEL de `tsc` d'une commande qui
// MENTIONNE le motif — une recherche de texte (`grep -rn "tsc --noEmit" docs/`) déclenchait le rappel,
// mesuré en vif 2026-08-30 (#1591). La table se joue sur la fonction ; le câblage, sur le répartiteur réel.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { conseilsRunner } from './runner-fast-reminder.mjs'

/** `true` si la garde émet son rappel pour cette commande. */
const rappelle = (command) => conseilsRunner(command).length > 0

test('DRIVER : le répartiteur réel rend le rappel en contexte, et se tait hors appel', () => {
  const charge = (command) => ({ session_id: 'test', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } })
  const appel = lancerHook('repartiteur.mjs', charge('npx tsc --noEmit'))
  assert.equal(appel.code, 0, appel.err)
  assert.match(appel.specifique?.additionalContext ?? '', /typecheck:fast/)
  assert.equal(lancerHook('repartiteur.mjs', charge('grep -rn "tsc --noEmit" docs/')).out.trim(), '')
})

const APPELS = [
  'tsc --noEmit',
  'npx tsc --noEmit',
  'node_modules/typescript/bin/tsc --noEmit',
  'tsc.cmd --noEmit',
  'npm run lint && tsc --noEmit',
  'cd sous-dossier; tsc --noEmit',
  // Vitest lancé en direct : ni capture en fichier, ni bornes de charge.
  'npx vitest run src/state',
  'vitest run src/engine/dice.test.ts',
  'node node_modules/vitest/vitest.mjs run src/ui',
  'npx vitest run -t "Sort" src/engine',
  // Portée des marqueurs, PAR SEGMENT (réécrit depuis le contrat, pas depuis le code) : `--prefix
  // server` ne vaut que pour l'appel npm qui le porte, donc le `tsc` du second segment est bien le
  // typecheck RACINE — et une porte du dépôt empruntée par UN segment ne dispense pas les autres.
  'npm --prefix server run typecheck && tsc --noEmit',
  'npm run typecheck:fast && tsc --noEmit',
  'npm test && npx vitest run src/ui',
]

const NON_APPELS = [
  'grep -rn "tsc --noEmit" docs/',
  'rg "tsc --noEmit" docs/',
  'Select-String -Pattern "tsc --noEmit" CLAUDE.md',
  'echo "tsc --noEmit"',
  'node scripts/tsc-tools/x.mjs --noEmit',
  'npm run typecheck:fast',
  'npm run typecheck',
  // La porte du dépôt elle-même, sous ses deux graphies.
  'npm test -- src/state',
  'npm run test -- src/state',
  'node scripts/test/run.mjs src/state',
  // Modes où la capture en fichier ne s'applique pas.
  'npx vitest --watch',
  'vitest -w src/ui',
  'npx vitest --ui',
  'npx vitest list --filesOnly',
  'npx vitest bench',
  'npx vitest --version',
  // Mention, pas appel.
  'grep "vitest run" docs/',
  'echo "npx vitest run src/state"',
  // Sous-projet server/ : son tsconfig n'est pas celui de la racine, le typecheck racine n'y
  // répond pas (faux positif mesuré en vif 2026-08-30). Le `cd` porte sur TOUT ce qui suit — d'où le
  // silence ici, là où le `--prefix` du même sous-projet (cf. APPELS) ne porte que son segment.
  'cd server && npx tsc --noEmit',
  'npm --prefix server run typecheck',
]

for (const commande of APPELS) {
  test(`RAPPEL sur un appel réel : ${commande}`, () => {
    assert.ok(rappelle(commande), `aucun rappel sur « ${commande} » — un tsc nu passe inaperçu`)
  })
}

for (const commande of NON_APPELS) {
  test(`SILENCE sur : ${commande}`, () => {
    assert.ok(!rappelle(commande), `rappel parasite sur « ${commande} »`)
  })
}
