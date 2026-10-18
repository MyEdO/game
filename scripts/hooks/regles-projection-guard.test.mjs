// Projection des `.claude/rules/*.md` à `paths:` sur les outils lean-ctx (#2683) : le répartiteur est lancé POUR DE
// VRAI (spawnSync + stdin JSON) dans un arbre temporaire qui porte ses propres règles.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { lancerGit } from '../test/gitDeBanc.mjs'
import { REGISTRE } from './registre.mjs'
import { garde, gardeEdition } from './regles-projection-guard.mjs'
import { PROJECTION } from '../guards/lib/contratGarde.mjs'
import { SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks, compilerMatcher } from '../agents/compat-core.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Pose dans `racine` les règles `donnees` (liste, de corps `donnees`), `sous/chaine` (chaîne unique), `docs`,
 *  `sans-paths`. */
function poserRegles(racine, donnees = 'DONNEES') {
  mkdirSync(join(racine, '.claude', 'rules', 'sous'), { recursive: true })
  const regle = (nom, frontmatter, corps) => writeFileSync(join(racine, '.claude', 'rules', nom), `${frontmatter}# ${corps}\n\n- consigne ${corps}\n`)
  regle('donnees.md', '---\npaths:\n  - "src/data/**"\n---\n\n', donnees)
  regle('sous/chaine.md', '---\npaths: "src/engine/*.ts"\n---\n', 'CHAINE')
  regle('docs.md', '---\npaths:\n  - "docs/**"\n---\n', 'DOCS')
  regle('sans-paths.md', '', 'SANSPATHS')
}

/** Un arbre (`.git` posé) et ses règles (`poserRegles`). */
function arbre() {
  const racine = mkdtempSync(join(tmpdir(), 'regles-projection-'))
  mkdirSync(join(racine, '.git'))
  poserRegles(racine)
  return racine
}

/** Le répertoire temporaire du hook, où vit son état : propre à chaque test, posé par l'environnement. */
let etat = null

/** Le contexte rendu par le répartiteur (`''` s'il se tait), pour un appel lancé dans `racine`. */
function contexte(racine, { evenement = 'PostToolUse', outil = 'mcp__lean-ctx__ctx_read', input, session, agent }) {
  const entree = { hook_event_name: evenement, session_id: session, tool_name: outil, tool_input: input, cwd: racine }
  if (agent) entree.agent_id = agent
  const run = lancerHook('repartiteur.mjs', entree, { env: { ...process.env, TEMP: etat, TMP: etat, TMPDIR: etat } })
  assert.equal(run.code, 0, run.err)
  return run.specifique?.additionalContext ?? ''
}

/** Le test `corps` dans un arbre neuf et une session neuve, arbre et état effacés ensuite. */
function dansUnArbre(corps) {
  return () => {
    const racine = arbre()
    etat = mkdtempSync(join(tmpdir(), 'regles-projection-etat-'))
    try {
      corps(racine, `test-${randomUUID()}`)
    } finally {
      rmSync(racine, { recursive: true, force: true })
      rmSync(etat, { recursive: true, force: true })
    }
  }
}

