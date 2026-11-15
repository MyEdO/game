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
import { format } from 'node:util'
import { runInThisContext } from 'node:vm'
import { empaqueter, piloter } from '../construire.mjs'
import { pontDuBundle, servirLeCanal } from '../processus.mjs'
import { servir } from '../servir.mjs'
import { stockageDuProcessus } from '../stockage.mjs'
import { ATTENTE_ECHUE, courseContreMontre, sleep } from '../../../scripts/recette/lib.mjs'

export { ATTENTE_ECHUE, clic, sleep } from '../../../scripts/recette/lib.mjs'

const RELAIS = fileURLToPath(new URL('./relais.mjs', import.meta.url))
/** Le plus long silence de Godot après l'ordre de quitter ; au-delà, il est tué. */
const SORTIE_MS = 30000
/** Le plus long temps du pilote pour rendre une commande ; au-delà, elle échoue. */
const COMMANDE_MS = 30000
/** L'index de Godot de chaque bouton de la souris que nomme le CDP (`MouseButton`). */
const BOUTONS = { left: 1, right: 2, middle: 3 }
const [MOLETTE_HAUT, MOLETTE_BAS] = [4, 5]

/** Le jeu lancé sans export sur son menu d'entrée, sous `--recette=1` : la session, le serveur du jeu et la garde, qui
 *  relève les erreurs et les avertissements que le pont écrit à sa console et, à la fermeture de la session (`close`),
 *  ceux que Godot écrit. `rendu` le joue en rendu réel sous cette méthode ; sans lui, sans écran. Le stockage du pont
 *  ne dure que ce processus. */
export async function ouvrir({ modeles, statique, depot, scenario, graine, rendu }) {
  if (statique) throw new Error('--statique sert l’export tel que le site le publie : sans objet hors d’une page')
  const entries = []
  const garde = { entries, errors: () => entries.filter((e) => e.type === 'error'), warnings: () => entries.filter((e) => e.type === 'warning') }
  const relever = (type, ecrire) => (...args) => {
    entries.push({ type, text: format(...args) })
    ecrire(...args)
  }
  const { code } = await empaqueter(null, 'development')
  const consoleRelevee = Object.assign(Object.create(console), { error: relever('error', console.error), warn: relever('warning', console.warn) })
  const stockage = stockageDuProcessus(null)
  /** Les noms que Godot a publiés en global depuis le dernier lancement. */
  const publies = new Set()
  let pont
  /** Le pont tiré du bundle comme à l'ouverture d'une page : ce que Godot avait publié retiré, le stockage gardé. */
  const poserLePont = () => {
    for (const nom of publies) delete globalThis[nom]
    publies.clear()
    pont = globalThis.wfrpPont = pontDuBundle(code, consoleRelevee, stockage)
  }
  poserLePont()
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
  const commandes = (json) => {
    for (const [id, valeur] of JSON.parse(json).rendus) {
      const { resolve, reject } = attendues.get(id)
      attendues.delete(id)
      if (valeur?.erreur) reject(new Error(valeur.erreur))
      else resolve(valeur)
    }
    return file.splice(0)
  }
  const publier = (json) => {
    const [nom, valeur] = JSON.parse(json)
    publies.add(nom)
    globalThis[nom] = valeur
    return 'null'
  }
  /** Le canal d'un jeu, en congé dès qu'il relève l'ordre de quitter : sa fermeture n'est plus une panne, et ce qu'il
   *  publie encore ne compte plus. Il se ferme à la fin de son entrée, ou coupé : Godot tue son relais en quittant
   *  (`transport_du_processus.gd`), ce que Windows rend ici en `ECONNRESET`. */
  const ecoute = createServer((canal) => {
    let conge = false
    const methodes = {
      publier: (json) => (conge ? 'null' : publier(json)),
      commandes(json) {
        const relevees = conge ? [] : commandes(json)
        conge ||= relevees.some((commande) => 'quitter' in commande)
        return JSON.stringify({ ok: true, commandes: relevees })
      },
    }
    const fermer = (cause) => conge || mourir(`le pont de Godot s’est fermé${cause}`)
    servirLeCanal(pont, { url: srv.url, fermer: () => fermer('') }, { entree: canal, sortie: canal }, methodes).catch((erreur) => fermer(` : ${erreur.message}`))
  })
  await new Promise((pret) => ecoute.listen(0, '127.0.0.1', pret))
  const quitter = () => file.push({ id: ++dernier, quitter: 0 })
  let tuer = null
  let recharge = false
  let auLancement
  const lancement = () => new Promise((r) => { auLancement = r })
  const premier = lancement()
  const lance = (t) => {
    tuer = t
    if (recharge) poserLePont()
    recharge = false
    auLancement()
  }
  const joue = piloter({ args: [`--pont=${RELAIS}`, '--recette=1', `--scenario=${scenario}`, `--graine=${graine}`], env: { WFRP_RELAIS: String(ecoute.address().port) }, rendu, lance, encore: () => recharge })
  joue.then(({ erreurs }) => mourir(`Godot a quitté${erreurs.length ? ` :\n${erreurs.join('\n')}` : ''}`))
  const lanceOuMort = (attendu) => Promise.race([attendu, joue.then(() => { throw new Error(mort) })])
  await lanceOuMort(premier)
  process.once('exit', () => tuer())
  const session = {
    /** La commande `commande` jouée par le pilote : ce qu'elle rend, `COMMANDE_MS` au plus. */
    commander(commande) {
      if (mort) return Promise.reject(new Error(mort))
      const id = ++dernier
      file.push({ id, ...commande })
      return courseContreMontre(new Promise((resolve, reject) => attendues.set(id, { resolve, reject })), COMMANDE_MS, `commande sans réponse du pilote après ${COMMANDE_MS} ms : ${JSON.stringify(commande)}`)
    },
    mort: () => mort,
    /** Le jeu quitté puis relancé sur la même copie, son pont tiré de nouveau du bundle : ce qu'une page rechargée
     *  garde, le stockage, reste. */
    async recharger() {
      if (mort) throw new Error(mort)
      const relance = lancement()
      recharge = true
      quitter()
      await lanceOuMort(relance)
    },
    async close() {
      quitter()
      const minuteur = setTimeout(() => tuer(), SORTIE_MS)
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

/** Hors d'une page, aucun graphe audio que le lieu lise : faux (le volume d'un bus s'y prouve à
 *  `projet/recettes/campagne.gd`). */
export async function releverLesGains() {
  return false
}

/** Le jeu rechargé (`session.recharger`). */
export const recharger = (session) => session.recharger()

/** Ce que rend à `entree` le rappel que Godot expose sous `nom` (`Transport.exposer`), appelé par le pilote. */
export const rappeler = (session, nom, entree) => session.commander({ rappel: nom, entree })

/** Le fichier `chemin` donné au choix de fichier que `presser()` ouvre. */
export async function choisirLeFichier(session, chemin, presser) {
  await presser()
  await session.commander({ fichier: chemin })
}

/** Le fichier que `presser()` remet au joueur, reçu sous le dossier `dossier` : son chemin. Le choix de fichier
 *  l'enregistre sous le nom qu'il propose. */
export async function recevoirLeFichier(session, dossier, presser) {
  await presser()
  return session.commander({ fichier: dossier })
}
