// LE RENDU DES MAQUETTES (#3935, #4411), sous Playwright, avec le relevé des pièces d'interface hors de la vue, croisées,
// débordées par ce qu'elles portent, au texte coupé, des feuilles (texte, contrôle) recouvertes, rognées par un ancêtre
// (`overflow`, ellipse) ou qui se chevauchent, et du défilement de la page. Ce qui se pose exprès au-dessus d'une autre
// feuille (bulle de refus, badge sur un portrait) porte la marque `data-dessus` : il peut couvrir un contrôle ou
// l'élément qu'il qualifie, son parent, jamais un autre texte, et reste dans son cadre (dans la vue hors cadre) ; ce dont le contenu défile par
// dessin (la valeur d'un champ long) porte `data-defile` :
//   node rendre.mjs <page.html> <sortie.png> [échelle]          une page dessinée, en 1280 × 720, à l'échelle (1,5 par défaut)
//   node rendre.mjs <écran> <sortie.png> --format <format> [--etat <état>]    l'état `<état>` de l'écran
//     `maquettes/<écran>.ts` en `<sortie.png>`, sans `--etat` chacun de ses états en `<sortie>-<état>.png`, dessiné par
//     `rendu.html` dans le format physique `<format>` (`FORMATS`). L'état, une donnée écrite (`maquettes/maquette.ts`),
//     est posé sur `globalThis.MAQUETTE` avant la page.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listerEntrees } from '../../../../../scripts/guards/lib/lister.mjs'
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

/** Le dossier des écrans, `maquettes/<écran>.ts`. */
const MAQUETTES = fileURLToPath(new URL('./maquettes/', import.meta.url))

