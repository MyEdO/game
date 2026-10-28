// LE SERVEUR DE L'EXPORT WEB DE L'HÔTE GODOT (#2928, #3086, `pont/CONTRAT.md`, section « Atelier 3D ») : l'export servi
// en statique sur un port libre de la boucle locale, et, à côté de la page, le dossier des modèles : `GET /modeles/` rend
// ses manifestes validés contre leur GLB et les os qui en portent les meshes rigides (`listage`), relus à chaque appel,
// et `GET /modeles/<fichier>` chacun de ses fichiers, en `Cache-Control: no-store`. Une requête défaillante reçoit son
// statut d'erreur, le serveur continue.
//
//   node hotes/godot/servir.mjs --web <dossier de l'export> [--modeles <dossier>]
import { createServer } from 'node:http'
import { createReadStream, fstatSync, readFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { chargerAssets } from './asset/charger.mjs'

const { DOSSIER_DES_MODELES, fichiersDuModele, lireGlb, manifestesDesModeles, verdictsDesModeles } = await chargerAssets([
  "export { lireGlb } from '/hotes/godot/asset/glb.ts';",
  "export { manifestesDesModeles } from '/hotes/godot/asset/release.ts';",
  "export { fichiersDuModele, verdictsDesModeles } from '/hotes/godot/asset/modeles.ts';",
])

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

/** Le listage de `dossier` : les manifestes que `verdictsDesModeles` accepte contre leur GLB, de chacun les os qui portent
 *  ses meshes rigides (`parentDesRigides` de `lireGlb`), et les erreurs (manifeste illisible, GLB illisible, refus,
 *  dossier illisible). */
function listage(dossier) {
  try {
    const lus = manifestesDesModeles(dossier)
    const erreurs = [...lus.erreurs]
    const octets = new Map()
    for (const { id } of lus.entrees) {
      const { glb } = fichiersDuModele(id)
      try {
        octets.set(id, readFileSync(join(dossier, glb)))
      } catch (e) {
        erreurs.push(`${glb} : ${e.code ?? e.message}`)
      }
    }
    const manifestes = {}
    const osDesRigides = {}
    for (const { id, brut, verdict } of verdictsDesModeles(lus.entrees, octets)) {
      if (verdict.ok) {
        manifestes[id] = brut
        osDesRigides[id] = [...new Set(lireGlb(octets.get(id)).parentDesRigides.values())]
      } else erreurs.push(`${fichiersDuModele(id).manifeste} : ${verdict.refus.join(' ; ')}`)
    }
    return { manifestes, osDesRigides, erreurs }
  } catch (e) {
    return { manifestes: {}, osDesRigides: {}, erreurs: [`${dossier} : ${e.code ?? e.message}`] }
  }
}

/** Sert `web` en statique et le dossier `modeles` sous `/modeles/`, sur un port libre de 127.0.0.1. */
export function servir({ web, modeles = DOSSIER_DES_MODELES }) {
  const racine = resolve(web)
  const dossier = resolve(modeles)
  const serveur = createServer((req, res) => {
    let rel
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '')
    } catch {
      return void res.writeHead(400).end()
    }
    if (rel === 'modeles/') return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(listage(dossier)))
    const [base, chemin, entetes] = rel.startsWith('modeles/') ? [dossier, rel.slice('modeles/'.length), { 'Cache-Control': 'no-store' }] : [racine, rel || 'index.html', {}]
    const fichier = sous(base, chemin)
    if (!fichier) return void res.writeHead(404).end()
    envoyer(res, fichier, entetes)
  })
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })))
}

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, modeles: { type: 'string' } } })
  if (!o.web) throw new Error('usage : node hotes/godot/servir.mjs --web <dossier de l’export> [--modeles <dossier>]')
  const { url } = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }) })
  console.log(url)
}
