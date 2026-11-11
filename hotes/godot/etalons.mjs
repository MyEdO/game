// LE BANC DES ÉTALONS (#3935) : chaque planche du dépôt (`planches.mjs`) montrée par l'export Web de l'hôte Godot dans un
// Chrome sans GPU, à la vue de référence (`VUE_REFERENCE`, `scripts/recette/lib.mjs`), sans son monde 3D
// (`?planche=<nom>&monde=sans`, un navigateur neuf par planche, `projet/scripts/pont_de_planche.gd`), capturée une fois dite
// montrée (`wfrpPlancheMontree`), et comparée pixel à pixel à son étalon `etalons/<nom>.png`. Un pixel
// d'écart, un étalon absent ou d'une autre taille, ou une erreur de la page, sort en 1. Le rapport (`--rapport <dossier>`)
// garde le rendu de chaque planche, sa capture avec le monde, et une page qui les range près de leur étalon, l'écart en
// surimpression ; il dit de chaque étalon s'il est celui que l'utilisateur a validé (`valides.json` : son empreinte).
//
//   node hotes/godot/etalons.mjs --enregistrer                       réécrit les planches depuis le pont (`figerLesPlanches`),
//                                                                    sur les modèles épinglés (`recupererModeles`)
//   node hotes/godot/etalons.mjs --web <export> [--rapport <dossier>] [--planche <nom>]...
//   node hotes/godot/etalons.mjs --web <export> --poser [--planche <nom>]...   écrit le rendu comme étalon
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs'
import { VUE_REFERENCE, consoleGuard, launchSession, sleep, waitFor } from '../../scripts/recette/lib.mjs'
import { chargerAssets } from './asset/charger.mjs'
import { listage } from './listage.mjs'
import { DOSSIER_DES_ETALONS, DOSSIER_DES_PLANCHES, MONDES, VALIDES, nomsDesPlanches } from './planches.mjs'
import { FIL_DE_LA_PAGE_MS, WEBGL_LOGICIEL, servir } from './servir.mjs'

const { values: o } = parseArgs({
  options: { enregistrer: { type: 'boolean' }, web: { type: 'string' }, poser: { type: 'boolean' }, rapport: { type: 'string' }, planche: { type: 'string', multiple: true } },
})
if (!o.enregistrer === !o.web) throw new Error('usage : node hotes/godot/etalons.mjs --enregistrer | --web <dossier de l’export> [--poser] [--rapport <dossier>] [--planche <nom>]...')

/** Le temps laissé à l'écran, la planche dite montrée, avant sa capture. */
const POSE_MS = 400

/** Les planches du pont écrites sous `planches/`, celles d'avant retirées, et le monde de chaque scénario sous `mondes/`. */
async function enregistrer() {
  const { DOSSIER_DES_MODELES, recupererModeles, figerLesPlanches } = await chargerAssets(["export { figerLesPlanches } from '/hotes/godot/recettes/ecran.ts';"])
  await recupererModeles({ dossier: DOSSIER_DES_MODELES })
  const planches = figerLesPlanches(listage(DOSSIER_DES_MODELES))
  rmSync(DOSSIER_DES_PLANCHES, { recursive: true, force: true })
  mkdirSync(join(DOSSIER_DES_PLANCHES, MONDES), { recursive: true })
  const mondes = new Map()
  for (const { monde, ...planche } of planches) {
    const { scenario } = planche.parametres
    const json = JSON.stringify(monde)
    if (mondes.has(scenario) && mondes.get(scenario) !== json) throw new Error(`${planche.nom} : le monde de ${scenario} n’est pas celui de ses autres planches`)
    mondes.set(scenario, json)
    writeFileSync(join(DOSSIER_DES_PLANCHES, `${planche.nom}.json`), `${JSON.stringify(planche)}\n`)
  }
  for (const [scenario, json] of mondes) writeFileSync(join(DOSSIER_DES_PLANCHES, MONDES, `${scenario}.json`), `${json}\n`)
  console.log(`[etalons] ${planches.length} planches enregistrées, ${mondes.size} mondes`)
}

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

