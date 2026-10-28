// Le TRAVAILLEUR de la garde de chargement (#3058, `scripts/guards/chargement-en-premier.mjs`) :
// `node chargementDUnModule.mjs <racine> <module relatif>…`. Chaque module se charge EN PREMIER par le module runner
// de Vite, celui de `runnerImport` (`scripts/hote-texte.mjs`), avec le greffon `proseSource()` des hôtes
// (`scripts/entree-d-hote.mjs`) : un ModuleRunner neuf par module, donc un graphe de modules neuf ; le serveur, et
// avec lui le cache des transformations, est partagé par le lot.
// Rend sur stdout une ligne `@@chargement <JSON>` par module : son échec, ou `null` — l'erreur et ses premières
// lignes de pile dans le code chargé. Code 0, sauf panne du travailleur, ou erreur hors de tout chargement
// (minuteur échu d'un module chargé).
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer, createServerModuleRunner } from 'vite'
import { proseSource } from '../../source/prose-source-plugin.mjs'

/** Préfixe d'une ligne de verdict sur stdout. */
export const MARQUE_DE_VERDICT = '@@chargement '

/** Lignes de pile retenues par échec. */
const LIGNES_DE_PILE = 4

/** L'échec d'un chargement : `Nom: message` (première ligne) et les premières frames de pile dans le code chargé —
 *  sous `racine`, hors de `node_modules/` et de `scripts/` —, en chemins relatifs. */
export function echecDe(racine, e) {
  const tete = `${e?.name ?? 'Error'}: ${String(e?.message ?? e).split('\n')[0]}`
  const prefixe = `${racine.replace(/\\/g, '/').replace(/\/$/, '')}/`
  const url = pathToFileURL(prefixe).href
  const pile = String(e?.stack ?? '').split('\n')
    .map((l) => l.replace(/\\/g, '/'))
    .filter((l) => /^\s+at /.test(l) && (l.includes(url) || l.includes(prefixe)))
    .map((l) => l.replaceAll(url, '').replaceAll(prefixe, '').replace(/\?[^:)\s]*/g, '').trim())
    .filter((l) => !/(\(|at (async )?)(node_modules|scripts)\//.test(l))
    .slice(0, LIGNES_DE_PILE)
  return { erreur: tete, pile }
}

/** Charge chaque module de `modules` EN PREMIER, un ModuleRunner neuf par module, et rend son verdict par `rendre(module, échec | null)`. */
export async function chargerChacun(racine, modules, rendre) {
  const serveur = await createServer({
    root: racine, configFile: false, logLevel: 'silent', plugins: [proseSource()], appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, fs: { strict: false } },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  try {
    for (const rel of modules) {
      let echec = null
      const runner = createServerModuleRunner(serveur.environments.ssr, { hmr: false })
      try {
        await runner.import(join(racine, rel))
      } catch (e) {
        echec = echecDe(racine, e)
      } finally {
        await runner.close()
      }
      rendre(rel, echec)
    }
  } finally {
    await serveur.close()
  }
}

if (import.meta.main) {
  const [racine, ...modules] = process.argv.slice(2)
  await chargerChacun(racine, modules, (module, echec) => process.stdout.write(`${MARQUE_DE_VERDICT}${JSON.stringify({ module, echec })}\n`))
  // Un tour de minuteurs avant la sortie : l'erreur d'un minuteur échu d'un module chargé fait tomber le travailleur.
  await new Promise((fin) => setTimeout(fin, 0))
  process.exit(0)
}
