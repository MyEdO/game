// scripts/docs/lib/rendre-seul.mjs — joue le `rendre()` du générateur `process.argv[2]` (chemin relatif
// au cwd) sans rien écrire, et imprime son rendu (`[cible, texte][]`, JSON) sur stdout : le point
// d'entrée du mode `rendre` de `mesurerGenerateur` (scripts/docs/build-all.mjs) et du rendu sous win32
// (`plateforme-win32.test.mjs`).
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { rendre } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
process.stdout.write(JSON.stringify([...(await rendre())]))
