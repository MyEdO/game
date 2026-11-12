// LE LIEU NATIF D'UNE RECETTE DE L'HÔTE GODOT (#3945, `recette.mjs --natif`) : sans export ni navigateur. Le pont, le
// serveur du jeu (`servir.mjs`, sans export) et le parcours vivent dans ce processus ; Godot, lancé sur une copie
// importée du projet (`piloter`, `construire.mjs`), prend pour pont un relais (`relais.mjs`) vers la socket où ce
// processus sert le protocole (`servirLeCanal`). Ce que Godot publie (`publier`) se pose en global, où les expressions
// du parcours le lisent comme dans la page (`wfrpEcran`, à côté de `wfrpPont`) ; chaque geste du parcours est une
// commande que le pilote (`projet/recettes/pilote.gd`) relève à chaque image et joue. Mêmes noms que le lieu de la
// page (`page.mjs`).
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import { empaqueter, piloter } from '../construire.mjs'
import { pontDuBundle, servirLeCanal } from '../processus.mjs'
import { servir } from '../servir.mjs'
import { ATTENTE_ECHUE, courseContreMontre, sleep } from '../../../scripts/recette/lib.mjs'

export { ATTENTE_ECHUE, clic, sleep } from '../../../scripts/recette/lib.mjs'

const RELAIS = fileURLToPath(new URL('./relais.mjs', import.meta.url))
/** Le plus long silence de Godot après l'ordre de quitter ; au-delà, il est tué. */
const SORTIE_MS = 30000
/** L'index de Godot de chaque bouton de la souris que nomme le CDP (`MouseButton`). */
const BOUTONS = { left: 1, right: 2, middle: 3 }
const [MOLETTE_HAUT, MOLETTE_BAS] = [4, 5]

/** Ce qu'une recette native ne joue pas : la primitive absente, ce qu'elle demande, et son ticket. */
export const REFUS = {
  statique: '--statique sert l’export tel que le site le publie : sans objet hors d’une page',
}

/** Le jeu lancé sans export sur son menu d'entrée, sous `--recette=1` : la session, le serveur du jeu et la garde des
 *  erreurs que Godot écrit, relevées à la fermeture de la session (`close`). `rendu` le joue en rendu réel sous cette
 *  méthode ; sans lui, sans écran. */
export async function ouvrir({ modeles, statique, depot, scenario, graine, rendu }) {
  if (statique) throw new Error(REFUS.statique)
  const pont = pontDuBundle(await empaqueter(null), console)
  globalThis.wfrpPont = pont
  const srv = await servir({ ...(modeles && { modeles }), ...(depot && { depot }) })
  /** Les commandes que le pilote n'a pas relevées, et celles dont il n'a pas rendu le résultat, par id. */
  const file = []
  const attendues = new Map()
  let dernier = 0
  let mort = null
  const mourir = (cause) => {
    mort ??= cause
    for (const { reject } of attendues.values()) reject(new Error(mort))
    attendues.clear()
  }
  const relever = (json) => {
    for (const [id, valeur] of JSON.parse(json).rendus) {
      const { resolve, reject } = attendues.get(id)
      attendues.delete(id)
      if (valeur?.erreur) reject(new Error(valeur.erreur))
      else resolve(valeur)
    }
    return JSON.stringify({ ok: true, commandes: file.splice(0) })
  }
  const publier = (json) => {
    const [nom, valeur] = JSON.parse(json)
    globalThis[nom] = valeur
    return 'null'
  }
  const ecoute = createServer((canal) => servirLeCanal(pont, { url: srv.url, fermer: () => mourir('le pont de Godot s’est fermé') }, { entree: canal, sortie: canal }, { publier, commandes: relever }))
  await new Promise((pret) => ecoute.listen(0, '127.0.0.1', pret))
  let lance
  const lancement = new Promise((r) => { lance = r })
  const joue = piloter({ args: [`--pont=${RELAIS}`, '--recette=1', `--scenario=${scenario}`, `--graine=${graine}`], env: { WFRP_RELAIS: String(ecoute.address().port) }, rendu, lance })
  joue.then(({ erreurs }) => mourir(`Godot a quitté${erreurs.length ? ` :\n${erreurs.join('\n')}` : ''}`))
  const tuer = await Promise.race([lancement, joue.then(() => { throw new Error(mort) })])
  process.once('exit', tuer)
  const entries = []
  const garde = { entries, errors: () => entries.filter((e) => e.type === 'error'), warnings: () => entries.filter((e) => e.type === 'warning') }
  const session = {
    /** La commande `commande` jouée par le pilote : ce qu'elle rend. */
    commander(commande) {
      if (mort) return Promise.reject(new Error(mort))
      const id = ++dernier
      file.push({ id, ...commande })
      return new Promise((resolve, reject) => attendues.set(id, { resolve, reject }))
    },
    mort: () => mort,
    async close() {
      file.push({ id: ++dernier, quitter: 0 })
      const minuteur = setTimeout(tuer, SORTIE_MS)
      const { lignes, erreurs } = await joue
      clearTimeout(minuteur)
      ecoute.close()
      entries.push(...erreurs.map((text) => ({ type: 'error', text })), ...lignes.filter((l) => /^WARNING\b/.test(l.trim())).map((text) => ({ type: 'warning', text })))
    },
  }
  return { session, srv, garde }
}

