// LE SERVEUR DE L'EXPORT WEB DE L'HÔTE GODOT (#2928, #3086, `pont/CONTRAT.md`, section « Atelier 3D ») : l'export servi
// en statique sur un port libre de la boucle locale (sans export, rien d'autre que les modèles et le dépôt : le pont
// vivant, `vivant.mjs`), et, à côté de la page, le dossier des modèles : `GET /modeles/listage.json`
// rend ses manifestes validés contre leur GLB et les os qui en portent les meshes rigides (`listage`), relus à chaque appel,
// et `GET /modeles/<fichier>` chacun de ses fichiers, en `Cache-Control: no-store`, comme `GET /planches/<fichier>`
// chaque planche du dépôt (`planches.mjs`, #3935). Avec `--statique`, l'export seul, tel que le site le publie : ses
// modèles déposés en scènes fabriquées et ses planches (`construire.mjs --export`, #3946). Avec `--depot`, l'éditeur de carte y
// lit et y écrit les projets manuscrits du dépôt (`pont/CONTRAT.md`, section « Éditeur ») : `GET /depot/<id>` et
// `PUT /depot/<id>`, et y lit le `Source/` du dépôt : `GET /source/manifest.json` et `GET /source/<livre>/<NNN>.md`
// (`servirLaSource`, `scripts/source/prose-source-plugin.mjs`). Une requête défaillante reçoit son statut d'erreur, le
// serveur continue.
//
//   node hotes/godot/servir.mjs --web <dossier de l'export> [--modeles <dossier> | --statique] [--depot]
import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../scripts/guards/lib/projetsLivres.mjs'
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs'
import { materialiser } from '../../scripts/source/resoudre.mjs'
import { servirLaSource } from '../../scripts/source/prose-source-plugin.mjs'
import { ecrireTexteAtomique } from '../../scripts/guards/lib/ecritureJsonAtomique.mjs'
import { DOSSIER_DES_MODELES, LISTAGE, listage } from './listage.mjs'
import { DOSSIER_DES_PLANCHES } from './planches.mjs'
import { ecouter, rendre, TYPES } from './statique.mjs'

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
 * puis l'y sert), ou par le pont vivant (`vivant.mjs`, `npm run godot:ouvrir`) : `GET depot/<id>` rend le projet manuscrit d'id `id` (`PROJETS_MANUSCRITS`,
 * `scripts/guards/lib/projetsLivres.mjs`), prose adressée matérialisée (`lireProjetLivre`), en `no-store` ; `PUT
 * depot/<id>` écrit son corps à la place du fichier, 200, ou le refuse en 422 avec sa raison s'il n'est pas du JSON,
 * pas ce projet, ou pas en forme dépôt (`materialiser` le refuse). Un projet généré (`scripts/<dossier>/generate.mjs`)
 * ou inconnu reçoit 404 : il s'ouvre tel que le jeu l'embarque.
 * @contrat Éditeur
 */

/** Le projet manuscrit (`PROJETS_MANUSCRITS`) d'id `id` du dépôt `depot` : son chemin relatif au corpus, ou `null`. */
function manuscrit(depot, id) {
  return listerProjetsLivres(depot).find((rel) => Object.hasOwn(PROJETS_MANUSCRITS, basename(rel))
    && JSON.parse(readFileSync(join(dossierDesProjetsLivres(depot), rel), 'utf8')).id === id) ?? null
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

/** `GET depot/<id>` : le projet manuscrit `id` du dépôt `depot`, prose matérialisée (`lireProjetLivre`), en `no-store` ;
 *  `PUT depot/<id>` : le corps écrit à sa place (`ecrireTexteAtomique`), 200, ou 422 et sa raison (`refusDuTexte`). 404
 *  hors des manuscrits, 405 une autre méthode, 413 un corps de plus de `CORPS_MAX` octets, 500 et sa raison une
 *  lecture ou une écriture qui échoue. */
function servirLeDepot(req, res, depot, id) {
  const echec = (e) => void res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e?.message ?? e))
  try {
    const rel = manuscrit(depot, id)
    if (!rel) return void res.writeHead(404).end()
    if (req.method === 'GET') return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(lireProjetLivre(rel, depot)))
    if (req.method !== 'PUT') return void res.writeHead(405, { Allow: 'GET, PUT' }).end()
    const blocs = []
    let taille = 0
    req.on('data', (bloc) => {
      taille += bloc.length
      if (taille <= CORPS_MAX) blocs.push(bloc)
    })
    req.on('end', () => {
      if (taille > CORPS_MAX) return void res.writeHead(413).end()
      const texte = Buffer.concat(blocs).toString('utf8')
      const refus = refusDuTexte(texte, id)
      if (refus) return void res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' }).end(refus)
      try {
        ecrireTexteAtomique(join(dossierDesProjetsLivres(depot), rel), texte)
        res.writeHead(200).end()
      } catch (e) {
        echec(e)
      }
    })
  } catch (e) {
    echec(e)
  }
}

/** Sert le dossier `modeles` sous `/modeles/` et les planches du dépôt sous `/planches/`, sur un port libre de
 *  127.0.0.1 ; avec `web`, l'export en statique, sans lui 404 hors de `/modeles/`, `/planches/`, `/depot/` et
 *  `/source/` ; avec `statique`, `web` seul, ses `modeles/` et ses `planches/` déposés compris ; avec `depot`, la racine
 *  d'un dépôt, ses projets manuscrits sous `/depot/` (`servirLeDepot`), et le `Source/` de ce dépôt-ci sous `/source/`,
 *  son index des chapitres et chacun de ses chapitres (`servirLaSource`), jamais sans lui. */
export function servir({ web, modeles = DOSSIER_DES_MODELES, depot, statique = false }) {
  const racine = web && resolve(web)
  const dossier = resolve(modeles)
  return ecouter((req, res, rel) => {
    if (depot && rel.startsWith('depot/')) return servirLeDepot(req, res, resolve(depot), rel.slice('depot/'.length))
    if (depot && rel.startsWith('source/')) return void (servirLaSource(`/${rel}`, res) || res.writeHead(404).end())
    if (!statique && rel === `modeles/${LISTAGE}`) return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(listage(dossier)))
    const sansCache = { 'Cache-Control': 'no-store' }
    const [base, chemin, entetes] = statique ? [racine, rel || 'index.html', {}]
      : rel.startsWith('modeles/') ? [dossier, rel.slice('modeles/'.length), sansCache]
      : rel.startsWith('planches/') ? [DOSSIER_DES_PLANCHES, rel.slice('planches/'.length), sansCache]
      : [racine, rel || 'index.html', {}]
    rendre(res, base, chemin, entetes)
  })
}

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, modeles: { type: 'string' }, statique: { type: 'boolean' }, depot: { type: 'boolean' } } })
  if (!o.web || (o.modeles && o.statique)) throw new Error('usage : node hotes/godot/servir.mjs --web <dossier de l’export> [--modeles <dossier> | --statique] [--depot]')
  const { url } = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }), ...(o.statique && { statique: true }), ...(o.depot && { depot: RACINE_DU_DEPOT }) })
  console.log(url)
}
