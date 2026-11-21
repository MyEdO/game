// LE PIXEL CONSTANT DES MAQUETTES (#4585, règle 7 de `docs/plans/2026-11-21-maquettes-en-donnees.md`) : chaque état de
// chaque écran (`rendre.mjs --ecrans`) rendu par `hotes/godot/cibles/propositions/sources/rendre.mjs` dans chacun de ses formats (`FORMATS`, `rendre.mjs --formats`), sous le navigateur
// épinglé, en `<dossier>/<format>/<écran>-<état>.png`. `--reference` pose la référence d'une tête, avec sa tête
// (`tete.json` : le commit et si l'arbre diffère de lui) ; `--comparer` rend l'arbre courant et compare chaque PNG à
// celui de la référence (`ecart`, `planches.mjs`). Le code de `rendre.mjs` (ses relevés) n'entre pas ici : la passe
// (`passe.mjs`) le juge. Sort en 1 si un PNG de la référence manque au rendu, ou l'inverse, ou si un PNG diffère de plus
// de `TOLERANCE` pixels ; la liste des états et formats qui diffèrent, leur nombre de pixels et leur boîte, va sur la
// sortie standard :
//   node pixels.mjs --reference [<référence>]                 par défaut `dist/maquettes-reference`, vidé avant
//   node pixels.mjs --comparer [<référence>] [--sortie <dossier>]   le rendu sous `dist/maquettes-pixels`, vidé avant
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { enFileBornee } from '../guards/lib/fileBornee.mjs'
import { ecart } from '../../hotes/godot/planches.mjs'

/** Les pixels qu'un PNG peut avoir d'écart à sa référence : deux passes de la même tête n'en ont aucun (mesure du
 *  2026-11-21, 170 états × 4 formats, #4585). */
const TOLERANCE = 0
/** Les rendus de front : un Chromium par `rendre.mjs`. */
const DE_FRONT = 3

/** Les sources des maquettes, que `rendre.mjs` rend. */
const SOURCES = fileURLToPath(new URL('../../hotes/godot/cibles/propositions/sources/', import.meta.url))
/** Ce que `rendre.mjs` liste : ses écrans (`--ecrans`) ou ses formats (`--formats`), un par ligne. */
const lister = (quoi) => {
  const r = spawnSync(process.execPath, [join(SOURCES, 'rendre.mjs'), quoi], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`rendre.mjs ${quoi} : code ${r.status}\n${r.stderr}`)
  return r.stdout.split('\n').filter(Boolean)
}
const FORMATS = lister('--formats')
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const { values: o, positionals: [cible] } = parseArgs({ allowPositionals: true, options: { reference: { type: 'boolean' }, comparer: { type: 'boolean' }, sortie: { type: 'string' } } })
if (o.reference === o.comparer) throw new Error('node pixels.mjs --reference [<référence>] | --comparer [<référence>] [--sortie <dossier>]')
const reference = resolve(cible ?? join(DIST, 'maquettes-reference'))
const dossier = o.reference ? reference : resolve(o.sortie ?? join(DIST, 'maquettes-pixels'))
/** Le nom de dossier d'un format (`16:9` → `16x9`). */
const dossierDu = (format) => format.replace(':', 'x')

/** Rend chaque état de chaque écran dans chaque format sous `dossier`, neuf. */
async function rendreTout() {
  rmSync(dossier, { recursive: true, force: true })
  for (const f of FORMATS) mkdirSync(join(dossier, dossierDu(f)), { recursive: true })
  const ecrans = lister('--ecrans')
  const rendu = (ecran, format) => () => new Promise((fini) => {
    const p = spawn(process.execPath, [join(SOURCES, 'rendre.mjs'), ecran, join(dossier, dossierDu(format), `${ecran}.png`), '--format', format], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 400_000 })
    let erreur = ''
    p.stderr.on('data', (d) => { erreur += d })
    p.on('close', (code) => fini(code === 0 || code === 1 ? null : `${ecran} ${format} : code ${code}\n${erreur}`))
  })
  const fautes = (await enFileBornee(ecrans.flatMap((e) => FORMATS.map((f) => rendu(e, f))), { deFront: DE_FRONT })).filter(Boolean)
  if (fautes.length) throw new Error(`[pixels] rendu en échec :\n${fautes.join('\n')}`)
  const tete = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const sale = spawnSync('git', ['status', '--porcelain', '--', SOURCES], { encoding: 'utf8' }).stdout.trim() !== ''
  writeFileSync(join(dossier, 'tete.json'), `${JSON.stringify({ tete, sale })}\n`)
  return ecrans.length
}

const ecrans = await rendreTout()
const pngs = (d) => FORMATS.flatMap((f) => readdirSync(join(d, dossierDu(f))).filter((n) => n.endsWith('.png')).map((n) => join(dossierDu(f), n))).sort()
const rendus = pngs(dossier)
console.log(`[pixels] ${ecrans} écrans, ${rendus.length} PNG (${rendus.length / FORMATS.length} états × ${FORMATS.length} formats) sous ${dossier}`)
if (o.comparer) {
  const { tete, sale } = JSON.parse(readFileSync(join(reference, 'tete.json'), 'utf8'))
  const attendus = pngs(reference)
  const manquent = attendus.filter((p) => !rendus.includes(p)).map((p) => `${p} : absent du rendu`)
  const neufs = rendus.filter((p) => !attendus.includes(p)).map((p) => `${p} : absent de la référence`)
  const ecarts = attendus.filter((p) => rendus.includes(p)).map((p) => ({ p, ...ecart(readFileSync(join(dossier, p)), readFileSync(join(reference, p))) })).filter(({ pixels }) => pixels)
  for (const l of [...manquent, ...neufs]) console.log(`[pixels] ${l}`)
  for (const { p, pixels, boite } of ecarts) console.log(`[pixels] ${p} : ${pixels} pixels, ${boite}${pixels > TOLERANCE ? '' : ' (dans la tolérance)'}`)
  const hors = ecarts.filter(({ pixels }) => pixels > TOLERANCE).length
  console.log(`[pixels] contre la référence de ${tete}${sale ? ' (arbre modifié)' : ''} : ${ecarts.length} PNG qui diffèrent, ${hors} au-delà de la tolérance (${TOLERANCE}), ${manquent.length + neufs.length} sans pendant`)
  process.exitCode = hors || manquent.length || neufs.length ? 1 : 0
}
