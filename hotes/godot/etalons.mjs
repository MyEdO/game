// LE BANC DES ÉTALONS (#3935) : chaque planche de l'export Web de l'hôte Godot (`<export>/planches/`, déposées par
// `construire.mjs --export`, `planches.mjs`) montrée dans un Chrome sans GPU, à la vue de référence (`VUE_REFERENCE`,
// `scripts/recette/lib.mjs`), sans son monde 3D (`?planche=<nom>&monde=sans`, `projet/scripts/pont_de_planche.gd`, un
// navigateur neuf par planche, deux planches de front par `enFileBornee`), capturée une fois dite montrée
// (`wfrpPlancheMontree`), et comparée pixel à pixel à son étalon `etalons/<nom>.png`. Avant toute capture, le navigateur
// lancé et la plateforme passent l'épingle (`refusDuNavigateur` : `Chrome/<EPINGLE.chrome>` sous Linux x86-64), sinon
// le banc sort en 1. Un étalon qu'aucune planche de l'export ne porte, un pixel d'écart, un étalon absent ou d'une autre
// taille, ou une erreur de la page, dont une méthode du pont que la planche ne sert pas, sort en 1. Le rapport
// (`--rapport <dossier>`) garde le rendu de chaque planche, sa capture avec le monde, et une page qui les range près de
// leur étalon, l'écart en surimpression ; il dit de chaque étalon s'il est celui que l'utilisateur a validé
// (`valides.json` : son empreinte). Le rapport, le journal et le code de sortie suivent l'ordre des noms.
//
//   npm run godot:etalons                                                     l'export, puis le banc qui compare
//   node hotes/godot/etalons.mjs --web <export> [--rapport <dossier>] [--planche <nom>]...
//   node hotes/godot/etalons.mjs --web <export> --poser [--planche <nom>]...   écrit le rendu comme étalon
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs'
import { enFileBornee } from '../../scripts/guards/lib/fileBornee.mjs'
import { VUE_REFERENCE, consoleGuard, launchSession, sleep, waitFor } from '../../scripts/recette/lib.mjs'
import { DOSSIER_DES_ETALONS, VALIDES, etalonsSansPlanche, refusDuNavigateur } from './planches.mjs'
import { FIL_DE_LA_PAGE_MS, WEBGL_LOGICIEL, servir } from './servir.mjs'

const { values: o } = parseArgs({
  options: { web: { type: 'string' }, poser: { type: 'boolean' }, rapport: { type: 'string' }, planche: { type: 'string', multiple: true } },
})
if (!o.web) throw new Error('usage : node hotes/godot/etalons.mjs --web <dossier de l’export> [--poser] [--rapport <dossier>] [--planche <nom>]...')

/** Le temps laissé à l'écran, la planche dite montrée, avant sa capture. */
const POSE_MS = 400

/** Les pixels qui diffèrent entre les PNG `a` et `b`, et la boîte qui les contient ; tous, d'une taille à l'autre. */
function ecart(a, b) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.w !== B.w || A.h !== B.h) return { pixels: A.w * A.h, boite: `étalon ${B.w}×${B.h}, rendu ${A.w}×${A.h}` }
  let pixels = 0
  let [x0, y0, x1, y1] = [A.w, A.h, -1, -1]
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] === B.data[i] && A.data[i + 1] === B.data[i + 1] && A.data[i + 2] === B.data[i + 2]) continue
    pixels++
    const x = (i / 4) % A.w
    const y = Math.floor(i / 4 / A.w)
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  return { pixels, boite: pixels ? `de (${x0}, ${y0}) à (${x1}, ${y1})` : '' }
}

const empreinte = (png) => createHash('sha256').update(png).digest('hex')

/** La page du rapport : chaque planche, son verdict, son étalon, son rendu en surimpression de différence, et sa capture
 *  avec le monde. */
function pageDuRapport(lignes) {
  const valides = lignes.filter((l) => l.valide).length
  const rangee = (l) => `<section><h2>${l.nom} <small>${l.titre}</small></h2><p class="${l.verdict === 'conforme' ? 'ok' : 'ko'}">${l.verdict}${l.valide ? ' · validé' : ' · à valider'}</p>
<div class="images"><figure><img src="${l.nom}.etalon.png"><figcaption>étalon</figcaption></figure>
<figure><div class="ecart"><img src="${l.nom}.etalon.png"><img src="${l.nom}.rendu.png"></div><figcaption>écart (noir : aucun)</figcaption></figure>
<figure><img src="${l.nom}.monde.png"><figcaption>dans le jeu</figcaption></figure></div></section>`
  return `<!doctype html><meta charset="utf-8"><title>Étalons</title>
<style>body{background:#111;color:#ddd;font:14px sans-serif;margin:16px}img{max-width:100%;display:block}.images{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}.ecart{position:relative}.ecart img+img{position:absolute;inset:0;mix-blend-mode:difference}.ok{color:#8c8}.ko{color:#e66}small{font-weight:normal;color:#999}</style>
<h1>Étalons : ${valides} validés sur ${lignes.length} planches</h1>
${lignes.map(rangee).join('\n')}`
}

