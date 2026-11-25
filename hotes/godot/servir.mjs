// LE SERVEUR DE L'EXPORT WEB DE L'HÔTE GODOT (#2928, #3086, `pont/CONTRAT.md`, section « Atelier 3D ») : l'export servi
// en statique sur un port libre de la boucle locale (sans export, rien d'autre que les modèles et le dépôt : le pont
// vivant, `vivant.mjs`), et, à côté de la page, le dossier des modèles : `GET /modeles/listage.json`
// rend ses manifestes validés contre leur GLB et les os qui en portent les meshes rigides (`listage`), calculés au lancement
// puis à nouveau quand un fichier du dossier change (`listageDuDossier`), et `GET /modeles/<fichier>` chacun de ses fichiers, en `Cache-Control: no-store` ; tout autre chemin est un fichier de
// l'export, ses planches comprises (`planches/`, `planches.mjs`, #3935). Avec `--statique`, l'export seul, tel que le site le publie : ses
// modèles déposés en scènes fabriquées et ses planches (`construire.mjs --export`, #3946). Avec `--depot`, l'éditeur de carte y
// lit et y écrit les projets manuscrits du dépôt (`pont/CONTRAT.md`, section « Éditeur ») : `GET /depot/<id>` et
// `PUT /depot/<id>`, le Compendium y écrit les données de `src/data` (section « Compendium ») : `PUT /donnees/<fichier>`, et y lit le `Source/` du dépôt : `GET /source/manifest.json` et `GET /source/<livre>/<NNN>.md`
// (`servirLaSource`, `scripts/source/prose-source-plugin.mjs`). Une requête défaillante reçoit son statut d'erreur, le
// serveur continue.
//
//   node hotes/godot/servir.mjs --web <dossier de l'export> [--modeles <dossier> | --statique] [--depot]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { dossierDesProjetsLivres, estManuscrit, listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs'
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs'
import { materialiser } from '../../scripts/source/resoudre.mjs'
import { servirLaSource } from '../../scripts/source/prose-source-plugin.mjs'
import { ecrireTexteAtomique } from '../../scripts/guards/lib/ecritureJsonAtomique.mjs'
import { DOSSIER_DES_MODELES, LISTAGE, listage } from './listage.mjs'
import { ecouter, rendre, TYPES } from './statique.mjs'
import { hash32 } from '../../src/lib/hash.ts'
import { SORTIES_DES_ESPACES } from '../../scripts/docs/lib/cibles-registres.mjs'

/** Le WebGL 2 de l'export, en logiciel dans un Chrome sans GPU, sans l'avertissement de repli. */
export const WEBGL_LOGICIEL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
/** La borne d'une lecture de la page : l'export Web de Godot tient le fil de la page le temps de chaque image, et celle
 *  qui lit un GLB ou dessine en WebGL logiciel une vue à deviceScaleFactor 2 dure plus que le défaut du kit. */
export const FIL_DE_LA_PAGE_MS = 120000

/** La racine du dépôt où ce serveur vit, que `--depot` sert. */
const RACINE_DU_DEPOT = fileURLToPath(new URL('../..', import.meta.url))
/** Le plus gros corps qu'un `PUT depot/<id>` reçoit, en octets. */
const CORPS_MAX = 32 * 1024 * 1024

/**
 * Le dépôt est servi par `servir.mjs` lancé avec `--depot` (`npm run godot:editeur` exporte le projet dans `dist/godot`
 * puis l'y sert), ou par le pont vivant (`vivant.mjs`, `npm run godot:ouvrir`) : `GET depot/` rend la liste des ids de ses
 * projets manuscrits, dans l'ordre du corpus (`listerProjetsLivres`), en `no-store` ; `GET depot/<id>` rend le projet manuscrit d'id `id` (`estManuscrit`,
 * `scripts/guards/lib/projetsLivres.mjs`), prose adressée matérialisée (`lireProjetLivre`), en `no-store` ; `PUT
 * depot/<id>` écrit son corps à la place du fichier, 200, ou le refuse en 422 avec sa raison s'il n'est pas du JSON,
 * pas ce projet, ou pas en forme dépôt (`materialiser` le refuse). Un projet généré (un `generate.mjs` voisin)
 * ou inconnu reçoit 404 : il s'ouvre tel que le jeu l'embarque.
 * @contrat Éditeur
 */

/** Les projets manuscrits (`estManuscrit`) du dépôt `depot`, dans l'ordre du corpus : chacun son chemin relatif
 *  au corpus et son id. */
function manuscrits(depot) {
  return listerProjetsLivres(depot).filter((rel) => estManuscrit(rel, depot))
    .map((rel) => ({ rel, id: JSON.parse(readFileSync(join(dossierDesProjetsLivres(depot), rel), 'utf8')).id }))
}

