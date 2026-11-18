// LE RENDU DES MAQUETTES (#3935, #4411), sous Playwright, avec le relevé des pièces d'interface hors de la vue, croisées
// ou au texte coupé, et du défilement de la page :
//   node rendre.mjs <page.html> <sortie.png> [échelle]          une page dessinée, en 1707 × 780, à l'échelle (2 par défaut)
//   node rendre.mjs <maquette> <sortie.png> --format <format>    une maquette de `maquettes/<maquette>.ts`, dessinée par
//     `rendu.html` dans le format physique `<format>` (`FORMATS`), avec les éléments qu'aucun bloc de ses gabarits ne
//     dessine. La maquette, les dessins de ses registres (`figerLesDessins`) et les couleurs du thème de Godot dont ses
//     paysages se tracent (`projet/art/theme.tres`, comme `Dessin.tracer`, `projet/scripts/dessin.gd`) sont posés sur
//     `globalThis.MAQUETTE` avant la page.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chargerAssets } from '../../../asset/charger.mjs'

/** La vue `bureau` des vues de la recette, la vue de référence de la recette et des étalons. */
const BUREAU = JSON.parse(readFileSync(new URL('../../../../../scripts/recette/vues-recette.json', import.meta.url), 'utf8')).find((v) => v.nom === 'bureau')
/** Les formats physiques d'une maquette : sa fenêtre et son facteur d'appareil ; `bureau` à l'échelle 1. */
const FORMATS = {
  '16:9': { largeur: 1280, hauteur: 720, facteur: 1.5 },
  '21:9': { largeur: 1680, hauteur: 720, facteur: 1.5 },
  '16:10': { largeur: 1280, hauteur: 800, facteur: 1.5 },
  bureau: { largeur: BUREAU.largeur, hauteur: BUREAU.hauteur, facteur: 1 },
}

/** Les couleurs `Dessin` du thème du projet Godot, par jeton (`var(--<jeton>)`, ses tirets en soulignés au thème). */
function couleursDuTheme() {
  const theme = readFileSync(new URL('../../../projet/art/theme.tres', import.meta.url), 'utf8')
  const hex = (c) => Math.round(Number(c) * 255).toString(16).padStart(2, '0')
  return Object.fromEntries([...theme.matchAll(/^Dessin\/colors\/(\w+) = Color\(([^,]+), ([^,]+), ([^,]+), [^)]+\)$/gm)].map(([, nom, r, v, b]) => [nom.replaceAll('_', '-'), `#${hex(r)}${hex(v)}${hex(b)}`]))
}

/** La maquette `nom` et ce que sa page lit : les icônes du registre, chaque paysage tracé aux couleurs du thème. */
async function chargerLaMaquette(nom) {
  const module = await chargerAssets([
    "export { figerLesDessins } from '/hotes/godot/asset/dessins.ts';",
    `export { default as maquette } from '/hotes/godot/cibles/propositions/sources/maquettes/${nom}.ts';`,
  ])
  const { icone, paysage } = module.figerLesDessins()
  const couleurs = couleursDuTheme()
  const tracer = (dessin) => dessin.replace(/currentColor/g, couleurs.encre).replace(/var\(--([\w-]+)\)/g, (tout, jeton) => {
    if (!couleurs[jeton]) throw new Error(`paysage : le jeton ${jeton} n'a aucune couleur au thème`)
    return couleurs[jeton]
  })
  return {
    maquette: module.maquette,
    dessins: {
      icone: icone.dessins,
      cadreDesPaysages: { largeur: paysage.largeur, hauteur: paysage.hauteur },
      paysage: Object.fromEntries(Object.entries(paysage.dessins).map(([id, svg]) => [id, tracer(svg)])),
    },
  }
}

/** Le relevé des pièces de la page dans la fenêtre `largeur` × `hauteur`. */
const releve = ([largeur, hauteur]) => {
  const pieces = [...document.querySelectorAll('[data-piece]')].map((e) => ({ n: e.dataset.piece, r: e.getBoundingClientRect() }))
  const hors = pieces.filter(({ r }) => r.left < 0 || r.top < 0 || r.right > largeur || r.bottom > hauteur).map((x) => x.n)
  const croise = []
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i].r, c = pieces[j].r
    if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) croise.push(pieces[i].n + ' x ' + pieces[j].n)
  }
  const coupe = [...document.querySelectorAll('[data-texte]')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.dataset.texte)
  return { pieces: pieces.length, hors, croise, coupe, defile: document.documentElement.scrollWidth > largeur || document.documentElement.scrollHeight > hauteur }
}

const [, , cible, png, ...reste] = process.argv
const iFormat = reste.indexOf('--format')
const page = cible.endsWith('.html')
const format = page ? { largeur: 1707, hauteur: 780, facteur: Number(reste[0] ?? 2) } : FORMATS[reste[iFormat + 1]]
if (!format) throw new Error(`rendre.mjs <maquette> <sortie.png> --format ${Object.keys(FORMATS).join('|')}`)
const injecte = page ? null : await chargerLaMaquette(cible)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: format.largeur, height: format.hauteur }, deviceScaleFactor: format.facteur })
const erreurs = []
p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()) })
p.on('pageerror', (e) => erreurs.push(String(e)))
p.on('requestfailed', (r) => erreurs.push('requete ' + r.url()))
if (injecte) await p.addInitScript((m) => { globalThis.MAQUETTE = m }, injecte)
await p.goto('file://' + (page ? cible : fileURLToPath(new URL('./rendu.html', import.meta.url))))
const rendu = page ? null : await p.waitForFunction(() => globalThis.RAPPORT_DU_RENDU, null, { timeout: 30000 }).then((h) => h.jsonValue())
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(400)
const rapport = await p.evaluate(releve, [format.largeur, format.hauteur])
await p.screenshot({ path: png, clip: { x: 0, y: 0, width: format.largeur, height: format.hauteur } })
console.log('erreurs', erreurs.length, erreurs.slice(0, 5).join(' | '))
console.log(JSON.stringify(rendu ? { ...rapport, ...rendu } : rapport))
await b.close()
