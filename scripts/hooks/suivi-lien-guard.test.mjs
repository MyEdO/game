// Lien de session du suivi de vague (#2132, lot 2) : la commande qui lie, puis la garde RÉELLE par le
// répartiteur (`repartir`), sur le `.git/suivi` d'un dépôt forgé. `repartir` rend les traces sans les
// écrire : rien n'est écrit, ni ici ni dans l'arbre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartiteur.mjs'
import { JOURNAL, epiqueLiee, epiquesLiees, garde, lignesDuJournal } from './suivi-lien-guard.mjs'

const SCRIPTS = JSON.parse(FS.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts

test('epiqueLiee : `ops:suivi -- N` par npm comme en direct ; rien sinon', () => {
  assert.equal(epiqueLiee('npm run ops:suivi -- 1816'), 1816)
  assert.equal(epiqueLiee('node scripts/ops/suivi.mjs 2132 --sans-fetch'), 2132)
  assert.equal(epiqueLiee('git status && npm run ops:suivi -- 665'), 665)
  assert.equal(epiqueLiee('npm run ops:suivi -- 1816 --creer'), 1816)
  for (const rien of ['npm run ops:suivi', 'npm run ops:suivi -- 0', 'npm run ops:suivi -- 1816 --bogue', 'npm run ops:suivi -- 1 2', 'npm run ops:publier -- --detache', 'git commit -m x', 'echo npm run ops:suivi -- 3', '']) {
    assert.equal(epiqueLiee(rien), null, rien)
  }
})

test('T3 — le lien est TRACÉ au journal du dépôt pour la session principale ; rien en sous-agent ni sans session_id', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  const shell = (command, entree) => repartir({ PreToolUse: [garde] }, JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, ...entree,
  }), { env: {}, cwd: racine })
  try {
    const lie = await shell('npm run ops:suivi -- 1816', { session_id: 's' })
    assert.equal(lie.sortie, null, 'la garde ne rend jamais de contexte')
    assert.equal(lie.traces.length, 1)
    const { fichier } = lie.traces[0]
    assert.deepEqual([basename(dirname(fichier)), basename(fichier)], ['suivi', JOURNAL])
    assert.equal(FS.realpathSync(dirname(dirname(fichier))), FS.realpathSync(join(racine, '.git')), 'le journal du dépôt de la commande')
    const lignes = lignesDuJournal(lie.traces[0].ligne)
    assert.deepEqual(lignes.map((l) => [l.session, l.epique]), [['s', 1816]])
    assert.deepEqual(epiquesLiees(lignes, 's'), [1816])
    assert.deepEqual(epiquesLiees(lignes, 'autre'), [])
    for (const entree of [{ session_id: 's', agent_id: 'a1' }, {}, { session_id: '' }]) {
      assert.deepEqual((await shell('npm run ops:suivi -- 1816', entree)).traces, [], JSON.stringify(entree))
    }
    assert.deepEqual((await shell('git commit -m x', { session_id: 's' })).traces, [])
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})