async function comparer() {
  const noms = o.planche ?? nomsDesPlanches()
  const valides = JSON.parse(readFileSync(VALIDES, 'utf8'))
  if (o.rapport) mkdirSync(o.rapport, { recursive: true })
  const srv = await servir({ web: o.web })
  const lignes = []
  const erreurs = []
  let fautes = 0
  /** La capture de la planche `nom` une fois montrée, dans un navigateur neuf ; avec son monde, une fois vêtu chaque
   *  corps de `bases` (par id de combattant, l'id de sa base, `vue.corps.combattants`). */
  const capturer = async (nom, bases) => {
    const session = await launchSession({ width: VUE_REFERENCE.largeur, height: VUE_REFERENCE.hauteur, timeoutMs: 30000, args: WEBGL_LOGICIEL })
    const garde = consoleGuard(session)
    try {
      await session.rpc('Page.navigate', { url: `${srv.url}index.html?planche=${nom}&rendu=econome${bases ? '' : '&monde=sans'}` })
      await waitFor(session, `globalThis.wfrpPlancheMontree === ${JSON.stringify(nom)}`, { timeoutMs: 180000, evaluerMs: FIL_DE_LA_PAGE_MS })
      if (bases) await waitFor(session, `Object.entries(wfrpEcran.corps).every(([id, c]) => c.base === (${JSON.stringify(bases)}[id] ?? null))`, { timeoutMs: 300000, evaluerMs: FIL_DE_LA_PAGE_MS })
      await sleep(POSE_MS)
      return Buffer.from((await session.rpc('Page.captureScreenshot', { format: 'png' })).data, 'base64')
    } finally {
      erreurs.push(...garde.errors().map((e) => ({ nom, ...e })))
      await session.close()
    }
  }
  try {
    for (const nom of noms) {
      const { titre, demarrer } = JSON.parse(readFileSync(join(DOSSIER_DES_PLANCHES, `${nom}.json`), 'utf8'))
      const chemin = join(DOSSIER_DES_ETALONS, `${nom}.png`)
      const rendu = await capturer(nom, null)
      if (o.poser) writeFileSync(chemin, rendu)
      const etalon = existsSync(chemin) ? readFileSync(chemin) : null
      const { pixels, boite } = etalon ? ecart(rendu, etalon) : { pixels: -1, boite: '' }
      const verdict = !etalon ? 'sans étalon' : pixels ? `${pixels} pixels d’écart, ${boite}` : 'conforme'
      if (verdict !== 'conforme') fautes++
      const valide = !!etalon && valides[nom]?.empreinte === empreinte(etalon)
      lignes.push({ nom, titre, verdict, valide })
      console.log(`[etalons] ${nom} : ${verdict}${valide ? ', validé' : ''}`)
      if (o.rapport) {
        writeFileSync(join(o.rapport, `${nom}.rendu.png`), rendu)
        if (etalon) writeFileSync(join(o.rapport, `${nom}.etalon.png`), etalon)
        const bases = Object.fromEntries(Object.entries(demarrer.vue.corps.combattants).map(([id, c]) => [id, c?.base ?? null]))
        writeFileSync(join(o.rapport, `${nom}.monde.png`), await capturer(nom, bases))
      }
    }
    if (o.rapport) writeFileSync(join(o.rapport, 'index.html'), pageDuRapport(lignes))
  } finally {
    srv.fermer()
  }
  for (const e of erreurs) console.log(`[etalons] console de ${e.nom} :`, e.level, e.text)
  console.log(`[etalons] ${lignes.length} planches, ${lignes.filter((l) => l.valide).length} étalons validés, ${fautes} en écart, ${erreurs.length} erreur(s) de console`)
  return fautes || erreurs.length ? 1 : 0
}

process.exitCode = o.enregistrer ? (await enregistrer(), 0) : await comparer()
