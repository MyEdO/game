// LE SERVEUR DE L'EXPORT WEB DE L'HÔTE GODOT (#2928, #3086, `pont/CONTRAT.md`, section « Atelier 3D ») : l'export servi
// en statique sur un port libre de la boucle locale, et, à côté de la page, le dossier des modèles : `GET /modeles/listage.json`
// rend ses manifestes validés contre leur GLB et les os qui en portent les meshes rigides (`listage`), relus à chaque appel,
// et `GET /modeles/<fichier>` chacun de ses fichiers, en `Cache-Control: no-store`. Avec `--depot`, l'éditeur de carte y
// lit et y écrit les projets manuscrits du dépôt (`pont/CONTRAT.md`, section « Éditeur ») : `GET /depot/<id>` et
// `PUT /depot/<id>`. Une requête défaillante reçoit son statut d'erreur, le serveur continue.
//
//   node hotes/godot/servir.mjs --web <dossier de l'export> [--modeles <dossier>] [--depot]
import { createServer } from 'node:http'
import { createReadStream, fstatSync, readFileSync } from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../scripts/guards/lib/projetsLivres.mjs'
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs'
import { materialiser } from '../../scripts/source/resoudre.mjs'
import { ecrireTexteAtomique } from '../../scripts/guards/lib/ecritureJsonAtomique.mjs'
import { DOSSIER_DES_MODELES, LISTAGE, listage } from './listage.mjs'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary' }

/** Le chemin `rel` sous `racine`, ou `null` s'il en sort. */
function sous(racine, rel) {
  const chemin = resolve(racine, rel)
  return chemin.startsWith(racine + sep) ? chemin : null
}

/** Le fichier `chemin` en 200, ou 404 s'il ne s'ouvre pas en fichier ; une lecture coupée ferme la réponse. */
function envoyer(res, chemin, entetes = {}) {
  const flux = createReadStream(chemin)
  flux.on('error', () => (res.headersSent ? res.destroy() : res.writeHead(404).end()))
  flux.on('open', (fd) => {
    const etat = fstatSync(fd)
    if (!etat.isFile()) return void (flux.destroy(), res.writeHead(404).end())
    res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream', 'Content-Length': etat.size, ...entetes })
    flux.pipe(res)
  })
}

/** La racine du dépôt où ce serveur vit, que `--depot` sert. */
const RACINE_DU_DEPOT = fileURLToPath(new URL('../..', import.meta.url))
/** Le plus gros corps qu'un `PUT depot/<id>` reçoit, en octets. */
const CORPS_MAX = 32 * 1024 * 1024

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

/** Sert `web` en statique et le dossier `modeles` sous `/modeles/`, sur un port libre de 127.0.0.1 ; avec `depot`, la
 *  racine d'un dépôt, ses projets manuscrits sous `/depot/` (`servirLeDepot`). */
export function servir({ web, modeles = DOSSIER_DES_MODELES, depot }) {
  const racine = resolve(web)
  const dossier = resolve(modeles)
  const serveur = createServer((req, res) => {
    let rel
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '')
    } catch {
      return void res.writeHead(400).end()
    }
    if (depot && rel.startsWith('depot/')) return servirLeDepot(req, res, resolve(depot), rel.slice('depot/'.length))
    if (rel === `modeles/${LISTAGE}`) return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(listage(dossier)))
    const [base, chemin, entetes] = rel.startsWith('modeles/') ? [dossier, rel.slice('modeles/'.length), { 'Cache-Control': 'no-store' }] : [racine, rel || 'index.html', {}]
    const fichier = sous(base, chemin)
    if (!fichier) return void res.writeHead(404).end()
    envoyer(res, fichier, entetes)
  })
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })))
}

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, modeles: { type: 'string' }, depot: { type: 'boolean' } } })
  if (!o.web) throw new Error('usage : node hotes/godot/servir.mjs --web <dossier de l’export> [--modeles <dossier>] [--depot]')
  const { url } = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }), ...(o.depot && { depot: RACINE_DU_DEPOT }) })
  console.log(url)
}