/** Les états de l'écran `nom`, ou son seul état `etat`. */
async function chargerLEcran(nom, etat) {
  const [module] = await Promise.all(listerEntrees(MAQUETTES).entrees.filter((f) => f.nom === `${nom}.ts`)
    .map((f) => import(pathToFileURL(join(MAQUETTES, f.nom)).href)))
  if (!module) throw new Error(`${nom} : aucun écran maquettes/${nom}.ts`)
  const ecran = module.default
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
  /* ce que le fond d'un cadre porte hors de son cadre, sauf sous un ancêtre qui le rogne ou le fait défiler, une pièce
     sans boîte qui porte des éléments visibles, et ce qui se pose au-dessus (`data-dessus`) hors de son cadre, ou de la
     vue quand il n'est dans aucun cadre */
  const rogne = (d, piece) => { for (let a = d.parentElement; a && a !== piece; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') return true; return false }
  const deborde = [...document.querySelectorAll('[data-piece]')].flatMap((e) => {
    const fond = e.querySelector(':scope > .fond')
    const r = e.getBoundingClientRect()
    const hors = (q) => q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1
    return (fond && [...fond.querySelectorAll('*')].some((d) => { const q = d.getBoundingClientRect(); return q.width && !rogne(d, e) && hors(q) }))
      || ((r.width < 1 || r.height < 1) && [...e.querySelectorAll('*')].some((d) => d.getBoundingClientRect().width > 0)) ? [e.dataset.piece] : []
  }).concat([...document.querySelectorAll('[data-dessus]')].filter((d) => {
    const c = d.closest('.cadre')?.getBoundingClientRect() ?? new DOMRect(0, 0, largeur, hauteur), q = d.getBoundingClientRect()
    return q.left < c.left - 1 || q.right > c.right + 1 || q.top < c.top - 1 || q.bottom > c.bottom + 1
  }).map((d) => d.closest('[data-piece]')?.dataset.piece ?? '-'))
  const coupe = [...document.querySelectorAll('[data-texte]')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.dataset.texte)
  /* les feuilles visibles : un texte (le rectangle de chacune de ses lignes) ou un contrôle (sa boîte) */
  const nomme = (e) => `${e.closest('[data-piece]')?.dataset.piece ?? '-'} : ${(e.textContent.trim().replace(/\s+/g, ' ') || e.className.baseVal || e.className).slice(0, 40)}`
  const CONTROLE = '.plaque, .bouton-rond, .champ, .portrait, .jauge, .sceau, .disque, .medaillon, .pill'
  /* les lignes d'un texte : la boîte de police de chacune, ramenée à la hauteur de ligne qui lui est allouée */
  const lignes = (e) => {
    const plage = document.createRange()
    plage.selectNodeContents(e)
    const ligne = parseFloat(getComputedStyle(e).lineHeight)
    return [...plage.getClientRects()].filter((q) => q.width > .5 && q.height > .5).map((q) => (ligne < q.height ? new DOMRect(q.left, q.top + (q.height - ligne) / 2, q.width, ligne) : q))
  }
  /* le cœur d'une ligne de texte : la moitié du milieu de sa boîte de police, que les lignes voisines ne touchent pas */
  const coeur = (q) => new DOMRect(q.left, q.top + q.height / 4, q.width, q.height / 2)
  const feuilles = [...document.querySelectorAll('#ui *')].filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).flatMap((e) => {
    if (e.matches(CONTROLE)) { const q = e.getBoundingClientRect(); return q.width && q.height ? [{ e, texte: false, rects: [q], coeurs: [q] }] : [] }
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return []
    const rects = lignes(e)
    return rects.length ? [{ e, texte: true, rects, coeurs: rects.map(coeur) }] : []
  })
  /* une feuille qu'un autre élément recouvre : le début, le milieu ou la fin d'une de ses lignes ou de sa boîte, hors de
     ce qu'un ancêtre rogne ou fait défiler, tombe sur ce qui la cache, un contrôle ou un fond peint, hors d'elle et de ses
     ancêtres ; ce qui porte `data-dessus` peut couvrir un contrôle, ou l'élément qu'il qualifie (son parent) */
  const peint = (a) => { const s = getComputedStyle(a); return a.matches(CONTROLE) || (s.backgroundClip !== 'text' && (s.backgroundImage !== 'none' || !/^rgba\(.*, 0\)$|^transparent$/.test(s.backgroundColor))) }
  const cache = (v, e) => { for (let a = v; a && !a.contains(e); a = a.parentElement) if (peint(a)) return a; return null }
  const rognePoint = (e, x, y) => { for (let a = e; a; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') { const r = a.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true } return false }
  const recouvert = [...new Set(feuilles.filter(({ e, texte, rects }) => rects.some((q) => [q.left + 2, q.left + q.width / 2, q.right - 2].some((x) => {
    const y = (q.top + q.bottom) / 2
    if (y < 0 || y > hauteur || x < 0 || x > largeur || rognePoint(e, x, y)) return false
    const v = document.elementFromPoint(x, y), m = v?.closest('[data-dessus]')
    return v && !e.contains(v) && cache(v, e) && !(m && (!texte || m.parentElement.contains(e)))
  }))).map((f) => nomme(f.e)))]
  /* une feuille qui sort d'un ancêtre qui la rogne ou la fait défiler (`overflow` non visible ; un texte : lui-même
     compris), sauf celui qui porte `data-defile`, dont le contenu défile par dessin, ou dont la ligne finit par une
     ellipse */
  const rogneLa = ({ e, texte, rects }) => {
    if (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) return 'ellipse'
    for (let a = texte ? e : e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a), r = a.getBoundingClientRect()
      const x = s.overflowX !== 'visible', y = s.overflowY !== 'visible'
      if ((x || y) && !a.hasAttribute('data-defile') && rects.some((q) => (x && (q.left < r.left - 1 || q.right > r.right + 1)) || (y && (q.top < r.top - 1 || q.bottom > r.bottom + 1)))) return a.id || a.classList[0]
    }
    return ''
  }
  const rognes = [...new Set(feuilles.flatMap((f) => { const par = rogneLa(f); return par ? [`${nomme(f.e)} (${par})`] : [] }))]
  /* deux feuilles, aucune ancêtre de l'autre, qui se recouvrent, dans une pièce ou d'une pièce à l'autre (une pièce
     dont la boîte ne contient pas ses feuilles échappe à `croise`) ; ce qui porte `data-dessus` peut couvrir un
     contrôle, ou l'élément qu'il qualifie (son parent), jamais un autre texte */
  const chevauche = new Set()
  /* ce qui se voit d'une feuille : ses rectangles coupés par les ancêtres qui la rognent (un texte : lui-même compris) */
  const visibles = ({ e, texte, coeurs }) => {
    let vus = coeurs
    for (let a = texte ? e : e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const r = a.getBoundingClientRect()
      vus = vus.map((q) => { const g = s.overflowX === 'visible' ? q.left : Math.max(q.left, r.left), d = s.overflowX === 'visible' ? q.right : Math.min(q.right, r.right), h = s.overflowY === 'visible' ? q.top : Math.max(q.top, r.top), b = s.overflowY === 'visible' ? q.bottom : Math.min(q.bottom, r.bottom); return new DOMRect(g, h, d - g, b - h) }).filter((q) => q.width > 0 && q.height > 0)
    }
    return vus
  }
  feuilles.forEach((f) => { f.coeurs = visibles(f) })
  const croisent = (p, q) => p.coeurs.some((a) => q.coeurs.some((c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > .5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > .5))
  for (let i = 0; i < feuilles.length; i++) for (let j = i + 1; j < feuilles.length; j++) {
    const p = feuilles[i], q = feuilles[j]
    if (p.e.contains(q.e) || q.e.contains(p.e) || !croisent(p, q)) continue
    const dessus = (f, g) => { const m = f.e.closest('[data-dessus]'); return m && !g.e.closest('[data-dessus]') && (!g.texte || m.parentElement.contains(g.e)) }
    if (!dessus(p, q) && !dessus(q, p)) chevauche.add(nomme(p.e) + ' x ' + nomme(q.e).replace(/^[^:]*: /, ''))
  }
  return { pieces: pieces.length, hors, croise, deborde, coupe, recouvert, rogne: rognes, chevauche: [...chevauche], defile: document.documentElement.scrollWidth > largeur || document.documentElement.scrollHeight > hauteur }
}

const [, , cible, png, ...reste] = process.argv
const option = (nom) => (reste.includes(nom) ? reste[reste.indexOf(nom) + 1] : undefined)
const page = cible.endsWith('.html')
const format = page ? { ...FORMATS['16:9'], facteur: Number(reste[0] ?? FORMATS['16:9'].facteur) } : FORMATS[option('--format')]
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
