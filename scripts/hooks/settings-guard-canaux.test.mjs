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
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Les DEUX surfaces d'agents : `.codex/hooks.json` est le miroir de `.claude/settings.json`
// (parité par clef `phase|matcher|script|timeout`, `scripts/agents/compat-core.mjs:167`).
// Étendre un matcher d'un seul côté casse `npm run agents:check` au pre-commit du repo ENTIER.
const SURFACES = [join(REPO, '.claude', 'settings.json'), join(REPO, '.codex', 'hooks.json')]

/** Gardes de COMMANDES : nom de script → canaux qui doivent tous matcher. */
const GARDES_COMMANDE = [
  'commande-piege-guard', 'solde-ticket-guard', 'issue-label-guard', 'runner-capture-guard',
]
/** Gardes d'ÉCRITURE : mêmes exigences de parité, sur les canaux qui portent un contenu. */
const GARDES_ECRITURE = ['memoire-tombale-guard']

/** Canaux dont le `tool_input` porte un champ `command` — donc gardables par les scripts actuels.
 *  Liste NOMINATIVE : tout canal ajouté à un matcher hors de cette liste est un silence, pas une
 *  garde (cf. en-tête sur `ctx_execute`). */
const CANAUX_GARDABLES = ['Bash', 'PowerShell', 'mcp__lean-ctx__ctx_shell']
const CANAUX_REQUIS = CANAUX_GARDABLES

/** Matchers PreToolUse d'une surface dont au moins un hook lance `<script>.mjs`. */
function matchersFor(surface, script) {
  const config = JSON.parse(readFileSync(surface, 'utf8'))
  return (config.hooks?.PreToolUse ?? [])
    .filter((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes(`${script}.mjs`)))
    .map((entry) => String(entry.matcher ?? ''))
}

test('les gardes de commande sont câblées en PreToolUse sur les DEUX surfaces (pas de passe à vide)', () => {
  for (const surface of SURFACES) {
    for (const script of GARDES_COMMANDE) {
      assert.ok(
        matchersFor(surface, script).length > 0,
        `${surface} : aucun hook PreToolUse ne lance ${script}.mjs`,
      )
    }
  }
})

test('chaque garde de commande couvre TOUS les canaux shell, ctx_shell compris, sur les DEUX surfaces', () => {
  for (const surface of SURFACES) {
    for (const script of GARDES_COMMANDE) {
      for (const matcher of matchersFor(surface, script)) {
        for (const canal of CANAUX_REQUIS) {
          assert.ok(
            new RegExp(matcher).test(canal),
            `matcher "${matcher}" (${script}, ${surface}) ne couvre pas le canal "${canal}" — ` +
            'une commande git partie par ce canal échapperait à la garde',
          )
        }
      }
    }
  }
})

test('tout canal listé au matcher est GARDABLE (son tool_input fournit `command`)', () => {
  for (const surface of SURFACES) {
    for (const script of GARDES_COMMANDE) {
      for (const matcher of matchersFor(surface, script)) {
        for (const canal of matcher.split('|')) {
          assert.ok(
            CANAUX_GARDABLES.includes(canal),
            `matcher "${matcher}" (${script}, ${surface}) déclare le canal "${canal}", dont le ` +
            'tool_input ne fournit pas de champ `command` : la garde y serait SILENCIEUSE au lieu ' +
            'de refuser. Adapter le script à la forme de ce tool_input avant de l\'inscrire.',
          )
        }
      }
    }
  }
})

test('les matchers des gardes sont IDENTIQUES entre .claude et .codex (parité agents:check)', () => {
  for (const script of [...GARDES_COMMANDE, ...GARDES_ECRITURE]) {
    const [claude, codex] = SURFACES.map((s) => matchersFor(s, script))
    assert.deepEqual(
      codex, claude,
      `matchers divergents pour ${script} entre .claude/settings.json et .codex/hooks.json — ` +
      '`npm run agents:check` refuserait tout commit du repo',
    )
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

/** Tous les matchers déclarés, toutes phases confondues, avec leur provenance. */
function tousLesMatchers(surface) {
  const config = JSON.parse(readFileSync(surface, 'utf8'))
  const out = []
  for (const [phase, entrees] of Object.entries(config.hooks ?? {})) {
    for (const entree of entrees ?? []) {
      if (entree.matcher == null) continue
      const scripts = (entree.hooks ?? []).map((h) => String(h.command ?? '')).join(' ')
      out.push({ phase, matcher: String(entree.matcher), scripts })
    }
  }
  return out
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

/** Lance le hook RÉEL avec le payload que `mcp__lean-ctx__ctx_shell` produit, et rend sa décision
 *  (`'deny'`/`'ask'`, ou `null` si le hook se tait). */
function decisionOf(script, command) {
  const payload = JSON.stringify({
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: REPO },
  })
  const run = spawnSync(process.execPath, [join(REPO, 'scripts', 'hooks', script)], {
    input: payload, encoding: 'utf8', cwd: REPO,
  })
  assert.equal(run.status, 0, `${script} a quitté en ${run.status} : ${run.stderr}`)
  if (!run.stdout.trim()) return null
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecision
}

test('DRIVER : les gardes de commande décident bien sur un payload ctx_shell (câblage de bout en bout)', () => {
  // Fermeture d'un ticket sans solde : deny quoi qu'il arrive (`.claude/soldes/999999.md` n'existe
  // pas — et un palier atteint denierait tout autant).
  assert.equal(decisionOf('solde-ticket-guard.mjs', 'git commit -m "feat: x (corrige #999999)"'), 'deny')
  assert.equal(decisionOf('issue-label-guard.mjs', 'gh issue create --title "X" --body "y"'), 'deny')
  assert.equal(decisionOf('commande-piege-guard.mjs', 'git show --stat -- 21d0153b7'), 'deny')
  assert.equal(decisionOf('runner-capture-guard.mjs', 'npx vitest run | tail -20'), 'deny')
})

test('DRIVER : une commande anodine passe par toutes les gardes de commande sans décision', () => {
  for (const script of GARDES_COMMANDE) {
    assert.equal(decisionOf(`${script}.mjs`, 'git status'), null, `${script} bloque un git status`)
  }
})
