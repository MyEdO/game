// Conformité des CANAUX gardés : les hooks PreToolUse qui gardent les COMMANDES
// (`commande-piege-guard`, `fermeture-hors-commit-guard`, `hooks-git-contournes-guard`,
// `issue-label-guard`, `runner-capture-guard`)
// doivent couvrir tous les outils par lesquels une commande shell part réellement — pas seulement
// `Bash`/`PowerShell`.
//
// Défaut mesuré 2026-08-03 (#1052) : l'orchestrateur committe via l'outil MCP
// `mcp__lean-ctx__ctx_shell`, hors matcher : la garde n'avait jamais tiré sur ces commits.
//
// `mcp__lean-ctx__ctx_execute` n'est pas un canal gardable en l'état : son `tool_input` (schéma
// tools/list de lean-ctx 3.9.12, relevé 2026-08-03) n'expose aucun champ `command` — il porte
// `code`+`language`, `items` (batch), `path` (fichier). Les gardes lisant `tool_input.command` y
// verraient une chaîne vide : un silence, pas un refus. Le test « canal gardable » ci-dessous
// refuse donc son ajout au matcher tant que les gardes n'extraient pas la commande d'un `code`
// en `language: "shell"` (#1052).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ENTREES_OUTIL, MOTEUR_DE_SURFACE, SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks, compilerMatcher } from '../agents/compat-core.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { REGISTRE } from './registre.mjs'
import { garde as commandePiege } from './commande-piege-guard.mjs'
import { garde as fermetureHorsCommit } from './fermeture-hors-commit-guard.mjs'
import { garde as hooksGitContournes } from './hooks-git-contournes-guard.mjs'
import { garde as issueLabel } from './issue-label-guard.mjs'
import { garde as runnerCapture } from './runner-capture-guard.mjs'
import { LECTURES_LIBRES, OUTILS_CREATION, OUTILS_ECRITURE, OUTILS_SHELL, matcherDOutils, nomOutilDeSurface } from '../guards/lib/contratGarde.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Les DEUX surfaces d'agents, déclarées par `agents:sync` depuis les registres
// (`scripts/agents/compat-core.mjs`, `hooksAttendus`).
const SURFACES = [SURFACE_CLAUDE, SURFACE_CODEX]
/** Les hooks d'une surface, à plat, par le lecteur de la parité. */
const hooksDe = (surface) => aplatirHooks(JSON.parse(readFileSync(join(REPO, surface), 'utf8')), surface)

/** Gardes de COMMANDES, avec le point d'entrée dont le registre les porte. */
const GARDES_COMMANDE = [
  [commandePiege, 'repartiteur.mjs', REGISTRE], [fermetureHorsCommit, 'repartiteur.mjs', REGISTRE],
  [hooksGitContournes, 'repartiteur.mjs', REGISTRE],
  [issueLabel, 'repartiteur.mjs', REGISTRE], [runnerCapture, 'repartiteur.mjs', REGISTRE],
]
/** Les registres des points d'entrée, avec leur script : la déclaration dont `agents:sync` dérive les
 *  surfaces (`ENTREES_OUTIL`). */
const REGISTRES = await Promise.all(ENTREES_OUTIL.map(async ({ script, module, exporte }) => [(await import(`./${module}`))[exporte], script]))
/** Gardes d'ÉCRITURE, DÉRIVÉES des registres : toute garde dont un outil est un canal d'écriture,
 *  avec son point d'entrée et son événement. */
const GARDES_ECRITURE = REGISTRES.flatMap(([registre, script]) => Object.entries(registre).flatMap(([phase, gardes]) =>
  gardes.filter((g) => g.outils.some((o) => OUTILS_ECRITURE.includes(o))).map((g) => [g, script, phase])))

/** Canaux dont le `tool_input` porte un champ `command` — donc gardables par les scripts actuels : la
 *  famille SHELL de la déclaration (`OUTILS_SHELL`). Tout canal ajouté aux `outils` d'une garde de
 *  commande hors de cette famille est un silence, pas une garde. */
