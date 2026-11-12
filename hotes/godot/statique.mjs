// LE SERVICE DE FICHIERS DE L'HÔTE GODOT, sur la boucle locale : ce que partagent le serveur de l'export et du dépôt
// (`servir.mjs`) et le noyau embarqué dans l'exécutable de bureau (`embarque.mjs`, #3951). Sans dépendance hors de Node :
// `embarque.mjs` s'empaquette en un fichier.
import { createServer } from 'node:http'
import { createReadStream, fstatSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

export const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary' }

/** Le chemin `rel` sous `racine`, ou `null` s'il en sort. */
function sous(racine, rel) {
  const chemin = resolve(racine, rel)
  return chemin.startsWith(racine + sep) ? chemin : null
}

/** Le fichier `chemin` en 200, ou 404 s'il ne s'ouvre pas en fichier ; une lecture coupée ferme la réponse. */
function envoyer(res, chemin, entetes) {
  const flux = createReadStream(chemin)
  flux.on('error', () => (res.headersSent ? res.destroy() : res.writeHead(404).end()))
  flux.on('open', (fd) => {
    const etat = fstatSync(fd)
    if (!etat.isFile()) return void (flux.destroy(), res.writeHead(404).end())
    res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream', 'Content-Length': etat.size, ...entetes })
    flux.pipe(res)
  })
}

/** Le fichier `chemin` du dossier `base` (un chemin absolu) en 200 avec `entetes` ; 404 sans `base`, hors de lui, ou
 *  s'il ne s'ouvre pas en fichier. */
export function rendre(res, base, chemin, entetes = {}) {
  const fichier = base && sous(base, chemin)
  if (!fichier) return void res.writeHead(404).end()
  envoyer(res, fichier, entetes)
}

/** Un serveur sur un port libre de 127.0.0.1 : `traiter(req, res, rel)` reçoit chaque requête, `rel` son chemin décodé
 *  sans barre de tête ; une URI malformée reçoit 400. Rend son adresse et de quoi le fermer. */
export function ecouter(traiter) {
  const serveur = createServer((req, res) => {
    let rel
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '')
    } catch {
      return void res.writeHead(400).end()
    }
    traiter(req, res, rel)
  })
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })))
}