test('une règle à `paths` correspondante est injectée, corps sans frontmatter ; une non correspondante et une sans `paths` ne le sont pas', dansUnArbre((racine, session) => {
  const rendu = contexte(racine, { input: { path: join(racine, 'src', 'data', 'careers.json') }, session })
  assert.match(rendu, /^Règle \.claude\/rules\/donnees\.md \(projetée sur lean-ctx\) :\n# DONNEES\n\n- consigne DONNEES$/)
  assert.doesNotMatch(rendu, /DOCS|SANSPATHS|CHAINE|paths:/)
}))

test('un frontmatter `paths:` en chaîne unique est lu (règle en sous-dossier)', dansUnArbre((racine, session) => {
  const rendu = contexte(racine, { input: { path: join(racine, 'src', 'engine', 'combat.ts') }, session })
  assert.match(rendu, /^Règle \.claude\/rules\/sous\/chaine\.md \(projetée sur lean-ctx\) :\n# CHAINE/)
}))

test('un `ctx_read` relatif lancé depuis un worktree projette les règles de l’arbre principal, que lean-ctx lit', () => {
  const { racine: principal } = instanceDeDepot()
  const parent = mkdtempSync(join(tmpdir(), 'regles-projection-wt-'))
  const worktree = join(parent, 'wt')
  etat = mkdtempSync(join(tmpdir(), 'regles-projection-etat-'))
  try {
    lancerGit(['worktree', 'add', '--detach', worktree], { cwd: principal })
    poserRegles(principal, 'PRINCIPAL')
    poserRegles(worktree, 'WORKTREE')
    const rendu = contexte(worktree, { input: { path: 'src/data/careers.json' }, session: `test-${randomUUID()}` })
    assert.match(rendu, /^Règle \.claude\/rules\/donnees\.md \(projetée sur lean-ctx\) :\n# PRINCIPAL/)
    assert.doesNotMatch(rendu, /WORKTREE/)
  } finally {
    rmSync(principal, { recursive: true, force: true })
    rmSync(parent, { recursive: true, force: true })
    rmSync(etat, { recursive: true, force: true })
  }
})

test('un 2e appel du même contexte n’injecte rien ; un autre `agent_id` réinjecte', dansUnArbre((racine, session) => {
  const input = { path: join(racine, 'src', 'data', 'careers.json') }
  assert.match(contexte(racine, { input, session }), /DONNEES/)
  assert.equal(contexte(racine, { input: { path: join(racine, 'src', 'data', 'skills.json') }, session }), '')
  assert.match(contexte(racine, { input, session, agent: 'agent-b' }), /DONNEES/)
  assert.equal(contexte(racine, { input, session, agent: 'agent-b' }), '')
}))

test('une compaction de la session efface son état, pour tous ses `agent_id` : l’appel suivant réinjecte', dansUnArbre((racine, session) => {
  const input = { path: join(racine, 'src', 'data', 'careers.json') }
  for (const agent of [undefined, 'agent-b']) {
    assert.match(contexte(racine, { input, session, agent }), /DONNEES/)
    assert.equal(contexte(racine, { input, session, agent }), '')
  }
  const env = { ...process.env, TEMP: etat, TMP: etat, TMPDIR: etat }
  const reprise = lancerHook('regles-projection-oubli.mjs', { hook_event_name: 'SessionStart', source: 'resume', session_id: session }, { env })
  assert.equal(reprise.code, 0, reprise.err)
  assert.equal(contexte(racine, { input, session }), '', 'une reprise garde le contexte : rien à réinjecter')
  const compaction = lancerHook('regles-projection-oubli.mjs', { hook_event_name: 'SessionStart', source: 'compact', session_id: session }, { env })
  assert.equal(compaction.code, 0, compaction.err)
  for (const agent of [undefined, 'agent-b']) assert.match(contexte(racine, { input, session, agent }), /DONNEES/, `agent ${agent}`)
}))

test('`ctx_multi_read` injecte l’union des règles de ses `paths`', dansUnArbre((racine, session) => {
  const rendu = contexte(racine, {
    outil: 'mcp__lean-ctx__ctx_multi_read',
    input: { paths: [join(racine, 'src', 'data', 'careers.json'), join(racine, 'docs', 'x.md'), join(racine, 'README.md')] },
    session,
  })
  assert.match(rendu, /DONNEES/)
  assert.match(rendu, /DOCS/)
  assert.doesNotMatch(rendu, /CHAINE|SANSPATHS/)
}))

test('`ctx_patch op=create` passe en PreToolUse et injecte avant la création', dansUnArbre((racine, session) => {
  const rendu = contexte(racine, {
    evenement: 'PreToolUse', outil: 'mcp__lean-ctx__ctx_patch',
    input: { op: 'create', path: join(racine, 'docs', 'neuf.md'), new_text: 'x\n' }, session,
  })
  assert.match(rendu, /^Règle \.claude\/rules\/docs\.md \(projetée sur lean-ctx\) :/m)
}))

test('un chemin hors de l’arbre de l’appel n’injecte rien, le même dans l’arbre si', dansUnArbre((racine, session) => {
  const ailleurs = arbre()
  try {
    assert.equal(contexte(racine, { input: { path: join(ailleurs, 'src', 'data', 'careers.json') }, session }), '')
    assert.match(contexte(racine, { input: { path: join(racine, 'src', 'data', 'careers.json') }, session }), /DONNEES/, 'le même fichier dans l’arbre de l’appel')
  } finally {
    rmSync(ailleurs, { recursive: true, force: true })
  }
}))

test('CÂBLAGE : les deux gardes, de rôle PROJECTION, sont au REGISTRE, et le matcher PostToolUse généré de .claude/settings.json accepte ctx_read', () => {
  assert.ok(REGISTRE.PostToolUse.includes(garde))
  assert.ok(REGISTRE.PreToolUse.includes(gardeEdition))
  for (const g of [garde, gardeEdition]) assert.equal(g.role, PROJECTION, g.nom)
  const settings = JSON.parse(readFileSync(join(RACINE, SURFACE_CLAUDE), 'utf8'))
  const post = aplatirHooks(settings, SURFACE_CLAUDE).filter((h) => h.phase === 'PostToolUse' && h.script === 'repartiteur.mjs')
  assert.equal(post.length, 1)
  assert.ok(compilerMatcher(post[0].matcher, SURFACE_CLAUDE)('mcp__lean-ctx__ctx_read'), post[0].matcher)
  for (const surface of [SURFACE_CLAUDE, SURFACE_CODEX]) {
    const hooks = aplatirHooks(JSON.parse(readFileSync(join(RACINE, surface), 'utf8')), surface)
    assert.ok(hooks.some((h) => h.phase === 'SessionStart' && h.script === 'regles-projection-oubli.mjs'), `${surface} : aucun SessionStart n’oublie les règles à la compaction`)
  }
})
