// LE PIXEL CONSTANT DES MAQUETTES (#4585, règle 7 de `docs/plans/2026-11-21-maquettes-en-donnees.md`) : chaque état de
// chaque écran (`rendre.mjs --ecrans`, ou les seuls écrans `--ecran`) rendu par
// `hotes/godot/cibles/propositions/sources/rendre.mjs` dans chacun de ses formats (`FORMATS`, `rendre.mjs --formats`),
// sous le navigateur épinglé, en `<dossier>/<format>/<écran>-<état>.png`, avec le relevé de chaque état (la ligne JSON de
// `rendre.mjs`) en `<dossier>/<format>/releves.json` et, en 16:9, le style calculé de chaque texte (`RELEVE_STYLES`) en
// `<dossier>/styles/<écran>--<état>.json`. `--reference` pose la référence d'une tête, avec sa tête (`tete.json` : le
// commit et si l'arbre diffère de lui) ; `--comparer` rend l'arbre courant et le confronte à la référence, sur les
// écrans rendus (`ecarts.mjs`) :
//   - chaque PNG à celui de la référence (`ecart`, `scripts/recette/ecart.mjs`) : ceux qui diffèrent, leur nombre de pixels et leur boîte ;
//   - les entrées de relevé neuves, dans chaque format (`relevesNeufs`) ;
//   - sous `--attendu <fichier.json>` (répétable, `{ "<écran>/<état>": [...] }`, l'union des fichiers) : les états
//     attendus restés inchangés et les états changés hors attendu (`confronter`) ;
//   - l'écart de style par signature (`ecartDeStyle`), en entier dans `<sortie>/style-ecart.json`, résumé sur la sortie
//     standard.
// Sort en 1 si un PNG de la référence manque au rendu ou l'inverse, si un relevé a une entrée neuve, si un PNG diffère de
// plus de `TOLERANCE` pixels (sous `--attendu` : si un état hors attendu diffère), et sous `--style-bloquant` si le
// style a un écart :
//   node pixels.mjs --reference [<référence>] [--ecran <écran>…]    par défaut `dist/maquettes-reference`, vidé avant
//   node pixels.mjs --comparer [<référence>] [--sortie <dossier>] [--ecran <écran>…] [--attendu <fichier.json>…] [--style-bloquant]
//     le rendu sous `dist/maquettes-pixels`, vidé avant
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { enFileBornee } from '../guards/lib/fileBornee.mjs'
import { ecart } from '../recette/ecart.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { confronter, ecartDeStyle, pngDe, relevesDeLaSortie, relevesNeufs } from './ecarts.mjs'

/** Les pixels qu'un PNG peut avoir d'écart à sa référence : deux passes de la même tête n'en ont aucun (mesure du
 *  2026-11-21, 170 états × 4 formats, #4585). */
const TOLERANCE = 0
/** Les rendus de front : un Chromium par `rendre.mjs`. */
const DE_FRONT = 3
/** Le format dont `rendre.mjs` écrit le style des textes. */
const FORMAT_DU_STYLE = '16:9'
/** Les lignes de chaque section du rapport sur la sortie standard. */
const LIGNES_AU_RAPPORT = 15

/** Les sources des maquettes, que `rendre.mjs` rend. */
const SOURCES = fileURLToPath(new URL('../../hotes/godot/cibles/propositions/sources/', import.meta.url))
/** Ce que `rendre.mjs` liste : ses écrans (`--ecrans`) ou ses formats (`--formats`), un par ligne. */
const lister = (quoi) => {
  const r = spawnSync(process.execPath, [join(SOURCES, 'rendre.mjs'), quoi], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`rendre.mjs ${quoi} : code ${r.status}\n${r.stderr}`)
  return r.stdout.split('\n').filter(Boolean)
}
/** Le nom de dossier d'un format (`16:9` → `16x9`). */
const dossierDu = (format) => format.replace(':', 'x')
const lireJson = (f) => JSON.parse(readFileSync(f, 'utf8'))