const CANAUX_GARDABLES = OUTILS_SHELL
const CANAUX_REQUIS = CANAUX_GARDABLES

/** Le matcher de l'événement `phase` que `surface` déclare pour le point d'entrée `script`. */
const matcherDe = (surface, script, phase = 'PreToolUse') =>
  hooksDe(surface).find((h) => h.phase === phase && h.script === script)?.matcher ?? null
/** Ce matcher couvre-t-il `outil`, lu par le moteur de `surface` (`compilerMatcher`) ? */
const couvre = (surface, script, outil, phase = 'PreToolUse') => {
  const matcher = matcherDe(surface, script, phase)
  return matcher !== null && compilerMatcher(matcher, surface)(nomOutilDeSurface(outil, MOTEUR_DE_SURFACE[surface].surface))
}

test('les gardes de commande sont au registre PreToolUse de leur point d’entrée, câblé sur les DEUX surfaces', () => {
  for (const [garde, script, registre] of GARDES_COMMANDE) {
    assert.ok(registre.PreToolUse.includes(garde), `${garde.nom} hors du registre de ${script}`)
    for (const surface of SURFACES) assert.ok(matcherDe(surface, script) !== null, `${surface} : aucun hook PreToolUse ne lance ${script}`)
  }
})

test('chaque garde de commande couvre TOUS les canaux shell, ctx_shell compris, sur les DEUX surfaces', () => {
  for (const [garde, script] of GARDES_COMMANDE) {
    for (const canal of CANAUX_REQUIS) {
      assert.ok(garde.outils.includes(canal), `${garde.nom} ne garde pas le canal « ${canal} »`)
      for (const surface of SURFACES) {
        assert.ok(
          couvre(surface, script, canal),
          `matcher de ${script} (${surface}) ne couvre pas le canal « ${canal} » — une commande git partie par ce canal échapperait à la garde`,
        )
      }
    }
  }
})

test('tout canal d’une garde de commande est GARDABLE (son tool_input fournit `command`)', () => {
  for (const [garde] of GARDES_COMMANDE) {
    for (const canal of garde.outils) {
      assert.ok(
        CANAUX_GARDABLES.includes(canal),
        `${garde.nom} déclare le canal « ${canal} », dont le tool_input ne fournit pas de champ \`command\` : la garde y serait ` +
        'SILENCIEUSE au lieu de refuser. Adapter la garde à la forme de ce tool_input avant de l\'inscrire.',
      )
    }
  }
})

test('le canal d’édition PRESCRIT (`ctx_patch`, ~/.claude/CLAUDE.md) est un canal d’écriture ET de création', () => {
  for (const famille of [OUTILS_ECRITURE, OUTILS_CREATION]) assert.ok(famille.includes('mcp__lean-ctx__ctx_patch'), famille.join('|'))
})

test('chaque garde d’écriture du registre couvre une FAMILLE entière de canaux d’écriture, sur les DEUX surfaces', () => {
  assert.ok(GARDES_ECRITURE.length > 0, 'aucune garde d’écriture dérivée des registres')
  const memeFamille = (canaux, famille) => canaux.length === famille.length && famille.every((o) => canaux.includes(o))
  for (const [garde, script, phase] of GARDES_ECRITURE) {
    const canaux = garde.outils.filter((o) => OUTILS_ECRITURE.includes(o))
    assert.ok(
      memeFamille(canaux, OUTILS_ECRITURE) || memeFamille(canaux, OUTILS_CREATION),
      `${garde.nom} (${phase}) garde les canaux « ${canaux.join('|')} » : ni OUTILS_ECRITURE ni OUTILS_CREATION — ` +
      'une écriture partie par le canal manquant échapperait à la garde',
    )
    for (const surface of SURFACES) {
      for (const canal of canaux) assert.ok(couvre(surface, script, canal, phase), `matcher ${phase} de ${script} (${surface}) ne couvre pas « ${canal} »`)
    }
  }
})

