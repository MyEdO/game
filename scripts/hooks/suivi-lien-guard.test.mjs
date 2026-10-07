// Lien de session du suivi de vague (#2132) : la commande qui lie, puis la garde RÉELLE par le
// répartiteur (`repartir`), sur le `.git/suivi` d'un dépôt forgé. `repartir` rend les traces sans les
// écrire : rien n'est écrit dans l'arbre ; seul le test du lien déjà tracé les ajoute au journal du
// dépôt forgé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartition.mjs'
import { JOURNAL, epiquesLiees, lignesDuJournal } from '../ops/suivi.mjs'
import { appelsDuSuivi, avertissementIllisible, epiqueLiee, garde } from './suivi-lien-guard.mjs'

const SCRIPTS = JSON.parse(FS.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts

test('epiqueLiee : `ops:suivi -- N` par npm comme en direct ; rien sinon', () => {
  assert.equal(epiqueLiee('npm run ops:suivi -- 1816'), 1816)
  assert.equal(epiqueLiee('node scripts/ops/suivi.mjs 2132 --mesurer --sans-fetch'), 2132)
  assert.equal(epiqueLiee('git status && npm run ops:suivi -- 665'), 665)
  assert.equal(epiqueLiee('npm run ops:suivi -- 1816 --creer "Vague 1816"'), 1816)
  for (const rien of ['npm run ops:suivi', 'npm run ops:suivi -- 0', 'npm run ops:suivi -- 1816 --bogue', 'npm run ops:suivi -- 1 2', 'npm run ops:publier -- --detache', 'git commit -m x', 'echo npm run ops:suivi -- 3', '']) {
    assert.equal(epiqueLiee(rien), null, rien)
  }
})

test('#2460 — les arguments se lisent avec leurs citations : un texte cité est UN argument, par npm comme en direct ; un mot en trop ne lie pas', () => {
  const cite = 'npm run ops:suivi -- 665 --ajouter-etape 2400 "tour 10 publié" --cocher 2400.4'
  assert.deepEqual(appelsDuSuivi(cite), [['665', '--ajouter-etape', '2400', 'tour 10 publié', '--cocher', '2400.4']], 'lu sur le segment que le socle déplie, citations gardées')
  assert.equal(epiqueLiee(cite), 665)
  assert.equal(epiqueLiee("node scripts/ops/suivi.mjs 665 --lot '{\"epique\": 665, \"mutations\": []}'"), 665)
  assert.deepEqual(appelsDuSuivi('npm run ops:suivi -- 665 --rendu > rendu.md 2>&1 | tail -3'), [['665', '--rendu']])
  assert.equal(epiqueLiee('npm run ops:suivi -- 665 --ajouter-etape 2400 tour 10'), null)
})

test('#2460 T1 — l’argv se lit sans ses REDIRECTIONS, sur les jetons : un argument CITÉ qui commence par `>` reste un argument, ce qui suit une redirection aussi', () => {
  assert.deepEqual(appelsDuSuivi('node scripts/ops/suivi.mjs 665 --signaler ">x"'), [['665', '--signaler', '>x']])
  assert.deepEqual(appelsDuSuivi('node scripts/ops/suivi.mjs 665 2>err.txt --rendu'), [['665', '--rendu']])
  const voir = 'npm run ops:suivi -- 665 --signaler "> voir .git/suivi/665.json"'
  assert.deepEqual(appelsDuSuivi(voir), [['665', '--signaler', '> voir .git/suivi/665.json']])
  assert.equal(epiqueLiee(voir), 665)
})

test('#2233 — un `ops:suivi` aux arguments illisibles ne se tait pas : avertissement, aucune trace ; la liste sans argument, rien', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  const shell = (command, entree = { session_id: 's' }) => repartir({ PreToolUse: [garde] }, JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, ...entree,
  }), { env: {}, cwd: racine })
  try {
    const illisible = await shell('npm run ops:suivi -- $N 2>&1 | tail -4')
    assert.deepEqual(illisible.traces, [])
    assert.equal(illisible.sortie?.hookSpecificOutput?.additionalContext, avertissementIllisible(['$N']))
    assert.equal(illisible.sortie?.hookSpecificOutput?.permissionDecision, undefined, 'jamais un refus')
    for (const rien of ['npm run ops:suivi', 'npm run ops:suivi > liste.txt', 'git commit -m x']) {
      assert.deepEqual(await shell(rien), { sortie: null, traces: [] }, rien)
    }
    assert.deepEqual(await shell('npm run ops:suivi -- $N', { session_id: 's', agent_id: 'a1' }), { sortie: null, traces: [] }, 'sous-agent : rien')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
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

test('un lien DÉJÀ au journal pour cette session et cette épique n’est pas retracé ; une autre épique ou une autre session, si', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  // Le répartiteur rend les traces ; `executer` les AJOUTE au fichier (`scripts/hooks/repartition.mjs`).
  const appel = async (command, session_id = 's') => {
    const { traces } = await repartir({ PreToolUse: [garde] }, JSON.stringify({
      hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, session_id,
    }), { env: {}, cwd: racine })
    for (const { fichier, ligne } of traces) {
      FS.mkdirSync(dirname(fichier), { recursive: true })
      FS.appendFileSync(fichier, ligne)
    }
    return traces.length
  }
  const journal = () => lignesDuJournal(FS.readFileSync(join(racine, '.git', 'suivi', JOURNAL), 'utf8')).map((l) => [l.session, l.epique])
  try {
    assert.equal(await appel('npm run ops:suivi -- 1816'), 1)
    assert.equal(await appel('npm run ops:suivi -- 1816'), 0, 'deux appels identiques : une seule ligne')
    assert.deepEqual(journal(), [['s', 1816]])
    assert.equal(await appel('npm run ops:suivi -- 2132'), 1, 'une autre épique : une ligne de plus')
    assert.equal(await appel('npm run ops:suivi -- 1816', 'autre'), 1, 'une autre session : une ligne de plus')
    assert.deepEqual(journal(), [['s', 1816], ['s', 2132], ['autre', 1816]])
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('#2460 — le lot `<N> [--session …] [--json] --<geste> …` lie la session à N ; le lecteur `--session … --json [--depuis …]` ne lie rien et n’avertit pas', async () => {
  assert.equal(epiqueLiee('node scripts/ops/suivi.mjs 2279 --session abc --json --ajouter-item 12 "un libellé"'), 2279)
  assert.equal(epiqueLiee('npm run ops:suivi -- 2279 --cocher 12.1'), 2279)
  assert.equal(epiqueLiee('npm run ops:suivi -- --session abc --json'), null)
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  const shell = (command) => repartir({ PreToolUse: [garde] }, JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, session_id: 's',
  }), { env: {}, cwd: racine })
  try {
    assert.deepEqual(await shell('npm run ops:suivi -- --session abc --json'), { sortie: null, traces: [] })
    assert.deepEqual(await shell('npm run ops:suivi -- --session abc --json --depuis 0123abcd'), { sortie: null, traces: [] }, '--depuis : ni lien, ni avertissement')
    const lie = await shell('npm run ops:suivi -- 2279 --ajouter-etape 12 "brief écrit"')
    assert.deepEqual(lignesDuJournal(lie.traces[0].ligne).map((l) => [l.session, l.epique]), [['s', 2279]])
    const trop = await shell('npm run ops:suivi -- 2279 --ajouter-etape 12 brief écrit')
    assert.deepEqual(trop.traces, [])
    assert.match(trop.sortie?.hookSpecificOutput?.additionalContext, /argument en trop « écrit »/)
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})
