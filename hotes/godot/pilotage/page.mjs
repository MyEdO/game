// LE LIEU D'UNE RECETTE DE L'HÔTE GODOT DANS LA PAGE (`recette.mjs --web <export>`) : l'export Web servi (`servir.mjs`),
// Chromium piloté par `scripts/recette/lib.mjs`. Mêmes noms que le lieu natif (`natif.mjs`) : `recette.mjs` choisit
// l'un des deux à son lancement.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FIL_DE_LA_PAGE_MS, WEBGL_LOGICIEL, servir } from '../servir.mjs'
import { consoleGuard, evaluate, launchSession, poserFichier, sleep, waitFor } from '../../../scripts/recette/lib.mjs'

export { ATTENTE_ECHUE, clic, evaluate, geste, molette, realKey, realKeyDown, realKeyUp, shot, sleep, waitFor } from '../../../scripts/recette/lib.mjs'

/** Le champ de fichier que la page pose au choix d'un fichier (`hotes/godot/pont/fichier.ts`). */
const CHAMP_DU_FICHIER = 'input[data-fichier]'
/** Le plus long temps d'un téléchargement de la page. */
const TELECHARGEMENT_MS = 10000

/** L'export `web` servi, Chromium ouvert sur son menu d'entrée sous `?recette=1` : la session, le serveur du jeu et la
 *  garde de la console. */
export async function ouvrir({ web, modeles, statique, depot, scenario, graine }) {
  const srv = await servir({ web, ...(modeles && { modeles }), ...(statique && { statique: true }), ...(depot && { depot }) })
  const session = await launchSession({ width: 1280, height: 720, timeoutMs: 30000, args: WEBGL_LOGICIEL })
  const garde = consoleGuard(session)
  await session.rpc('Page.navigate', { url: `${srv.url}index.html?scenario=${scenario}&graine=${graine}&recette=1` })
  return { session, srv, garde }
}

/** La page rechargée : son pont et ce que Godot y publie repartent de rien, son stockage reste. */
export const recharger = (session) => session.rpc('Page.reload')

/** La page rechargée à deviceScaleFactor 2. */
export async function enHauteDefinition(session) {
  await session.rpc('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false })
  await recharger(session)
}

/** Les gains du graphe audio de la page relevés dès son prochain chargement, par rang de création (`wfrpGains`), où
 *  l'export porte le volume de chaque bus : vrai, la page a ce graphe. */
export async function releverLesGains(session) {
  await session.rpc('Page.addScriptToEvaluateOnNewDocument', {
    source: 'globalThis.wfrpGains = []; { const creer = BaseAudioContext.prototype.createGain; BaseAudioContext.prototype.createGain = function () { const gain = creer.call(this); wfrpGains.push(gain); return gain } }',
  })
  return true
}

/** Ce que rend à `entree` le rappel que Godot expose sous `nom` (`Transport.exposer`), une fonction de la page. */
export const rappeler = (session, nom, entree) =>
  evaluate(session, `new Promise((rendre) => globalThis[${JSON.stringify(nom)}](${JSON.stringify(entree)}, rendre))`, { timeoutMs: FIL_DE_LA_PAGE_MS })

/** Le fichier `chemin` donné au choix de fichier que `presser()` ouvre : le choix de la page intercepté, son champ
 *  rempli. */
export async function choisirLeFichier(session, chemin, presser) {
  await session.rpc('Page.setInterceptFileChooserDialog', { enabled: true })
  await presser()
  await waitFor(session, `!!document.querySelector(${JSON.stringify(CHAMP_DU_FICHIER)})`)
  await poserFichier(session, CHAMP_DU_FICHIER, chemin)
}

/** Le fichier que `presser()` remet au joueur, reçu sous le dossier vide `dossier` : son chemin. La page le
 *  télécharge, sous un nom d'attente (`.crdownload`) tant qu'il n'est pas entier. */
export async function recevoirLeFichier(session, dossier, presser) {
  await session.rpc('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dossier })
  await presser()
  const recus = () => readdirSync(dossier).filter((f) => !f.endsWith('.crdownload'))
  for (const echeance = Date.now() + TELECHARGEMENT_MS; recus().length === 0 && Date.now() < echeance; ) await sleep(100)
  if (recus().length !== 1) throw new Error(`un fichier téléchargé sous ${dossier} après ${TELECHARGEMENT_MS} ms : ${readdirSync(dossier).join(', ') || 'aucun'}`)
  return join(dossier, recus()[0])
}
