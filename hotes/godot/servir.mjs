// LE SERVEUR DE L'EXPORT WEB DE L'HÔTE GODOT (#2928, #3086, `pont/CONTRAT.md`, section « Atelier 3D ») : l'export servi
// en statique sur un port libre de la boucle locale, et, à côté de la page, le dossier des modèles : `GET /modeles/` rend
// ses manifestes (`manifestesDesModeles`), relus à chaque appel, et `GET /modeles/<fichier>` chacun de ses fichiers, en
// `Cache-Control: no-store`.
//
//   node hotes/godot/servir.mjs --web <dossier de l'export> [--modeles <dossier>]
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chargerAssets } from './asset/charger.mjs'

const { DOSSIER_DES_MODELES, manifestesDesModeles } = await chargerAssets(["export { manifestesDesModeles } from '/hotes/godot/asset/release.ts';"])

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary' }

/** Le fichier `rel` de `racine`, ou `null` s'il en sort ou n'est pas un fichier. */
function fichierSous(racine, rel) {
  const chemin = resolve(racine, rel)
  return chemin.startsWith(racine + sep) && statSync(chemin, { throwIfNoEntry: false })?.isFile() ? chemin : null
}

function envoyer(res, chemin, entetes = {}) {
  res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream', 'Content-Length': statSync(chemin).size, ...entetes })
  createReadStream(chemin).pipe(res)
}

/** Sert `web` en statique et le dossier `modeles` sous `/modeles/`, sur un port libre de 127.0.0.1. */
export function servir({ web, modeles = DOSSIER_DES_MODELES }) {
  const racine = resolve(web)
  const dossier = resolve(modeles)
  const serveur = createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '')
    if (rel === 'modeles/') {
      const lus = manifestesDesModeles(dossier)
      const corps = JSON.stringify({ manifestes: Object.fromEntries(lus.entrees.map(({ id, brut }) => [id, brut])), erreurs: lus.erreurs })
      return void res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(corps)
    }
    if (rel.startsWith('modeles/')) {
      const chemin = fichierSous(dossier, rel.slice('modeles/'.length))
      return void (chemin ? envoyer(res, chemin, { 'Cache-Control': 'no-store' }) : res.writeHead(404).end())
    }
    const chemin = fichierSous(racine, rel || 'index.html')
    if (!chemin) return void res.writeHead(404).end()
    envoyer(res, chemin)
  })
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, modeles: { type: 'string' } } })
  if (!o.web) throw new Error('usage : node hotes/godot/servir.mjs --web <dossier de l’export> [--modeles <dossier>]')
  const { url } = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }) })
  console.log(url)
}
