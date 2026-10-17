// CONTRAT — tout geste qui déploie en production passe par une confirmation de `.claude/settings.json`
// (`permissions.ask`) : choix utilisateur du 2026-10-17 (#2712), option « Confirmation » à la question
// « Bloquer les déploiements en production par une garde, au lieu de vous demander confirmation ? ».
// Les déploiements se DÉRIVENT des scripts npm qui lancent `wrangler deploy` ou le workflow
// `deploy.yml`, et de ceux qui les relaient ; un workflow se déclenche aussi par son nom, un autre dépôt
// (`-R`) ou l'API REST `dispatches`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lireJson = (url) => JSON.parse(readFileSync(url, 'utf8'))
const { ask: ASK, allow: ALLOW } = lireJson(new URL('../../.claude/settings.json', import.meta.url)).permissions
const RACINE = lireJson(new URL('../../package.json', import.meta.url)).scripts
const SERVEUR = lireJson(new URL('../../server/package.json', import.meta.url)).scripts

const DEPLOIE = /\b(wrangler deploy|gh workflow run deploy\.yml)\b/

/** Les règles `Bash(<motif>)` de `ask`, `*` joker n'importe où (doc permissions). */
const motifs = ASK.flatMap((r) => /^Bash\((.+)\)$/.exec(r)?.slice(1) ?? [])
  .map((m) => new RegExp(`^${m.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`))
const confirme = (commande) => motifs.some((m) => m.test(commande))

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

test('chaque écriture d’une commande npm ou wrangler qui déploie en production est sous `permissions.ask` (outil Bash)', () => {
  const commandes = commandesQuiDeploient()
  assert.ok(commandes.includes('npm run relay:deploy'), 'la dérivation doit trouver le relais du serveur coop')
  assert.deepEqual(commandes.filter((c) => !confirme(c)), [])
})

/** Les outils lean-ctx qui EXÉCUTENT une commande : `ask` ne couvre que l'outil Bash (#2721). */
const SHELLS_LEAN_CTX = ['ctx_shell', 'ctx_shell_background', 'ctx_call', 'shell'].map((outil) => `mcp__lean-ctx__${outil}`)

test('aucun shell hors Bash n’est pré-approuvé : un déploiement par `ctx_shell` passerait sans confirmation', () => {
  const ouvre = (regle, outil) => regle === outil || regle === 'mcp__lean-ctx' || (regle.endsWith('*') && outil.startsWith(regle.slice(0, -1)))
  assert.deepEqual(SHELLS_LEAN_CTX.filter((outil) => ALLOW.some((regle) => ouvre(regle, outil))), [])
  assert.ok(ALLOW.includes('mcp__lean-ctx__ctx_read'), 'témoin : la lecture lean-ctx reste pré-approuvée')
})

test('le déclenchement d’un workflow par le connecteur GitHub est sous `permissions.ask`', () => {
  assert.ok(ASK.includes('mcp__github__actions_run_trigger'))
})

test('une commande qui ne déploie pas reste hors confirmation', () => {
  for (const commande of ['npm run relay:dev', 'npm run dev', 'npm --prefix server run dev', 'gh workflow list', 'gh api repos/MyEdO/game/actions/runs']) assert.equal(confirme(commande), false, commande)
})
