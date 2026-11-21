import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DELAI_FILE_MS } from '../guards/lib/fusionPr.mjs'
import { PLAFOND_PAQUET_NODE_MS } from '../test/memoire.mjs'
import { rendre } from './build-reprise.mjs'

const source = readFileSync(new URL('./build-reprise.mjs', import.meta.url), 'utf8')

test('build-reprise lit les déclencheurs par `declencheursDe`, et ne porte aucun lecteur `on:` à lui', () => {
  assert.ok(/import \{[^}]*\bdeclencheursDe\b[^}]*\} from '\.\.\/gates\/workflowsDuDepot\.mjs'/.test(source), 'import de `declencheursDe`')
  assert.ok(/const declencheurs = declencheursDe\(texte, /.test(source), 'déclencheurs lus par `declencheursDe`')
  assert.deepEqual(source.match(/\bbloc\(|['"`]on['"`]|\^on:|\$\{cle\}:/g), null)
})

test('le runbook rend le plafond de durée des paquets Node', () => {
  const texte = rendre().get('docs/reprise-apres-pause.md')
  assert.match(texte, new RegExp(`local plafonné à ${PLAFOND_PAQUET_NODE_MS / 60_000} minutes, puis limite d'argv`))
})

test('#2499 runbook rendu : geste local, lecteur de groupe et relance conservée', () => {
  const texte = rendre().get('docs/reprise-apres-pause.md')
  assert.match(texte, /Il ne met jamais de PR en file/)
  assert.match(texte, /une seule fois par PR et tête/)
  const reprise = texte.match(/^\*\*Reprise serveur de file\.\*\* (.+)$/m)?.[1]
  assert.ok(reprise, 'paragraphe Reprise serveur de file')
  assert.match(reprise, new RegExp(
    'refus terminal[^.]*#2499[^.]*uniquement[^.]*`AWAITING_CHECKS`[^.]*enfilée par `github-actions`[^.]*' +
    `${DELAI_FILE_MS / 60_000} minutes[^.]*sans course CI \`merge_group\`[^.]*tête de groupe[^.]*identité[^.]*relecture`,
  ))
  assert.match(reprise, /entrée capable de déclencher une course reste observée au-delà de ce seuil, même si sa CI apparaît plus tard/)
  assert.match(reprise, /veille locale poursuit l’observation dans la borne `--file-timeout-min`/)
  assert.match(reprise, /lecture refusée ou non exhaustive reste indéterminée/)
  assert.match(texte, /rerun-failed-jobs.*10 minutes/)
  assert.doesNotMatch(texte, /\$\{DELAI|sondes espacées|reprise serveur.*enqueuePullRequest/)
})