/** Rend chaque état de chaque écran de `ecrans` dans chaque format sous `dossier`, neuf, avec ses relevés et ses styles. */
async function rendreTout(dossier, ecrans, formats) {
  rmSync(dossier, { recursive: true, force: true })
  for (const f of formats) mkdirSync(join(dossier, dossierDu(f)), { recursive: true })
  const releves = tableTotale(formats, () => ({}))
  const rendu = (ecran, format) => () => new Promise((fini) => {
    const env = format === FORMAT_DU_STYLE ? { ...process.env, RELEVE_STYLES: join(dossier, 'styles') } : process.env
    const p = spawn(process.execPath, [join(SOURCES, 'rendre.mjs'), ecran, join(dossier, dossierDu(format), `${ecran}.png`), '--format', format], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 400_000, env })
    let sortie = '', erreur = ''
    p.stdout.on('data', (d) => { sortie += d })
    p.stderr.on('data', (d) => { erreur += d })
    p.on('close', (code) => {
      if (code !== 0 && code !== 1) return fini(`${ecran} ${format} : code ${code}\n${erreur}`)
      Object.assign(releves[format], relevesDeLaSortie(ecran, sortie))
      fini(null)
    })
  })
  const fautes = (await enFileBornee(ecrans.flatMap((e) => formats.map((f) => rendu(e, f))), { deFront: DE_FRONT })).filter(Boolean)
  if (fautes.length) throw new Error(`[pixels] rendu en échec :\n${fautes.join('\n')}`)
  for (const f of formats) writeFileSync(join(dossier, dossierDu(f), 'releves.json'), `${JSON.stringify(releves[f])}\n`)
  const tete = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const sale = spawnSync('git', ['status', '--porcelain', '--', SOURCES], { encoding: 'utf8' }).stdout.trim() !== ''
  writeFileSync(join(dossier, 'tete.json'), `${JSON.stringify({ tete, sale })}\n`)
}

/** Les relevés de chaque format sous `dossier`, réduits aux états des écrans `ecrans` ; une référence posée sans
 *  relevés est refusée. */
const relevesDe = (dossier, formats, ecrans) => tableTotale(formats, (f) => {
  const fichier = join(dossier, dossierDu(f), 'releves.json')
  if (!existsSync(fichier)) throw new Error(`[pixels] ${fichier} absent : référence posée sans relevés, à reposer par --reference`)
  return Object.fromEntries(Object.entries(lireJson(fichier)).filter(([cle]) => ecrans.has(cle.split('/')[0])))
})
/** Les styles des textes sous `dossier`, réduits aux écrans `ecrans`. */
const stylesDe = (dossier, ecrans) => {
  const d = join(dossier, 'styles')
  if (!existsSync(d)) throw new Error(`[pixels] ${d} absent : référence posée sans styles, à reposer par --reference`)
  return readdirSync(d).filter((n) => n.endsWith('.json') && ecrans.has(n.split('--')[0])).sort().flatMap((n) => lireJson(join(d, n)))
}
/** Les lignes d'une section, bornées à `LIGNES_AU_RAPPORT`. */
const imprimer = (lignes) => {
  for (const l of lignes.slice(0, LIGNES_AU_RAPPORT)) console.log(`[pixels]   ${l}`)
  if (lignes.length > LIGNES_AU_RAPPORT) console.log(`[pixels]   … et ${lignes.length - LIGNES_AU_RAPPORT} de plus`)
}

