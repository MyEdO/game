import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rendre } from './build-reprise.mjs'

const source = readFileSync(new URL('./build-reprise.mjs', import.meta.url), 'utf8')

test('build-reprise lit les déclencheurs par `declencheursDe`, et ne porte aucun lecteur `on:` à lui', () => {
  assert.ok(/import \{[^}]*\bdeclencheursDe\b[^}]*\} from '\.\.\/gates\/workflowsDuDepot\.mjs'/.test(source), 'import de `declencheursDe`')
  assert.ok(/const declencheurs = declencheursDe\(texte, /.test(source), 'déclencheurs lus par `declencheursDe`')
  assert.deepEqual(source.match(/\bbloc\(|['"`]on['"`]|\^on:|\$\{cle\}:/g), null)
})

test('#2499 runbook rendu : geste local, lecteur de groupe et relance conservée', () => {
  const texte = rendre().get('docs/reprise-apres-pause.md')
  assert.match(texte, /Il ne met jamais de PR en file/)
  assert.match(texte, /une seule fois par PR et tête/)
  assert.match(texte, /AWAITING_CHECKS.*10 minutes.*tête de groupe/)
  assert.match(texte, /rerun-failed-jobs.*10 minutes/)
  assert.doesNotMatch(texte, /\$\{DELAI|sondes espacées|reprise serveur.*enqueuePullRequest/)
})