/** Pourquoi `texte` ne s'écrit pas à la place du projet `id` : ni du JSON, ni ce projet, ou une adresse de prose qui
 *  ne se résout pas, ou un texte déjà matérialisé (`materialiser`) ; `null` s'il s'écrit. */
function refusDuTexte(texte, id) {
  let doc
  try {
    doc = JSON.parse(texte)
  } catch {
    return 'JSON illisible'
  }
  if (doc?.id !== id) return `le projet ${doc?.id} au lieu de ${id}`
  try {
    materialiser(doc)
  } catch (e) {
    return e.message
  }
  return null
}

/** `GET depot/` : les ids des projets manuscrits du dépôt `depot` (`manuscrits`), en `no-store`, 405 une autre méthode ;
 *  `GET depot/<id>` : le projet manuscrit `id` du dépôt `depot`, prose matérialisée (`lireProjetLivre`), en `no-store` ;
 *  `PUT depot/<id>` : le corps écrit à sa place (`ecrireTexteAtomique`), 200, ou 422 et sa raison (`refusDuTexte`). 404
 *  hors des manuscrits, 405 une autre méthode, 413 un corps de plus de `CORPS_MAX` octets, 500 et sa raison une
 *  lecture ou une écriture qui échoue. */
function servirLeDepot(req, res, depot, id) {
  const echec = (e) => void res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e?.message ?? e))
  try {
    const tous = manuscrits(depot)
    if (id === '') {
      if (req.method !== 'GET') return void res.writeHead(405, { Allow: 'GET' }).end()
      return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(tous.map((m) => m.id)))
    }
    const rel = tous.find((m) => m.id === id)?.rel
    if (!rel) return void res.writeHead(404).end()
    if (req.method === 'GET') return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(lireProjetLivre(rel, depot)))
    if (req.method !== 'PUT') return void res.writeHead(405, { Allow: 'GET, PUT' }).end()
    lireLeCorps(req, res, (texte) => {
      const refus = refusDuTexte(texte, id)
      if (refus) return void res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' }).end(refus)
      ecrireTexteAtomique(join(dossierDesProjetsLivres(depot), rel), texte)
      res.writeHead(200).end()
    })
  } catch (e) {
    echec(e)
  }
}

/** Le corps de la requête `req`, en texte, passé à `suite` ; 413 un corps de plus de `CORPS_MAX` octets, 500 et sa
 *  raison une `suite` qui lève. */
function lireLeCorps(req, res, suite) {
  const blocs = []
  let taille = 0
  req.on('data', (bloc) => {
    taille += bloc.length
    if (taille <= CORPS_MAX) blocs.push(bloc)
  })
  req.on('end', () => {
    if (taille > CORPS_MAX) return void res.writeHead(413).end()
    try {
      suite(Buffer.concat(blocs).toString('utf8'))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e?.message ?? e))
    }
  })
}

/** Les fichiers de l'atelier du Compendium, par nom leur chemin relatif au dépôt (phase 2 de `npm run gen`). */
const FICHIERS_DE_L_ATELIER = SORTIES_DES_ESPACES.atelier

/**
 * Le dépôt servi (`--depot`, ou le pont vivant) reçoit aussi les données du Compendium : `PUT donnees/<fichier>` écrit
 * son corps à la place du fichier `<fichier>` de l'atelier (`FICHIERS_DE_L_ATELIER`), 200 ; 404 hors de ces fichiers,
 * 405 une autre méthode, 422 et sa raison un corps qui n'est pas du JSON ou pas en forme dépôt (`materialiser`), 409 si
 * l'en-tête `If-Match` n'est pas l'empreinte (`hash32`) du fichier sur le disque : le disque a changé depuis l'export du
 * jeu, relancer l'export (`npm run godot:editeur`).
 * @contrat Compendium
 */

/** Pourquoi `texte` ne s'écrit pas à la place d'un fichier de données : ni du JSON, ou une adresse de prose qui ne se
 *  résout pas, ou un texte déjà matérialisé (`materialiser`) ; `null` s'il s'écrit. */
function refusDesDonnees(texte) {
  let doc
  try {
    doc = JSON.parse(texte)
  } catch {
    return 'JSON illisible'
  }
  try {
    materialiser(doc)
  } catch (e) {
    return e.message
  }
  return null
}

/** `PUT donnees/<fichier>` du dépôt `depot` : le corps écrit à la place du fichier de l'atelier `fichier`
 *  (`ecrireTexteAtomique`), 200 ; 404, 405, 409 ou 422 et sa raison comme le dit le contrat. */