/** Confronte le rendu sous `dossier` à la `reference`, sur les écrans `ecrans`, et rend le code de sortie. */
function comparer({ dossier, reference, ecrans, formats, attendus, styleBloquant }) {
  const { tete, sale } = lireJson(join(reference, 'tete.json'))
  const vus = new Set(ecrans)
  const avant = relevesDe(reference, formats, vus), apres = relevesDe(dossier, formats, vus)
  /* les PNG d'un dossier et leur état, depuis ses relevés : `<format>/<écran>-<état>.png` → `<écran>/<état>` */
  const etatsDes = (releves) => new Map(formats.flatMap((f) => Object.keys(releves[f]).map((cle) => [`${dossierDu(f)}/${pngDe(...cle.split('/'))}`, cle])))
  const etatsAvant = etatsDes(avant), etatsApres = etatsDes(apres)
  const pngs = (d, etats) => formats.flatMap((f) => readdirSync(join(d, dossierDu(f))).filter((n) => etats.has(`${dossierDu(f)}/${n}`)).map((n) => `${dossierDu(f)}/${n}`)).sort()
  const attendusPng = pngs(reference, etatsAvant), rendus = pngs(dossier, etatsApres)
  const manquent = attendusPng.filter((p) => !rendus.includes(p)).map((p) => `${p} : absent du rendu`)
  const neufs = rendus.filter((p) => !attendusPng.includes(p)).map((p) => `${p} : absent de la référence`)
  const ecarts = attendusPng.filter((p) => rendus.includes(p)).map((p) => ({ p, ...ecart(readFileSync(join(dossier, p)), readFileSync(join(reference, p))) })).filter(({ pixels }) => pixels)
  for (const l of [...manquent, ...neufs]) console.log(`[pixels] ${l}`)
  for (const { p, pixels, boite } of ecarts) console.log(`[pixels] ${p} : ${pixels} pixels, ${boite}${pixels > TOLERANCE ? '' : ' (dans la tolérance)'}`)
  const hors = ecarts.filter(({ pixels }) => pixels > TOLERANCE)
  console.log(`[pixels] contre la référence de ${tete}${sale ? ' (arbre modifié)' : ''} : ${ecarts.length} PNG qui diffèrent, ${hors.length} au-delà de la tolérance (${TOLERANCE}), ${manquent.length + neufs.length} sans pendant`)

  const releves = formats.flatMap((f) => relevesNeufs(avant[f], apres[f]).map((n) => ({ format: f, ...n })))
  console.log(`[pixels] relevés neufs : ${releves.length}`)
  imprimer(releves.map(({ format, etat, releve, entrees }) => `${format} ${etat} ${releve} : ${entrees.map((e) => JSON.stringify(e)).join(' ; ')}`))

  let horsAttendu = []
  if (attendus.length) {
    const changes = [...new Set(hors.map(({ p }) => etatsAvant.get(p)))]
    const { inchanges, hors: h } = confronter(changes, attendus.map((a) => Object.fromEntries(Object.entries(a).filter(([cle]) => vus.has(cle.split('/')[0])))))
    horsAttendu = h
    console.log(`[pixels] états changés : ${changes.length} ; attendus restés inchangés : ${inchanges.length} ; changés hors attendu : ${h.length}`)
    if (inchanges.length) { console.log('[pixels] attendus restés inchangés :'); imprimer(inchanges) }
    if (h.length) { console.log('[pixels] changés hors attendu :'); imprimer(h) }
  }

  const style = ecartDeStyle(stylesDe(reference, vus), stylesDe(dossier, vus))
  writeFileSync(join(dossier, 'style-ecart.json'), `${JSON.stringify(style, null, 1)}\n`)
  console.log(`[pixels] écart de style : ${style.length} signatures, ${style.reduce((s, g) => s + g.n, 0)} éléments -> ${join(dossier, 'style-ecart.json')}`)
  imprimer(style.map(({ signature, n, exemple }) => `${n} × ${signature} ; ${JSON.stringify(exemple)}`))

  const pixelsEnFaute = attendus.length ? horsAttendu.length : hors.length
  return pixelsEnFaute || manquent.length || neufs.length || releves.length || (styleBloquant && style.length) ? 1 : 0
}

if (import.meta.main) {
  const usage = 'node pixels.mjs --reference [<référence>] [--ecran <écran>…] | --comparer [<référence>] [--sortie <dossier>] [--ecran <écran>…] [--attendu <fichier.json>…] [--style-bloquant]'
  const { values: o, positionals: [cible] } = parseArgs({
    allowPositionals: true,
    options: { reference: { type: 'boolean' }, comparer: { type: 'boolean' }, sortie: { type: 'string' }, ecran: { type: 'string', multiple: true }, attendu: { type: 'string', multiple: true }, 'style-bloquant': { type: 'boolean' } },
  })
  if (o.reference === o.comparer || (o.reference && (o.sortie || o.attendu || o['style-bloquant']))) throw new Error(usage)
  const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
  const formats = lister('--formats')
  const tous = lister('--ecrans')
  const inconnus = (o.ecran ?? []).filter((e) => !tous.includes(e))
  if (inconnus.length) throw new Error(`[pixels] écrans inconnus : ${inconnus.join(', ')}`)
  const ecrans = o.ecran ?? tous
  const reference = resolve(cible ?? join(DIST, 'maquettes-reference'))
  const dossier = o.reference ? reference : resolve(o.sortie ?? join(DIST, 'maquettes-pixels'))
  await rendreTout(dossier, ecrans, formats)
  const n = formats.reduce((s, f) => s + readdirSync(join(dossier, dossierDu(f))).filter((x) => x.endsWith('.png')).length, 0)
  console.log(`[pixels] ${ecrans.length} écrans, ${n} PNG (${n / formats.length} états × ${formats.length} formats) sous ${dossier}`)
  if (o.comparer) process.exitCode = comparer({ dossier, reference, ecrans, formats, attendus: (o.attendu ?? []).map(lireJson), styleBloquant: o['style-bloquant'] })
}
