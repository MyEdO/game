// Conformité des CANAUX gardés : les hooks PreToolUse qui gardent les COMMANDES
// (`commande-piege-guard`, `solde-ticket-guard`, `issue-label-guard`, `runner-capture-guard`)
// doivent couvrir tous les outils par lesquels une commande shell part réellement — pas seulement
// `Bash`/`PowerShell`.
//
// Défaut mesuré 2026-08-03 (#1052) : l'orchestrateur committe via l'outil MCP
// `mcp__lean-ctx__ctx_shell`, hors matcher — le compteur de palier était à 32 pour un palier de 10,
// la garde n'ayant jamais tiré.
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
import { SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from '../agents/compat-core.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { REGISTRE } from './registre.mjs'
import { REGISTRE_SOLDE } from './solde-ticket-hook.mjs'
import { garde as commandePiege } from './commande-piege-guard.mjs'
import { garde as solde } from './solde-ticket-guard.mjs'
import { garde as issueLabel } from './issue-label-guard.mjs'
import { garde as runnerCapture } from './runner-capture-guard.mjs'
import { garde as memoireTombale } from './memoire-tombale-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Les DEUX surfaces d'agents, déclarées par `agents:sync` depuis les registres
// (`scripts/agents/compat-core.mjs`, `hooksAttendus`).
const SURFACES = [SURFACE_CLAUDE, SURFACE_CODEX]
/** Les hooks d'une surface, à plat, par le lecteur de la parité. */
const hooksDe = (surface) => aplatirHooks(JSON.parse(readFileSync(join(REPO, surface), 'utf8')), surface)

/** Gardes de COMMANDES, avec le point d'entrée dont le registre les porte. */
const GARDES_COMMANDE = [
  [commandePiege, 'repartiteur.mjs', REGISTRE], [solde, 'solde-ticket-hook.mjs', REGISTRE_SOLDE],
  [issueLabel, 'repartiteur.mjs', REGISTRE], [runnerCapture, 'repartiteur.mjs', REGISTRE],
]
/** Gardes d'ÉCRITURE : mêmes exigences de parité, sur les canaux qui portent un contenu. */
const GARDES_ECRITURE = [[memoireTombale, 'repartiteur.mjs', REGISTRE]]

/** Canaux dont le `tool_input` porte un champ `command` — donc gardables par les scripts actuels.
 *  Liste NOMINATIVE : tout canal ajouté aux `outils` d'une garde de commande hors de cette liste est
 *  un silence, pas une garde (cf. en-tête sur `ctx_execute`). */
const CANAUX_GARDABLES = ['Bash', 'PowerShell', 'mcp__lean-ctx__ctx_shell']
const CANAUX_REQUIS = CANAUX_GARDABLES

/** Le matcher PreToolUse que `surface` déclare pour le point d'entrée `script`. */
const matcherDe = (surface, script) =>
  hooksDe(surface).find((h) => h.phase === 'PreToolUse' && h.script === script)?.matcher ?? null

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
          matcherDe(surface, script).split('|').includes(canal),
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

test('les matchers des points d’entrée sont IDENTIQUES entre .claude et .codex', () => {
  for (const [, script] of [...GARDES_COMMANDE, ...GARDES_ECRITURE]) {
    const [claude, codex] = SURFACES.map((s) => matcherDe(s, script))
    assert.equal(codex, claude, `matchers divergents pour ${script} entre .claude/settings.json et .codex/hooks.json`)
  }
})

// Un matcher est une REGEX à alternance : un segment inconnu inséré devant les autres (préfixe
// « DESACTIVE-… ») laisse les branches suivantes vivantes — la garde continue de tirer sur `Edit`
// alors que le matcher se lit comme désactivé (#1053, mesuré sur exception-add-guard). Tout segment
// est donc confronté aux noms d'outils réels : désactiver un hook, c'est retirer son entrée.
const OUTILS_CONNUS = [
  'Agent', 'Bash', 'BashOutput', 'Edit', 'ExitPlanMode', 'Glob', 'Grep', 'KillShell',
  'NotebookEdit', 'PowerShell', 'Read', 'SlashCommand', 'Task', 'TodoWrite', 'WebFetch',
  'WebSearch', 'Write',
]
const MCP_TOOL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_]+$/

/** Tous les matchers déclarés, toutes phases confondues, avec leur provenance. Un matcher vide ou
 *  absent vaut « tout outil » : il n'a aucun segment à confronter. */
function tousLesMatchers(surface) {
  return hooksDe(surface).filter((h) => h.matcher !== '').map((h) => ({ phase: h.phase, matcher: h.matcher, scripts: h.command }))
}

test('tout segment de matcher est un NOM D’OUTIL réel — pas de désactivation par préfixe magique (#1053)', () => {
  for (const surface of SURFACES) {
    for (const { phase, matcher, scripts } of tousLesMatchers(surface)) {
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
  const valide = (m) => m.split('|').every((s) => OUTILS_CONNUS.includes(s) || MCP_TOOL.test(s))
  assert.equal(valide('DESACTIVE-TEMPORAIREMENT-2026-07-14-absence-user__Write|Edit'), false)
  assert.equal(valide('OFF_Write|Edit'), false)
  assert.equal(valide('Write|Edit|Coucou'), false)
  assert.equal(valide('Write|Edit'), true)
  assert.equal(valide('Bash|PowerShell|mcp__lean-ctx__ctx_shell'), true)
})

/** Lance le point d'entrée RÉEL avec le payload que `mcp__lean-ctx__ctx_shell` produit, et rend sa
 *  décision (`'deny'`, ou `null` s'il se tait). */
function decisionOf(script, command) {
  const run = lancerHook(script, {
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: REPO },
  })
  assert.equal(run.code, 0, `${script} a quitté en ${run.code} : ${run.err}`)
  return run.specifique?.permissionDecision ?? null
}

test('DRIVER : les gardes de commande décident bien sur un payload ctx_shell (câblage de bout en bout)', () => {
  // Fermeture d'un ticket sans solde : deny quoi qu'il arrive (`.claude/soldes/999999.md` n'existe
  // pas — et un palier atteint denierait tout autant).
  assert.equal(decisionOf('solde-ticket-hook.mjs', 'git commit -m "feat: x (corrige #999999)"'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'gh issue create --title "X" --body "y"'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'git show --stat -- 21d0153b7'), 'deny')
  assert.equal(decisionOf('repartiteur.mjs', 'npx vitest run | tail -20'), 'deny')
})

test('DRIVER : une commande anodine passe par les deux points d’entrée sans décision', () => {
  for (const script of new Set(GARDES_COMMANDE.map(([, s]) => s))) {
    assert.equal(decisionOf(script, 'git status'), null, `${script} bloque un git status`)
  }
})
