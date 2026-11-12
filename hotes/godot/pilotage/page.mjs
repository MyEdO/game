// LE LIEU D'UNE RECETTE DE L'HÔTE GODOT DANS LA PAGE (`recette.mjs --web <export>`) : l'export Web servi (`servir.mjs`),
// Chromium piloté par `scripts/recette/lib.mjs`. Mêmes noms que le lieu natif (`natif.mjs`) : `recette.mjs` choisit
// l'un des deux à son lancement.
import { FIL_DE_LA_PAGE_MS, WEBGL_LOGICIEL, servir } from '../servir.mjs'
import { consoleGuard, evaluate, launchSession, poserFichier, waitFor } from '../../../scripts/recette/lib.mjs'

export { ATTENTE_ECHUE, clic, evaluate, geste, molette, realKey, realKeyDown, realKeyUp, shot, sleep, waitFor } from '../../../scripts/recette/lib.mjs'

/** Le champ de fichier que la page pose au choix d'une image (`hotes/godot/pont/fichier.ts`). */
const CHAMP_DE_LA_PLANCHE = 'input[data-planche]'

/** L'export `web` servi, Chromium ouvert sur son menu d'entrée sous `?recette=1` : la session, le serveur du jeu et la
 *  garde de la console. */
export async function ouvrir({ web, modeles, statique, depot, scenario, graine }) {
  const srv = await servir({ web, ...(modeles && { modeles }), ...(statique && { statique: true }), ...(depot && { depot }) })
  const session = await launchSession({ width: 1280, height: 720, timeoutMs: 30000, args: WEBGL_LOGICIEL })
  const garde = consoleGuard(session)
  await session.rpc('Page.navigate', { url: `${srv.url}index.html?scenario=${scenario}&graine=${graine}&recette=1` })
  return { session, srv, garde }
}

/** La page rechargée à deviceScaleFactor 2. */
export async function enHauteDefinition(session) {
  await session.rpc('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false })
  await session.rpc('Page.reload')
}

/** Ce que rend à `entree` le rappel que Godot expose sous `nom` (`Transport.exposer`), une fonction de la page. */
export const rappeler = (session, nom, entree) =>
  evaluate(session, `new Promise((rendre) => globalThis[${JSON.stringify(nom)}](${JSON.stringify(entree)}, rendre))`, { timeoutMs: FIL_DE_LA_PAGE_MS })

/** Le fichier `chemin` donné au choix de fichier que `presser()` ouvre : le choix de la page intercepté, son champ
 *  rempli. */
export async function choisirLeFichier(session, chemin, presser) {
  await session.rpc('Page.setInterceptFileChooserDialog', { enabled: true })
  await presser()
  await waitFor(session, `!!document.querySelector(${JSON.stringify(CHAMP_DE_LA_PLANCHE)})`)
  await poserFichier(session, CHAMP_DE_LA_PLANCHE, chemin)
}