/** Ce que vaut `expression`, évaluée dans ce processus, ses promesses attendues `timeoutMs` au plus. */
export async function evaluate(session, expression, { timeoutMs = 30000 } = {}) {
  if (session.mort()) throw new Error(session.mort())
  return courseContreMontre(Promise.resolve().then(() => runInThisContext(expression)), timeoutMs, `evaluate : sans valeur après ${timeoutMs} ms — expression : ${expression.slice(0, 200)}`)
}

/** Attend que `expression` devienne vraie, relue tous les `intervalMs` ; lève `ATTENTE_ECHUE` après `timeoutMs`. */
export async function waitFor(session, expression, { timeoutMs = 8000, intervalMs = 20 } = {}) {
  const echeance = Date.now() + timeoutMs
  for (;;) {
    if (await evaluate(session, expression)) return true
    if (Date.now() >= echeance) throw Object.assign(new Error(`Condition jamais vraie après ${timeoutMs}ms : ${expression}`), { code: ATTENTE_ECHUE })
    await sleep(intervalMs)
  }
}

/** La commande de souris que vaut l'événement CDP `params` (`Input.dispatchMouseEvent`). */
function commandeDeSouris(qui, domaine, { type, x, y, button, deltaY }) {
  if (domaine !== 'souris') throw new Error(`${qui} : domaine d'émission « ${domaine} » — une recette native n'émet que la souris`)
  if (type === 'mouseMoved') return { souris: 'deplacer', x, y }
  if (type === 'mouseWheel' && deltaY) return { souris: 'cran', x, y, bouton: deltaY < 0 ? MOLETTE_HAUT : MOLETTE_BAS }
  if ((type === 'mousePressed' || type === 'mouseReleased') && button in BOUTONS) return { souris: type === 'mousePressed' ? 'presser' : 'relacher', x, y, bouton: BOUTONS[button] }
  throw new Error(`${qui} : événement de souris hors de ceux d'une recette native : ${JSON.stringify({ type, button, deltaY })}`)
}

/** Le geste `evenements(point, emettre)` joué au point `cible` du canevas (`{ surface: 'canvas', x, y }`), chaque
 *  événement émis attendu du pilote. Rend le point. */
export async function geste(session, cible, { qui = 'geste' } = {}, evenements) {
  if (cible?.surface !== 'canvas' || !Number.isFinite(cible.x) || !Number.isFinite(cible.y)) throw new Error(`${qui} : une recette native vise un point du canevas, reçu ${JSON.stringify(cible)}`)
  const point = { x: cible.x, y: cible.y }
  await evenements(point, (domaine, params) => session.commander(commandeDeSouris(qui, domaine, params)))
  return point
}

/** `crans` crans de molette au point `cible`, le pointeur d'abord posé là. */
export const molette = (session, cible, deltaY, { crans = 1 } = {}) =>
  geste(session, cible, { qui: 'molette' }, async ({ x, y }, emettre) => {
    await emettre('souris', { type: 'mouseMoved', x, y })
    for (let n = 0; n < crans; n++) await emettre('souris', { type: 'mouseWheel', x, y, deltaY })
  })

export const realKeyDown = (session, { key, code }) => session.commander({ touche: { key, code }, appuyee: true })
export const realKeyUp = (session, { key, code }) => session.commander({ touche: { key, code }, appuyee: false })
export async function realKey(session, touche) {
  await realKeyDown(session, touche)
  await realKeyUp(session, touche)
}

/** L'image de la fenêtre écrite sous `name` dans `dir` : son chemin, `null` sans rendu. */
export async function shot(session, name, dir) {
  mkdirSync(dir, { recursive: true })
  const chemin = join(dir, name.endsWith('.png') ? name : `${name}.png`)
  return (await session.commander({ capture: chemin })) ? chemin : null
}

/** Sans rendu, aucune image à redessiner. */
export async function enHauteDefinition() {}

/** Ce que rend à `entree` le rappel que Godot expose sous `nom` (`Transport.exposer`), appelé par le pilote. */
export const rappeler = (session, nom, entree) => session.commander({ rappel: nom, entree })

/** Le fichier `chemin` donné au choix de fichier que `presser()` ouvre. */
export async function choisirLeFichier(session, chemin, presser) {
  await presser()
  await session.commander({ fichier: chemin })
}
