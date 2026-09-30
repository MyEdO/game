// Banc du consommateur `build-reprise.mjs` du bloc `on:` des workflows (#1993) : ses déclencheurs
// viennent de `declencheursDe` (`scripts/gates/workflowsDuDepot.mjs`), SEUL lecteur de ce bloc — qui
// LÈVE sur une forme qu'il ne sait pas lire, au lieu d'un runbook muet. Le script s'exécute à
// l'import (il émet son doc) : le banc lit sa SOURCE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./build-reprise.mjs', import.meta.url), 'utf8')

test('build-reprise lit les déclencheurs par `declencheursDe`, et ne porte aucun lecteur `on:` à lui', () => {
  assert.ok(/import \{[^}]*\bdeclencheursDe\b[^}]*\} from '\.\.\/gates\/workflowsDuDepot\.mjs'/.test(source), 'import de `declencheursDe`')
  assert.ok(/const declencheurs = declencheursDe\(texte, /.test(source), 'déclencheurs lus par `declencheursDe`')
  assert.deepEqual(source.match(/\bbloc\(|['"`]on['"`]|\^on:|\$\{cle\}:/g), null)
})
