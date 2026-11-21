// LE RENDU DES MAQUETTES (#3935, #4411), sous Playwright, avec le relevé des pièces d'interface hors de la vue, croisées,
// débordées par ce qu'elles portent (`deborde` : hors du fond de leur cadre, sur son bois ou au-delà), au texte coupé,
// hors du rect de leur rôle (`bouge` : la table rôle → rect de `rendu.js`, la même pour tous les états et tous les
// écrans ; ce qui porte `data-mobile` suit ce qu'il désigne), des places à l'intérieur d'un cadre hors du rect de leur
// ligne (`place` : la table place → rect de `rendu.js`, depuis le fond que la ligne du cadre donne), des cadres dont
// l'habillage change (`habille` : le fond hors de la boîte intérieure, ou des clous, ferrures et ruban autres qu'au
// premier état du même rôle de la même passe), des feuilles (texte, contrôle) recouvertes, rognées par un
// ancêtre (`overflow`, ellipse) ou qui se chevauchent (`chevauche` : deux textes sur la même bande par la zone de
// contenu de la police de leurs lignes, à moins de 3 px côte à côte ; un texte et un contrôle par le cœur des lignes), des actions principales (plaque armée, étape en cours) cachées
// sous le bord ou le fondu de ce qui défile (`cache`), des pièces du kit plus petites que leur taille fixée
// (`retrecit`), plus d'une croix dans l'écran (`croix`), et du défilement de la page. Ce qui se pose au survol
// (`data-ancre="survol"`) ou par-dessus d'autres cadres (`data-surcouche`, l'Index du Compendium) n'est pas compté par
// `croise` ; ce qu'une surcouche cache n'est ni `recouvert` ni `chevauche`. Ce qui se pose exprès au-dessus d'une autre feuille (bulle de refus,
// badge sur un portrait) porte la marque `data-dessus` : il peut couvrir un autre contrôle, son libellé compris,
// jamais un texte libre, pas même le libellé de l'élément qu'il qualifie, et reste dans son cadre (dans la vue hors cadre) ;
// la bulle qui n'a aucune pose libre (`data-sans-pose`, `gestes.js`) est `recouvert` ; ce
// dont le contenu défile en hauteur (une colonne, la valeur d'un champ long) porte `data-defile`, qui n'exempte de
// `rogne` que le haut et le bas, et cache à ses ancêtres ce qui défile hors de lui. Le relevé `contenu` (#4585) relève
// le rect de chaque enfant d'une place (`data-place`), ou du fond d'une pièce sans place, sous la clé porteur + rôle, et
// les entrées de ce qui y défile en une liste (départ, x, écarts, jamais leur rang) ; il classe l'écart d'un état à
// l'autre du même gabarit (`classe`, `contenus.mjs` : A boîte déplacée, B longueur de texte, C contenu de liste). Un A
// d'un gabarit de `PILOTES` (`fenetre-du-bas`, `combat`, `gestion`) est BLOQUANT, contre les états déjà rendus de la passe et, sous
// `RELEVE_CONTENUS=<dossier>` (un dossier neuf par passe), les autres écrans du gabarit qui y ont écrit leur
// `<écran>--<état>.json` ; les autres gabarits restent en RAPPORT, que `contenus.mjs <dossier>` agrège :
//   node rendre.mjs <page.html> <sortie.png> [échelle]          une page dessinée, en 1280 × 720, à l'échelle (1,5 par défaut)
//   node rendre.mjs <écran> <sortie.png> --format <format> [--etat <état>]    l'état `<état>` de l'écran
//     `maquettes/<écran>.ts` en `<sortie.png>`, sans `--etat` chacun de ses états en `<sortie>-<état>.png`, dessiné par
//     `rendu.html` dans le format physique `<format>` (`FORMATS`). L'état, une donnée écrite (`maquettes/maquette.ts`),
//     est posé sur `globalThis.MAQUETTE` avant la page.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listerEntrees } from '../../../../../scripts/guards/lib/lister.mjs'
import { chromium } from 'playwright'
import { classe, PILOTES } from './contenus.mjs'

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
  const pieces = [...document.querySelectorAll('[data-piece]')].map((e) => ({ n: e.dataset.piece, r: e.getBoundingClientRect(), pose: e.matches('[data-surcouche], [data-ancre="survol"]') }))
  const hors = pieces.filter(({ r }) => r.left < 0 || r.top < 0 || r.right > largeur || r.bottom > hauteur).map((x) => x.n)
  const croise = []
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i].r, c = pieces[j].r
    if (!pieces[i].pose && !pieces[j].pose && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) croise.push(pieces[i].n + ' x ' + pieces[j].n)
  }
  /* le cœur d'une ligne de texte : la moitié du milieu de sa boîte de police, que les lignes voisines ne touchent pas */
  const coeur = (q) => new DOMRect(q.left, q.top + q.height / 4, q.width, q.height / 2)
  /* ce que le fond d'un cadre porte hors de ce fond (sur le bois du cadre ou au-delà : un texte, le cœur de chacune
     de ses lignes ; un autre élément, sa boîte), sauf sous un ancêtre qui le rogne ou le fait défiler, une pièce
     sans boîte qui porte des éléments visibles, et ce qui se pose au-dessus (`data-dessus`) hors de son cadre, ou de la
     vue quand il n'est dans aucun cadre */
  const rogne = (d, piece) => { for (let a = d.parentElement; a && a !== piece; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') return true; return false }
  const deborde = [...document.querySelectorAll('[data-piece]')].flatMap((e) => {
    const fond = e.querySelector(':scope > .fond')
    const r = e.getBoundingClientRect(), f = fond?.getBoundingClientRect()
    const hors = (q) => q.left < f.left - 1 || q.right > f.right + 1 || q.top < f.top - 1 || q.bottom > f.bottom + 1
    const boites = (d) => {
      const textes = [...d.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
      if (!textes.length) return [d.getBoundingClientRect()]
      const plage = document.createRange()
      return textes.flatMap((n) => { plage.selectNodeContents(n); return [...plage.getClientRects()] }).map(coeur)
    }
    return (fond && [...fond.querySelectorAll('*')].some((d) => boites(d).some((q) => q.width && !rogne(d, e) && hors(q))))
      || ((r.width < 1 || r.height < 1) && [...e.querySelectorAll('*')].some((d) => d.getBoundingClientRect().width > 0)) ? [e.dataset.piece] : []
  }).concat([...document.querySelectorAll('[data-dessus]')].filter((d) => {
    const c = d.closest('.cadre')?.getBoundingClientRect() ?? new DOMRect(0, 0, largeur, hauteur), q = d.getBoundingClientRect()
    return q.left < c.left - 1 || q.right > c.right + 1 || q.top < c.top - 1 || q.bottom > c.bottom + 1
  }).map((d) => d.closest('[data-piece]')?.dataset.piece ?? '-'))
  const coupe = [...document.querySelectorAll('[data-texte]')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.dataset.texte)
  /* les feuilles visibles : un texte (le rectangle de chacune de ses lignes) ou un contrôle (sa boîte) */
  const nomme = (e) => `${e.closest('[data-piece]')?.dataset.piece ?? '-'} : ${(e.textContent.trim().replace(/\s+/g, ' ') || e.className.baseVal || e.className).slice(0, 40)}`
  const CONTROLE = '.plaque, .bouton-rond, .champ, .portrait, .jauge, .sceau, .disque, .medaillon, .pill, .facettes b'
  /* les lignes d'un texte : la boîte de police de chacune, ramenée à la hauteur de ligne qui lui est allouée ; ce qu'il
     porte au-dessus de lui (`data-dessus`) n'en est pas */
  const lignes = (e) => {
    const plage = document.createRange()
    const ligne = parseFloat(getComputedStyle(e).lineHeight)
    const dessus = e.closest('[data-dessus]')
    const rects = [...e.querySelectorAll('[data-dessus]')].some((d) => d.closest('[data-dessus]') !== dessus)
      ? [...e.childNodes].flatMap(function textes(n) { return n.nodeType === 3 ? [n] : n.nodeType === 1 && !(n.matches('[data-dessus]') && n !== dessus) ? [...n.childNodes].flatMap(textes) : [] })
        .flatMap((n) => { plage.selectNodeContents(n); return [...plage.getClientRects()] })
      : (plage.selectNodeContents(e), [...plage.getClientRects()])
    return rects.filter((q) => q.width > .5 && q.height > .5).map((q) => Object.assign(ligne < q.height ? new DOMRect(q.left, q.top + (q.height - ligne) / 2, q.width, ligne) : DOMRect.fromRect(q), { police: q }))
  }
  const feuilles = [...document.querySelectorAll('#ui *')].filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).flatMap((e) => {
    if (e.matches(CONTROLE)) { const q = e.getBoundingClientRect(); return q.width && q.height ? [{ e, texte: false, rects: [q], coeurs: [q] }] : [] }
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return []
    const rects = lignes(e)
    return rects.length ? [{ e, texte: true, rects, coeurs: rects.map(coeur) }] : []
  })
  /* une feuille qu'un autre élément recouvre : le début, le milieu ou la fin d'une de ses lignes ou de sa boîte, hors de
     ce qu'un ancêtre rogne ou fait défiler, tombe sur ce qui la cache, un contrôle ou un fond peint, hors d'elle et de ses
     ancêtres, ou ce qu'elle porte au-dessus d'elle ; ce qui porte `data-dessus` peut couvrir ce qui est `couvrable` */
  /* ce qu'une marque `data-dessus` peut couvrir : un contrôle, ou le libellé d'un contrôle qui ne la porte pas */
  const couvrable = (e, texte, m) => !texte || (e.closest(CONTROLE) && !e.closest(CONTROLE).contains(m))
  const peint = (a) => { const s = getComputedStyle(a); return a.matches(CONTROLE) || (s.backgroundClip !== 'text' && (s.backgroundImage !== 'none' || !/^rgba\(.*, 0\)$|^transparent$/.test(s.backgroundColor))) }
  const cache = (v, e) => { for (let a = v; a && !a.contains(e); a = a.parentElement) if (peint(a)) return a; return null }
  const rognePoint = (e, x, y) => { for (let a = e; a; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') { const r = a.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true } return false }
  const recouvert = [...new Set(feuilles.filter(({ e, texte, rects }) => rects.some((q) => [q.left + 2, q.left + q.width / 2, q.right - 2].some((x) => {
    const y = (q.top + q.bottom) / 2
    if (y < 0 || y > hauteur || x < 0 || x > largeur || rognePoint(e, x, y)) return false
    const v = document.elementFromPoint(x, y), m = v?.closest('[data-dessus]')
    return v && (!e.contains(v) || (m && !e.closest('[data-dessus]'))) && cache(v, e) && !(m && couvrable(e, texte, m)) && !(v.closest('[data-surcouche]') && !e.closest('[data-surcouche]'))
  }))).map((f) => nomme(f.e))), ...[...document.querySelectorAll('[data-sans-pose]')].map((b) => `bulle sans pose libre : ${b.textContent}`)]
  /* une feuille qui sort d'un ancêtre qui la rogne ou la fait défiler (`overflow` non visible ; un texte : lui-même
     compris), sauf par le haut ou le bas de celui qui porte `data-defile`, dont le contenu défile en hauteur, ou dont la
     ligne finit par une ellipse */
  const rogneLa = ({ e, texte, rects }) => {
    if (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) return 'ellipse'
    for (let a = texte ? e : e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a), r = a.getBoundingClientRect()
      const x = s.overflowX !== 'visible', y = s.overflowY !== 'visible' && !a.hasAttribute('data-defile')
      if ((x || y) && rects.some((q) => (x && (q.left < r.left - 1 || q.right > r.right + 1)) || (y && (q.top < r.top - 1 || q.bottom > r.bottom + 1)))) return a.id || a.classList[0]
      /* ce que `data-defile` cache, au-dessus ou au-dessous de lui, n'est plus mesuré par ses ancêtres */
      if (a.hasAttribute('data-defile')) rects = rects.filter((q) => q.bottom > r.top && q.top < r.bottom)
    }
    return ''
  }
  const rognes = [...new Set(feuilles.flatMap((f) => { const par = rogneLa(f); return par ? [`${nomme(f.e)} (${par})`] : [] }))]
  /* deux feuilles, aucune ancêtre de l'autre (hors ce qu'elle porte au-dessus d'elle), qui se recouvrent, dans une pièce
     ou d'une pièce à l'autre (une pièce dont la boîte ne contient pas ses feuilles échappe à `croise`) ; ce qui porte
     `data-dessus` peut couvrir ce qui est `couvrable` */
  const chevauche = new Set()
  /* ce qui se voit d'une feuille : ses rectangles coupés par les ancêtres qui la rognent (un texte : lui-même compris) */
  const visibles = ({ e, texte }, liste) => {
    let vus = liste
    for (let a = texte ? e : e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const r = a.getBoundingClientRect()
      vus = vus.map((q) => { const g = s.overflowX === 'visible' ? q.left : Math.max(q.left, r.left), d = s.overflowX === 'visible' ? q.right : Math.min(q.right, r.right), h = s.overflowY === 'visible' ? q.top : Math.max(q.top, r.top), b = s.overflowY === 'visible' ? q.bottom : Math.min(q.bottom, r.bottom); return new DOMRect(g, h, d - g, b - h) }).filter((q) => q.width > 0 && q.height > 0)
    }
    return vus
  }
  feuilles.forEach((f) => { f.coeurs = visibles(f, f.coeurs); f.vus = f.texte ? visibles(f, f.rects.map((q) => q.police)) : [] })
  /* deux textes se comparent par la zone de contenu de la police de leurs lignes (le rect de Range, pas la boîte de
     ligne) : sur la même bande (croisées sur plus de la moitié de la moins haute), à moins de 3 px côte à côte ; un
     contrôle, par le cœur des lignes du texte qu'il croise */
  const ECART = 3
  const croisent = (p, q) => (p.texte && q.texte
    ? p.vus.some((a) => q.vus.some((c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > -ECART && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > Math.min(a.height, c.height) / 2))
    : p.coeurs.some((a) => q.coeurs.some((c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > .5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > .5)))
  for (let i = 0; i < feuilles.length; i++) for (let j = i + 1; j < feuilles.length; j++) {
    const p = feuilles[i], q = feuilles[j]
    const porte = (f, g) => f.e.contains(g.e) && g.e.closest('[data-dessus]') === f.e.closest('[data-dessus]')
    if (porte(p, q) || porte(q, p) || !p.e.closest('[data-surcouche]') !== !q.e.closest('[data-surcouche]') || !croisent(p, q)) continue
    const dessus = (f, g) => f.e.closest('[data-dessus]') && !g.e.closest('[data-dessus]') && couvrable(g.e, g.texte, f.e.closest('[data-dessus]'))
    if (!dessus(p, q) && !dessus(q, p)) chevauche.add(nomme(p.e) + ' x ' + nomme(q.e).replace(/^[^:]*: /, ''))
  }
  /* une pièce fixe hors du rect de sa ligne de la table (`CADRE_ATTENDU`, `rendu.js`), ou sans ligne ; une ligne de deux
     cotes ne fixe que la place */
  const bouge = globalThis.CADRE_ATTENDU ? [...document.querySelectorAll('[data-piece]')].filter((e) => !e.closest('[data-mobile]')).flatMap((e) => {
    const t = globalThis.CADRE_ATTENDU(e.dataset.piece), r = e.getBoundingClientRect(), n = (q) => ['x', 'y', 'width', 'height'].filter((k) => q[k] !== undefined).map((k) => Math.round(q[k])).join(',')
    if (!t) return [`${e.dataset.piece} : hors table`]
    return Object.keys(t).some((k) => Math.abs(r[k] - t[k]) > 1) ? [`${e.dataset.piece} : ${n(r)} au lieu de ${n(t)}`] : []
  }) : []
  /* une place hors du rect de sa ligne de la table des places (`PLACE_ATTENDUE`, `rendu.js`), ou sans ligne */
  const places = globalThis.PLACE_ATTENDUE ? [...document.querySelectorAll('[data-place]')].filter((e) => !e.closest('[data-mobile]')).flatMap((e) => {
    const t = globalThis.PLACE_ATTENDUE(e), r = e.getBoundingClientRect(), n = (q) => ['x', 'y', 'width', 'height'].map((k) => Math.round(q[k])).join(',')
    if (!t) return [`${e.dataset.place} : hors table`]
    return Object.keys(t).some((k) => Math.abs(r[k] - t[k]) > 1) ? [`${e.dataset.place} : ${n(r)} au lieu de ${n(t)}`] : []
  }) : []
  /* l'habillage d'un cadre : son fond, qui remplit sa boîte intérieure, et la place de ses clous, ferrures et ruban,
     depuis son coin ; `habille` (plus bas) compare la signature d'un rôle d'un état à l'autre */
  const habillage = Object.fromEntries([...document.querySelectorAll('.cadre[data-piece]')].filter((e) => !e.closest('[data-mobile]')).map((e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e), f = e.querySelector(':scope > .fond')?.getBoundingClientRect()
    const de = (q) => [q.left - r.left, q.top - r.top, q.width, q.height].map((v) => Math.round(v * 2) / 2).join(',')
    const decale = f && [f.left - r.left - parseFloat(s.paddingLeft), f.top - r.top - parseFloat(s.paddingTop), r.right - f.right - parseFloat(s.paddingRight), r.bottom - f.bottom - parseFloat(s.paddingBottom)].some((v) => Math.abs(v) > .5)
    return [e.dataset.piece, { decale, signature: [f ? de(f) : '-', ...[...e.querySelectorAll(':scope > .clou, :scope > .ferrure')].map((c) => de(c.getBoundingClientRect())), ...[...e.querySelectorAll(':scope > .ruban')].map((c) => de(c.getBoundingClientRect()).split(',')[1])].join(' ') }]
  }))
  /* une pièce du kit qui rétrécit (`../kit.md`, « Une pièce du kit ne rétrécit jamais ») : un élément dont la règle de
     feuille qui l'emporte (ou son style en ligne) fixe la largeur ou la hauteur en pixels, rendu plus petit (sous un
     `flex` qui l'écrase) ; `bouge` ne mesure que la boîte de la pièce, pas ce qu'elle porte */
  const specificite = (sel) => [(sel.match(/#[\w-]+/g) ?? []).length, (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length, (sel.replace(/:[\w-]+(\([^)]*\))?|\[[^\]]+\]|[#.][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length]
  const plusFort = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
  const regles = [...document.styleSheets].flatMap((f) => { try { return [...f.cssRules] } catch { return [] } })
    .filter((r) => r.style && (r.style.width || r.style.height))
  const retrecit = [...document.querySelectorAll('#ui *')].filter((e) => e instanceof HTMLElement && e.checkVisibility()).flatMap((e) => {
    const fixe = {}
    for (const dim of ['width', 'height']) {
      let tenue = null
      regles.forEach((r, k) => {
        if (!r.style[dim]) return
        const sel = r.selectorText.split(',').map((x) => x.trim()).filter((x) => { try { return e.matches(x) } catch { return false } })
        if (!sel.length) return
        const p = [...sel.map(specificite).sort((a, b) => plusFort(b, a))[0], k]
        if (!tenue || plusFort(p, tenue.p) > 0 || (plusFort(p, tenue.p) === 0 && k > tenue.p[3])) tenue = { p, v: r.style[dim] }
      })
      const v = e.style[dim] || tenue?.v
      if (v && /^[\d.]+px$/.test(v)) fixe[dim] = parseFloat(v)
    }
    const s = getComputedStyle(e)
    const ecrase = Object.entries(fixe).filter(([dim, v]) => parseFloat(s[dim]) < v - 1)
    return ecrase.length ? [`${nomme(e)} : ${ecrase.map(([dim, v]) => `${dim} ${Math.round(parseFloat(s[dim]))} au lieu de ${v}`).join(', ')}`] : []
  })
  /* une action principale (plaque armée) ou l'étape en cours (`.en-cours`) hors de ce que montre le `data-defile` qui la
     porte : sous son bord, ou sous le fondu (`--fondu`, `gestes.css`) qui annonce une suite (`.suite`) ou ce qui a défilé
     (`.avant`) */
  const caches = [...document.querySelectorAll('#ui [data-defile] :is(.plaque.armee, .en-cours)')].filter((e) => {
    const d = e.closest('[data-defile]'), r = d.getBoundingClientRect(), q = e.getBoundingClientRect()
    const fondu = parseFloat(getComputedStyle(d).getPropertyValue('--fondu')) || 0
    return q.top < r.top + (d.classList.contains('avant') ? fondu : 0) - 1 || q.bottom > r.bottom - (d.classList.contains('suite') ? fondu : 0) + 1
  }).map(nomme)
  /* une seule croix par écran (`../dispositions.md`, arbitrage 2) : plus d'une croix visible, hors de ce qui suit ce
     qu'il désigne */
  const croixVues = [...document.querySelectorAll('#ui .croix')].filter((e) => !e.closest('[data-mobile]') && e.checkVisibility())
  const croix = croixVues.length > 1 ? [`${croixVues.length} croix : ${croixVues.map((e) => e.closest('[data-piece]')?.dataset.piece ?? '-').join(', ')}`] : []
  /* le contenu des places (`contenu`, `contenus.mjs`) : le rect de chaque enfant visible d'une place (`data-place`), ou
     du fond d'une pièce qui n'en a aucune, depuis le coin de ce qui le porte, sous la clé porteur + rôle (sa pièce, sa
     place, sa première classe et son `data-texte`, le rang parmi ceux du même rôle), marqué `texte` quand il porte du texte et que rien
     en lui n'est autre qu'en ligne (`inline`, `inline-block`, `inline-flex`) ; les entrées de ce qui y défile (`data-defile`) en une seule liste sous la clé porteur +
     rôle du défilant + `*` : le départ de la première depuis le haut du contenu défilé, leurs x et l'écart de chacune à
     la précédente, jamais leur rang */
  const role = (d) => d.dataset.piece ?? d.dataset.place ?? `${d.tagName.toLowerCase()}${d.classList[0] ? '.' + d.classList[0] : ''}${d.dataset.texte ? `[${d.dataset.texte}]` : ''}`
  const contenus = {}
  const poser = (cle, valeur) => { let k = 1; while (contenus[`${cle}${k > 1 ? ' #' + k : ''}`]) k++; contenus[`${cle}${k > 1 ? ' #' + k : ''}`] = valeur }
  for (const e of document.querySelectorAll('#ui [data-piece]')) {
    const propres = [...e.querySelectorAll('[data-place]')].filter((p) => p.closest('[data-piece]') === e)
    for (const [nom, porteur] of propres.length ? propres.map((p) => [`${e.dataset.piece} > ${p.dataset.place}`, p]) : [[e.dataset.piece, e.querySelector(':scope > .fond') ?? e]]) {
      const o = porteur.getBoundingClientRect()
      const vus = (parent) => [...parent.children].filter((d) => d.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      const texte = (d) => d.textContent.trim() !== '' && [...d.querySelectorAll('*')].every((x) => getComputedStyle(x).display.startsWith('inline'))
      for (const d of vus(porteur)) {
        const q = d.getBoundingClientRect()
        poser(`${nom} | ${role(d)}`, { rect: [q.left - o.left, q.top - o.top, q.width, q.height].map(Math.round), porteur: [o.left, o.top, o.width, o.height].map(Math.round), texte: texte(d) })
      }
      porteur.querySelectorAll('[data-defile]').forEach((d) => {
        if (d.closest('[data-place], [data-piece]') !== porteur.closest('[data-place], [data-piece]')) return
        const r = d.getBoundingClientRect(), entrees = vus(d).map((e) => e.getBoundingClientRect())
        if (!entrees.length) return
        const uniques = (v) => [...new Set(v.map(Math.round))].sort((m, n) => m - n)
        poser(`${nom} | ${role(d)} > *`, { liste: { depart: Math.round(entrees[0].top - r.top + d.scrollTop), x: uniques(entrees.map((q) => q.left - r.left)), ecarts: uniques(entrees.slice(1).map((q, k) => q.top - entrees[k].bottom)), n: entrees.length } })
      })
    }
  }
  return { pieces: pieces.length, hors, croix, croise, deborde, coupe, bouge, place: places, habillage, recouvert, rogne: rognes, chevauche: [...chevauche], cache: caches, retrecit, contenus, defile: document.documentElement.scrollWidth > largeur || document.documentElement.scrollHeight > hauteur }
}

const [, , cible, png, ...reste] = process.argv
const option = (nom) => (reste.includes(nom) ? reste[reste.indexOf(nom) + 1] : undefined)
const page = cible.endsWith('.html')
const format = page ? { ...FORMATS['16:9'], facteur: Number(reste[0] ?? FORMATS['16:9'].facteur) } : FORMATS[option('--format')]
if (!format) throw new Error(`rendre.mjs <écran> <sortie.png> --format ${Object.keys(FORMATS).join('|')} [--etat <état>]`)
const etat = option('--etat')
const etats = page ? null : await chargerLEcran(cible, etat)
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] })
/** Le dossier du relevé `contenu` (`RELEVE_CONTENUS`), un fichier par état, que `contenus.mjs` agrège. */
const CONTENUS = process.env.RELEVE_CONTENUS
if (CONTENUS) mkdirSync(CONTENUS, { recursive: true })
/** Le premier relevé de chaque contenu d'un gabarit de `PILOTES` (gabarit | porteur | rôle), et son état, que `contenu`
 * compare aux suivants : ceux des autres écrans déjà écrits sous `RELEVE_CONTENUS`, puis ceux de cette passe. */
const REFERENCES = new Map()
const referencer = (gabarit, contenus, etat) => { for (const [cle, valeur] of Object.entries(contenus)) if (!REFERENCES.has(`${gabarit} | ${cle}`)) REFERENCES.set(`${gabarit} | ${cle}`, { valeur, etat }) }
if (CONTENUS) for (const f of readdirSync(CONTENUS).filter((f) => f.endsWith('.json') && !f.startsWith(`${cible}--`)).sort()) {
  const { ecran, etat: e, gabarit, contenus } = JSON.parse(readFileSync(join(CONTENUS, f), 'utf8'))
  if (PILOTES.has(gabarit)) referencer(gabarit, contenus, `${ecran}/${e}`)
}
/** La signature d'habillage de chaque rôle, au premier état rendu qui le porte, que `habille` compare aux suivants. */
const HABILLAGES = new Map()
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
  const { habillage, contenus, ...rapport } = await p.evaluate(releve, [format.largeur, format.hauteur])
  if (CONTENUS && maquette) writeFileSync(join(CONTENUS, `${cible}--${maquette.nom}.json`), JSON.stringify({ ecran: cible, etat: maquette.nom, gabarit: maquette.gabarit, contenus }))
  rapport.contenu = maquette && PILOTES.has(maquette.gabarit) ? Object.entries(contenus).flatMap(([cle, valeur]) => {
    const ref = REFERENCES.get(`${maquette.gabarit} | ${cle}`)
    return ref && classe(ref.valeur, valeur) === 'A' ? [`${cle} : autre qu'à ${ref.etat}`] : []
  }) : []
  if (maquette && PILOTES.has(maquette.gabarit)) referencer(maquette.gabarit, contenus, `${cible}/${maquette.nom}`)
  rapport.habille = Object.entries(habillage).flatMap(([piece, { decale, signature }]) => {
    if (!HABILLAGES.has(piece)) HABILLAGES.set(piece, { signature, etat: maquette?.nom ?? cible })
    const ref = HABILLAGES.get(piece)
    return [...(decale ? [`${piece} : fond hors de sa boîte`] : []), ...(ref.signature === signature ? [] : [`${piece} : habillage autre qu'à ${ref.etat}`])]
  })
  await p.screenshot({ path: sortie, clip: { x: 0, y: 0, width: format.largeur, height: format.hauteur } })
  console.log(`${maquette?.nom ?? cible} erreurs`, erreurs.length, erreurs.slice(0, 5).join(' | '))
  console.log(JSON.stringify(rendu ? { ...rapport, ...rendu } : rapport))
  await p.close()
}
if (page) await capturer(null, png)
else for (const m of etats) await capturer(m, etat === undefined ? png.replace(/\.png$/, `-${m.nom}.png`) : png)
await b.close()