const LECTURES = LECTURES_LIBRES.map((nu) => `mcp__lean-ctx__${nu}`)
const HORS_LECTURE = ['ctx_execute', 'ctx_edit', 'ctx_patch', 'shell', 'ctx_shell', 'ctx_call', 'ctx_knowledge', 'ctx_session', 'ctx_verify', 'outil_inconnu', 'ctx_outil_inconnu'].map((nu) => `mcp__lean-ctx__${nu}`)

test('le matcher PreToolUse du répartiteur couvre TOUT outil lean-ctx hors `LECTURES_LIBRES`, classé ou non, sur les DEUX surfaces (sinon un refus ne part jamais)', () => {
  for (const surface of SURFACES)
    for (const outil of HORS_LECTURE) assert.ok(couvre(surface, 'repartiteur.mjs', outil), `matcher PreToolUse du répartiteur (${surface}) ne couvre pas « ${outil} »`)
})

test('un outil de `LECTURES_LIBRES` ne lance PAS le répartiteur là où le moteur de la surface sait l’exclure (lookaround)', () => {
  const surfaces = SURFACES.filter((s) => MOTEUR_DE_SURFACE[s].lookaround)
  assert.ok(surfaces.length > 0, 'aucune surface ne sait exclure la LECTURE')
  for (const surface of surfaces)
    for (const outil of LECTURES) assert.equal(couvre(surface, 'repartiteur.mjs', outil), false, `${surface} : « ${outil} » (LECTURE) lance le répartiteur`)
})

test('le matcher ANCRÉ du répartiteur ne prend pas `NotebookEdit` pour `Edit`, sur les DEUX surfaces', () => {
  for (const surface of SURFACES) {
    assert.ok(couvre(surface, 'repartiteur.mjs', 'Edit'), surface)
    assert.equal(couvre(surface, 'repartiteur.mjs', 'NotebookEdit'), false, surface)
  }
})

test('les matchers des points d’entrée couvrent les MÊMES outils sur .claude et .codex, hors la LECTURE que seul Claude sait exclure', () => {
  const echantillon = ['Write', 'Edit', 'Bash', 'PowerShell', 'NotebookEdit', 'Read', ...HORS_LECTURE]
  const points = [...GARDES_COMMANDE.map(([, script]) => [script, 'PreToolUse']), ...GARDES_ECRITURE.map(([, script, phase]) => [script, phase])]
  for (const [script, phase] of points)
    for (const outil of echantillon)
      assert.equal(couvre(SURFACE_CODEX, script, outil, phase), couvre(SURFACE_CLAUDE, script, outil, phase), `${script} ${phase} : « ${outil} » diverge entre les surfaces`)
})

// Un matcher est une REGEX à alternance : un segment inconnu inséré devant les autres (préfixe
// « DESACTIVE-… ») laisse les branches suivantes vivantes — la garde continue de tirer sur `Edit`
// alors que le matcher se lit comme désactivé (#1053, mesuré sur exception-add-guard). Tout segment
// est donc confronté aux noms d'outils réels : désactiver un hook, c'est retirer son entrée.
const OUTILS_CONNUS = [
  'Agent', 'Bash', 'BashOutput', 'Edit', 'ExitPlanMode', 'Glob', 'Grep', 'KillShell',
  'NotebookEdit', 'PowerShell', 'Read', 'SlashCommand', 'Task', 'TodoWrite', 'WebFetch',
  'WebSearch', 'Write', ...OUTILS_ECRITURE,
]
const MCP_TOOL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_]+$/

/** Tous les matchers déclarés, toutes phases confondues, avec leur provenance. Un matcher vide ou
 *  absent vaut « tout outil » : il n'a aucun segment à confronter. */
function tousLesMatchers(surface) {
  return hooksDe(surface).filter((h) => h.matcher !== '').map((h) => ({ phase: h.phase, matcher: h.matcher, scripts: h.command }))
}