function servirLesDonnees(req, res, depot, fichier) {
  let chemins
  try {
    chemins = JSON.parse(readFileSync(join(depot, FICHIERS_DE_L_ATELIER), 'utf8'))
  } catch (e) {
    return void res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e?.message ?? e))
  }
  if (!Object.hasOwn(chemins, fichier)) return void res.writeHead(404).end()
  if (req.method !== 'PUT') return void res.writeHead(405, { Allow: 'PUT' }).end()
  lireLeCorps(req, res, (texte) => {
    const cible = join(depot, chemins[fichier])
    const texteDit = (statut, raison) => void res.writeHead(statut, { 'Content-Type': 'text/plain; charset=utf-8' }).end(raison)
    if (req.headers['if-match'] !== String(hash32(readFileSync(cible, 'utf8')))) return texteDit(409, `${fichier} a changé sur le disque depuis l’export du jeu : relancer l’export (npm run godot:editeur)`)
    const refus = refusDesDonnees(texte)
    if (refus) return texteDit(422, refus)
    ecrireTexteAtomique(cible, texte)
    res.writeHead(200).end()
  })
}

/** L'empreinte du dossier `dossier` : le nom, la taille et la date de chacun de ses fichiers ; le code de l'erreur s'il ne
 *  se lit pas. */
function empreinteDu(dossier) {
  try {
    return readdirSync(dossier).map((f) => { const s = statSync(join(dossier, f)); return `${f}:${s.size}:${s.mtimeMs}` }).join('\n')
  } catch (e) {
    return String(e.code ?? e.message)
  }
}

/** Le texte du listage du dossier vivant `dossier` (`listage`), calculé tout de suite, puis à la lecture qui trouve
 *  changée l'empreinte du dossier (`empreinteDu`) : sa validation lit chaque GLB, plusieurs secondes pendant lesquelles
 *  le serveur, sur un seul fil, ne répond à rien, et une page qui attend plus que le silence du pont (`SILENCE_S`,
 *  `projet/scripts/pont.gd`) n'a plus de modèles. Les demandes sur la même empreinte partagent le calcul en cours. */
function listageDuDossier(dossier) {
  let empreinte, texte
  return () => {
    const lue = empreinteDu(dossier)
    if (lue !== empreinte) [empreinte, texte] = [lue, listage(dossier).then((liste) => JSON.stringify(liste))]
    return texte
  }
}

/** Sert le dossier `modeles` sous `/modeles/`, sur un port libre de 127.0.0.1 ; avec `web`, l'export en statique,
 *  ses `planches/` comprises, sans lui 404 hors de `/modeles/`, `/depot/` et `/source/` ; avec `statique`, `web`
 *  seul, ses `modeles/` déposés compris ; avec `depot`, la racine
 *  d'un dépôt, ses projets manuscrits sous `/depot/` (`servirLeDepot`), et le `Source/` de ce dépôt-ci sous `/source/`,
 *  son index des chapitres et chacun de ses chapitres (`servirLaSource`), jamais sans lui. Le pont vivant annonce son
 *  adresse dès l'écoute avec `attendreLeListage: false`, puis le serveur prépare le listage. */
export async function servir({ web, modeles = DOSSIER_DES_MODELES, depot, statique = false, attendreLeListage = true }) {
  const racine = web && resolve(web)
  const dossier = resolve(modeles)
  const lireLeListage = !statique && listageDuDossier(dossier)
  if (lireLeListage && attendreLeListage) await lireLeListage()
  const serveur = await ecouter((req, res, rel) => {
    if (depot && rel.startsWith('depot/')) return servirLeDepot(req, res, resolve(depot), rel.slice('depot/'.length))
    if (depot && rel.startsWith('donnees/')) return servirLesDonnees(req, res, resolve(depot), rel.slice('donnees/'.length))
    if (depot && rel.startsWith('source/')) return void (servirLaSource(`/${rel}`, res) || res.writeHead(404).end())
    if (lireLeListage && rel === `modeles/${LISTAGE}`) return void lireLeListage().then((texte) =>
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(texte))
    const sansCache = { 'Cache-Control': 'no-store' }
    const [base, chemin, entetes] = statique ? [racine, rel || 'index.html', {}]
      : rel.startsWith('modeles/') ? [dossier, rel.slice('modeles/'.length), sansCache]
      : [racine, rel || 'index.html', {}]
    rendre(res, base, chemin, entetes)
  })
  if (!lireLeListage || attendreLeListage) return serveur
  const amorce = setImmediate(lireLeListage)
  return {
    url: serveur.url,
    fermer() {
      clearImmediate(amorce)
      serveur.fermer()
    },
  }
}

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, modeles: { type: 'string' }, statique: { type: 'boolean' }, depot: { type: 'boolean' } } })
  if (!o.web || (o.modeles && o.statique)) throw new Error('usage : node hotes/godot/servir.mjs --web <dossier de l’export> [--modeles <dossier> | --statique] [--depot]')
  const { url } = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }), ...(o.statique && { statique: true }), ...(o.depot && { depot: RACINE_DU_DEPOT }) })
  console.log(url)
}
