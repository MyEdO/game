// LE RENDU DES MAQUETTES (#3935, #4411), sous Playwright, avec le relevé des pièces d'interface hors de la vue, croisées,
// débordées par ce qu'elles portent, au texte coupé ou recouvert, et du défilement de la page :
//   node rendre.mjs <page.html> <sortie.png> [échelle]          une page dessinée, en 1707 × 780, à l'échelle (2 par défaut)
//   node rendre.mjs <écran> <sortie.png> --format <format> [--etat <état>]    l'état `<état>` de l'écran
//     `maquettes/<écran>.ts` en `<sortie.png>`, sans `--etat` chacun de ses états en `<sortie>-<état>.png`, dessiné par
//     `rendu.html` dans le format physique `<format>` (`FORMATS`). L'état, une donnée écrite (`maquettes/maquette.ts`),
//     est posé sur `globalThis.MAQUETTE` avant la page.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

/** La vue `bureau` des vues de la recette, la vue de référence de la recette et des étalons. */
const BUREAU = JSON.parse(readFileSync(new URL('../../../../../scripts/recette/vues-recette.json', import.meta.url), 'utf8')).find((v) => v.nom === 'bureau')
/** Les formats physiques d'une maquette : sa fenêtre et son facteur d'appareil ; `bureau` à l'échelle 1. */
const FORMATS = {
  '16:9': { largeur: 1280, hauteur: 720, facteur: 1.5 },
  '21:9': { largeur: 1680, hauteur: 720, facteur: 1.5 },
  '16:10': { largeur: 1280, hauteur: 800, facteur: 1.5 },
  bureau: { largeur: BUREAU.largeur, hauteur: BUREAU.hauteur, facteur: 1 },
}

/** Les états de l'écran `nom`, ou son seul état `etat`. */
async function chargerLEcran(nom, etat) {
  const { default: ecran } = await import(`./maquettes/${nom}.ts`)
  const etats = ecran.etats.filter((m) => etat === undefined || m.nom === etat)
  if (!etats.length) throw new Error(`${nom} : aucun état ${etat} parmi ${ecran.etats.map((m) => m.nom).join(', ')}`)
  return etats
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
  /* ce que le fond d'un cadre porte hors de son cadre, sauf sous un ancêtre qui le rogne ou le fait défiler */
  const rogne = (d, piece) => { for (let a = d.parentElement; a && a !== piece; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') return true; return false }
  const deborde = [...document.querySelectorAll('[data-piece]')].flatMap((e) => {
    const fond = e.querySelector(':scope > .fond')
    if (!fond) return []
    const r = e.getBoundingClientRect()
    return [...fond.querySelectorAll('*')].some((d) => { const q = d.getBoundingClientRect(); return q.width && !rogne(d, e) && (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) }) ? [e.dataset.piece] : []
  })
  const coupe = [...document.querySelectorAll('[data-texte]')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.dataset.texte)
  /* un texte qu'un autre élément recouvre : le milieu de sa dernière ligne, hors de ce qu'un ancêtre rogne ou fait
     défiler, tombe hors de lui et de ses ancêtres */
  const rognePoint = (e, x, y) => { for (let a = e.parentElement; a; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') { const r = a.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true } return false }
  const recouvert = [...document.querySelectorAll('[data-texte]')].filter((e) => {
    const plage = document.createRange()
    plage.selectNodeContents(e)
    const q = [...plage.getClientRects()].filter((r) => r.width).at(-1)
    if (!q) return false
    const x = q.left + q.width / 2, y = (q.top + q.bottom) / 2
    if (y < 0 || y > hauteur || rognePoint(e, x, y)) return false
    const v = document.elementFromPoint(x, y)
    return v && !e.contains(v) && !v.contains(e)
  }).map((e) => e.dataset.texte)
  return { pieces: pieces.length, hors, croise, deborde, coupe, recouvert, defile: document.documentElement.scrollWidth > largeur || document.documentElement.scrollHeight > hauteur }
}

const [, , cible, png, ...reste] = process.argv
const option = (nom) => (reste.includes(nom) ? reste[reste.indexOf(nom) + 1] : undefined)
const page = cible.endsWith('.html')
const format = page ? { largeur: 1707, hauteur: 780, facteur: Number(reste[0] ?? 2) } : FORMATS[option('--format')]
if (!format) throw new Error(`rendre.mjs <écran> <sortie.png> --format ${Object.keys(FORMATS).join('|')} [--etat <état>]`)
const etat = option('--etat')
const etats = page ? null : await chargerLEcran(cible, etat)
const b = await chromium.launch()
/** La page `cible`, ou l'état `maquette` de l'écran, capturée en `sortie` avec son relevé. */
async function capturer(maquette, sortie) {
  const p = await b.newPage({ viewport: { width: format.largeur, height: format.hauteur }, deviceScaleFactor: format.facteur })
  const erreurs = []
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()) })
  p.on('pageerror', (e) => erreurs.push(String(e)))
  p.on('requestfailed', (r) => erreurs.push('requete ' + r.url()))
  if (maquette) await p.addInitScript((m) => { globalThis.MAQUETTE = m }, { etat: maquette })
  await p.goto('file://' + (page ? cible : fileURLToPath(new URL('./rendu.html', import.meta.url))))
  const rendu = page ? null : await p.waitForFunction(() => globalThis.RAPPORT_DU_RENDU, null, { timeout: 30000 }).then((h) => h.jsonValue())
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(400)
  const rapport = await p.evaluate(releve, [format.largeur, format.hauteur])
  await p.screenshot({ path: sortie, clip: { x: 0, y: 0, width: format.largeur, height: format.hauteur } })
  console.log(`${maquette?.nom ?? cible} erreurs`, erreurs.length, erreurs.slice(0, 5).join(' | '))
  console.log(JSON.stringify(rendu ? { ...rapport, ...rendu } : rapport))
  await p.close()
}
if (page) await capturer(null, png)
else for (const m of etats) await capturer(m, etat === undefined ? png.replace(/\.png$/, `-${m.nom}.png`) : png)
await b.close()