/** Les matchers REGEX que les registres dérivent pour `surface` (`matcherDOutils`) : les seuls admis. */
const regexDerivees = (surface) => new Set(REGISTRES.flatMap(([registre]) => Object.values(registre)
  .map((gardes) => matcherDOutils([...new Set(gardes.flatMap((g) => g.outils))], MOTEUR_DE_SURFACE[surface]))
  .filter((m) => m.startsWith('^'))))

test('tout segment de matcher est un NOM D’OUTIL réel, et toute regex est DÉRIVÉE de la table — pas de désactivation par préfixe magique (#1053)', () => {
  for (const surface of SURFACES) {
    const derivees = regexDerivees(surface)
    for (const { phase, matcher, scripts } of tousLesMatchers(surface)) {
      if (matcher.startsWith('^')) {
        assert.ok(derivees.has(matcher), `${surface} (${phase}) : regex "${matcher}" non dérivée des registres (${scripts})`)
        continue
      }
      for (const segment of matcher.split('|')) {
        assert.ok(
          OUTILS_CONNUS.includes(segment) || MCP_TOOL.test(segment),
          `${surface} (${phase}) : matcher "${matcher}" déclare le segment "${segment}", qui n'est ` +
          `aucun outil connu (${scripts}). Un segment inconnu ne désactive rien — les autres ` +
          'branches de l\'alternance continuent de matcher. Retirer l\'entrée du hook pour la désactiver.',
        )
      }
    }
  }
})

test('cas plantés : le préfixe magique et le texte libre sont refusés, mcp__* et outils passent', () => {
  const derivees = regexDerivees(SURFACE_CLAUDE)
  const valide = (m) => (m.startsWith('^') ? derivees.has(m) : m.split('|').every((s) => OUTILS_CONNUS.includes(s) || MCP_TOOL.test(s)))
  assert.equal(valide('DESACTIVE-TEMPORAIREMENT-2026-07-14-absence-user__Write|Edit'), false)
  assert.equal(valide('OFF_Write|Edit'), false)
  assert.equal(valide('Write|Edit|Coucou'), false)
  assert.equal(valide('Write|Edit'), true)
  assert.equal(valide('Bash|PowerShell|mcp__lean-ctx__ctx_shell'), true)
  assert.equal(valide(matcherDe(SURFACE_CLAUDE, 'repartiteur.mjs')), true, 'la regex dérivée')
  assert.equal(valide('^(?:DESACTIVE|Write)$'), false, 'une regex posée à la main')
  assert.equal(valide('Write|mcp__autre__.*'), false, 'un motif non déclaré')
})

/** Lance le point d'entrée RÉEL avec le payload que l'outil `outil` produit (`ctx_shell` par défaut),
 *  et rend sa décision (`'deny'`, ou `null` s'il se tait). */
function decisionOf(script, command, outil = 'mcp__lean-ctx__ctx_shell') {
  const run = lancerHook(script, {
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: outil, tool_input: outil === 'Bash' ? { command } : { command, cwd: REPO },
  })
  assert.equal(run.code, 0, `${script} a quitté en ${run.code} : ${run.err}`)
  return run.specifique?.permissionDecision ?? null
}

test('DRIVER : les gardes de commande décident bien sur un payload ctx_shell (câblage de bout en bout)', () => {
  assert.equal(decisionOf('repartiteur.mjs', 'gh issue close 999999'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'git commit --no-verify -m x'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'gh issue create --title "X" --body "y"'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'git show --stat -- 21d0153b7'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'npx vitest run | tail -20'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'taskkill //F //IM grep.exe', 'Bash'), 'deny')
})

test('DRIVER : une commande anodine passe par le point d’entrée sans décision', () => {
  for (const script of new Set(GARDES_COMMANDE.map(([, s]) => s))) {
    assert.equal(decisionOf(script, 'git status'), null, `${script} bloque un git status`)
  }
})
