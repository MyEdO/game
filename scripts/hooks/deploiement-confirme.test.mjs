// CONTRAT — tout geste qui déploie en production passe par une confirmation de `.claude/settings.json`
// (`permissions.ask`) : choix utilisateur du 2026-10-17 (#2712), option « Confirmation » à la question
// « Bloquer les déploiements en production par une garde, au lieu de vous demander confirmation ? ».
// Les déploiements se DÉRIVENT des scripts npm qui lancent `wrangler deploy` ou le workflow
// `deploy.yml`, et de ceux qui les relaient ; un workflow se déclenche aussi par son nom, un autre dépôt
// (`-R`) ou l'API REST `dispatches`. Les motifs `ask` ne couvrent que Bash : un shell hors Bash, pré-approuvé
// (`ctx_shell`), est renvoyé à Bash par `confirmation-hors-bash-guard.mjs` (#2721).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { motifsDeConfirmation, regleDeConfirmation, garde } from './confirmation-hors-bash-guard.mjs'
import { repartir } from './repartition.mjs'
import { REGISTRE } from './registre.mjs'

const lireJson = (url) => JSON.parse(readFileSync(url, 'utf8'))
const SETTINGS = lireJson(new URL('../../.claude/settings.json', import.meta.url))
const { ask: ASK, allow: ALLOW } = SETTINGS.permissions
const RACINE = lireJson(new URL('../../package.json', import.meta.url)).scripts
const SERVEUR = lireJson(new URL('../../server/package.json', import.meta.url)).scripts
const REPO = fileURLToPath(new URL('../..', import.meta.url))

const DEPLOIE = /\b(wrangler deploy|gh workflow run deploy\.yml)\b/
const MOTIFS = motifsDeConfirmation(SETTINGS)
const confirme = (commande) => regleDeConfirmation(commande, MOTIFS) !== null

/** Les commandes qui déploient : les outils eux-mêmes, puis chaque script npm qui les lance ou relaie un tel
 *  script, sous les écritures que npm accepte (options avant ou après `run`). */
function commandesQuiDeploient() {
  const serveur = Object.keys(SERVEUR).filter((nom) => DEPLOIE.test(SERVEUR[nom]))
  const relais = new RegExp(`npm --prefix server run (${serveur.join('|')})\\b`)
  const racine = Object.keys(RACINE).filter((nom) => DEPLOIE.test(RACINE[nom]) || (serveur.length > 0 && relais.test(RACINE[nom])))
  return [
    'wrangler deploy', 'npx wrangler deploy', 'npx --yes wrangler@3 deploy', 'gh workflow run deploy.yml --ref main',
    'gh workflow run "Déploiement prod" --ref main', 'gh workflow run -R MyEdO/game deploy.yml', 'GH_REPO=MyEdO/game gh workflow run deploy.yml',
    'gh api -X POST repos/MyEdO/game/actions/workflows/deploy.yml/dispatches -f ref=main',
    'gh run rerun 123456', 'gh run rerun 123456 --failed', 'gh api -X POST repos/MyEdO/game/actions/runs/123456/rerun',
    ...serveur.flatMap((nom) => [`npm --prefix server run ${nom}`, `npm run --prefix server ${nom}`, `npm run ${nom}`, `npm run -s ${nom}`]),
    ...racine.flatMap((nom) => [`npm run ${nom}`, `npm run --silent ${nom}`, `npm run -s ${nom}`]),
  ]
}
const BANALES = ['npm run relay:dev', 'npm run dev', 'npm --prefix server run dev', 'gh workflow list', 'gh api repos/MyEdO/game/actions/runs', 'git status']

test('chaque écriture d’une commande npm ou wrangler qui déploie en production est sous `permissions.ask` (outil Bash)', () => {
  const commandes = commandesQuiDeploient()
  assert.ok(commandes.includes('npm run relay:deploy'), 'la dérivation doit trouver le relais du serveur coop')
  assert.deepEqual(commandes.filter((c) => !confirme(c)), [])
})

test('le déclenchement d’un workflow par le connecteur GitHub est sous `permissions.ask`', () => {
  assert.ok(ASK.includes('mcp__github__actions_run_trigger'))
})

test('une commande qui ne déploie pas reste hors confirmation', () => {
  for (const commande of BANALES) assert.equal(confirme(commande), false, commande)
})

test('ctx_shell reste pré-approuvé (arbitrage du 2026-09-28) ; la garde couvre chaque shell hors Bash, et lui seul', () => {
  assert.ok(ALLOW.includes('mcp__lean-ctx__ctx_shell'))
  assert.ok(garde.outils.includes('mcp__lean-ctx__ctx_shell') && garde.outils.includes('PowerShell'))
  assert.ok(!garde.outils.includes('Bash'), 'Bash porte la confirmation de `permissions.ask`')
})

test('chaque motif `ask` de Bash, passé par ctx_shell, est REFUSÉ et renvoyé à Bash ; une commande banale passe', () => {
  const parCtxShell = (command) => garde.evaluer({ hook_event_name: 'PreToolUse', tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: REPO } })
  assert.ok(MOTIFS.length > 0, 'témoin : des motifs `ask` de Bash sont lus')
  for (const { regle } of MOTIFS) {
    const commande = regle.slice('Bash('.length, -1).replaceAll('*', 'x')
    const verdict = parCtxShell(commande)
    assert.equal(verdict?.decision, 'deny', regle)
    assert.match(verdict.raison, /Relance-la par Bash\.$/, regle)
  }
  for (const commande of commandesQuiDeploient()) assert.equal(parCtxShell(commande)?.decision, 'deny', commande)
  for (const commande of BANALES) assert.equal(parCtxShell(commande), null, commande)
})

test('le répartiteur, de bout en bout : `ctx_shell` qui déploie est refusé par la garde, une commande banale ne l’est pas', async () => {
  const appel = (command) => repartir(REGISTRE, JSON.stringify({ hook_event_name: 'PreToolUse', cwd: REPO, tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: REPO } }), { cwd: REPO, env: { CLAUDE_PROJECT_DIR: REPO } })
  const deploie = (await appel('npm run relay:deploy')).sortie?.hookSpecificOutput
  assert.equal(deploie?.permissionDecision, 'deny')
  assert.match(deploie.permissionDecisionReason, /« npm run relay:deploy » est soumise à confirmation \(`Bash\([^`]+\)`.*Relance-la par Bash\./)
  assert.notEqual((await appel('git status')).sortie?.hookSpecificOutput?.permissionDecision, 'deny')
})