/** Le Chrome du banc, lancé à la vue de référence en WebGL logiciel. */
const lancer = () => launchSession({ width: VUE_REFERENCE.largeur, height: VUE_REFERENCE.hauteur, timeoutMs: 30000, args: WEBGL_LOGICIEL })

async function comparer() {
  const planches = join(o.web, 'planches')
  const tous = readdirSync(planches).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort()
  const orphelins = etalonsSansPlanche(readdirSync(DOSSIER_DES_ETALONS), tous)
  if (orphelins.length) {
    console.error(`[etalons] étalon(s) qu'aucune planche de l'export ne porte : ${orphelins.join(', ')}`)
    return 1
  }
  const sonde = await lancer()
  const { product } = await sonde.rpcNavigateur('Browser.getVersion').finally(() => sonde.close())
  const refus = refusDuNavigateur(product, { plateforme: process.platform, architecture: process.arch })
  if (refus) {
    console.error(`[etalons] ${refus}`)
    return 1
  }
  const noms = o.planche ?? tous
  const valides = JSON.parse(readFileSync(VALIDES, 'utf8'))
  if (o.rapport) mkdirSync(o.rapport, { recursive: true })
  const srv = await servir({ web: o.web })
  /** La capture de la planche `nom` une fois montrée, dans un navigateur neuf, les erreurs de sa page versées à
   *  `erreurs` ; avec son monde, une fois vêtu chaque corps de `bases` (par id de combattant, l'id de sa base,
   *  `vue.corps.combattants`). */
  const capturer = async (nom, bases, erreurs) => {
    const session = await lancer()
    const garde = consoleGuard(session)
    try {
      await session.rpc('Page.navigate', { url: `${srv.url}index.html?planche=${nom}&recette=1${bases ? '' : '&monde=sans'}` })
      await waitFor(session, `globalThis.wfrpPlancheMontree === ${JSON.stringify(nom)}`, { timeoutMs: 180000, evaluerMs: FIL_DE_LA_PAGE_MS })
      if (bases) await waitFor(session, `Object.entries(wfrpEcran.corps).every(([id, c]) => c.base === (${JSON.stringify(bases)}[id] ?? null))`, { timeoutMs: 300000, evaluerMs: FIL_DE_LA_PAGE_MS })
      await sleep(POSE_MS)
      return Buffer.from((await session.rpc('Page.captureScreenshot', { format: 'png' })).data, 'base64')
    } finally {
      erreurs.push(...garde.errors())
      await session.close()
    }
  }
  /** La ligne du rapport de la planche `nom` et les erreurs de ses pages ; l'étalon posé avec `--poser`. */
  const juger = async (nom) => {
    const { titre, reponses: { demarrer } } = JSON.parse(readFileSync(join(planches, `${nom}.json`), 'utf8'))
    const chemin = join(DOSSIER_DES_ETALONS, `${nom}.png`)
    const erreurs = []
    const rendu = await capturer(nom, null, erreurs)
    if (o.poser) writeFileSync(chemin, rendu)
    const etalon = existsSync(chemin) ? readFileSync(chemin) : null
    const { pixels, boite } = etalon ? ecart(rendu, etalon) : { pixels: -1, boite: '' }
    const verdict = !etalon ? 'sans étalon' : pixels ? `${pixels} pixels d’écart, ${boite}` : 'conforme'
    const valide = !!etalon && valides[nom]?.empreinte === empreinte(etalon)
    if (o.rapport) {
      writeFileSync(join(o.rapport, `${nom}.rendu.png`), rendu)
      if (etalon) writeFileSync(join(o.rapport, `${nom}.etalon.png`), etalon)
      const bases = Object.fromEntries(Object.entries(demarrer.vue.corps.combattants).map(([id, c]) => [id, c?.base ?? null]))
      writeFileSync(join(o.rapport, `${nom}.monde.png`), await capturer(nom, bases, erreurs))
    }
    return { nom, titre, verdict, valide, erreurs }
  }
  let lignes
  try {
    lignes = await enFileBornee(noms.map((nom) => () => juger(nom)), { deFront: 2 })
  } finally {
    srv.fermer()
  }
  if (o.rapport) writeFileSync(join(o.rapport, 'index.html'), pageDuRapport(lignes))
  for (const l of lignes) console.log(`[etalons] ${l.nom} : ${l.verdict}${l.valide ? ', validé' : ''}`)
  const erreurs = lignes.flatMap((l) => l.erreurs.map((e) => ({ nom: l.nom, ...e })))
  for (const e of erreurs) console.log(`[etalons] console de ${e.nom} :`, e.level, e.text)
  const fautes = lignes.filter((l) => l.verdict !== 'conforme').length
  console.log(`[etalons] ${lignes.length} planches, ${lignes.filter((l) => l.valide).length} étalons validés, ${fautes} en écart, ${erreurs.length} erreur(s) de console`)
  return fautes || erreurs.length ? 1 : 0
}

process.exitCode = await comparer()
