// Le PARSEUR des trois couches CSS (#1800, `node --test` — joué par `npm run test:hooks`) : ce qu'il
// rend, et ce qu'il refuse d'abriter ; puis la FRONTIÈRE (#1806 L1), le FRANCHISSEMENT (D1″), la
// VENTILATION d'un commit contre son parent (D6″) et l'ADMISSION du RETOURNÉ par la régénération (C). Chaque cas est
// une fixture de texte, sauf les trois commits cibles, lus dans l'HISTOIRE du dépôt par le vrai chemin
// (`ventilationDeGit`) : la CI les porte (`fetch-depth: 0` du checkout de chaque job de
// .github/workflows/ci.yml). La MESURE sur le corpus réel se prouve ailleurs
// (`src/ui/ui-ratchets.test.ts`, cliquets (xxi)/(xxii)).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  admisAuRetour, CHEMIN_COUCHES, declarations, decoupeSelecteurs, estPlacement, FEUILLE_LAYOUT,
  FEUILLES_PARTAGEES, feuillesPartageesDe, fichiersReutilises, ligneDeVentilation, manifesteDe,
  moduleHorsCouche, modulesExemptes, partitionCss, physique, reglesCss, valeurHorsEchelle, ventiler,
} from './cssCouches.mjs'
import { regenerations } from './cssCouchesAudit.ts'
import { CHEMIN_STOCK_CSS, COLLECTIONS_VENTILEES, ventilationDeGit } from './cssImages.mjs'
import { croissanceDesStocks } from './stocksNominatifs.mjs'
import { refusDeCroissance, sitesEnEntrees } from './stock.mjs'
import { FORMAT_MJS, texteRegenere } from './stockDeSites.mjs'

test('reglesCss : règle de premier niveau — sélecteurs séparés, corps rendu, media nul', () => {
  assert.deepEqual(reglesCss('.a, .b > .c { color: red; gap: 4px }'), [
    { selecteurs: ['.a', '.b > .c'], corps: ' color: red; gap: 4px ', media: null },
  ])
})

test('reglesCss : blocs IMBRIQUÉS — le contexte at-rule est empilé, rendu, et n’abrite rien', () => {
  const regles = reglesCss('@media (a) { @supports (b) { .x { color: red } } } @keyframes k { from { color: red } }')
  assert.equal(regles.length, 1)
  assert.deepEqual(regles[0].selecteurs, ['.x'])
  assert.equal(regles[0].media, '@media (a) && @supports (b)')
})

test('reglesCss : @keyframes / @font-face sautés en BLOC (leur corps n’est pas fait de sélecteurs)', () => {
  assert.deepEqual(
    reglesCss('@keyframes p { 0%, 100% { opacity: 0.5 } 50% { opacity: 1 } } .z { color: red }'),
    [{ selecteurs: ['.z'], corps: ' color: red ', media: null }],
  )
  assert.deepEqual(reglesCss('@font-face { font-family: X; src: url(a.woff) }'), [])
})

test('reglesCss : un commentaire ne déclare rien, un prélude at-rule n’est jamais un sélecteur', () => {
  assert.deepEqual(reglesCss('/* .faux { color: red } */ .vrai { gap: 0 }').map((r) => r.selecteurs), [['.vrai']])
  assert.deepEqual(reglesCss('@media (max-width: 700px) { .x { gap: 0 } }')[0].selecteurs, ['.x'])
})

test('reglesCss : une at-rule DÉCLARATION se clôt sur son `;` et ne colle pas à la règle suivante', () => {
  const apresImport = reglesCss('@import "a.css"; .x { color: red }')
  assert.deepEqual(apresImport, [{ selecteurs: ['.x'], corps: ' color: red ', media: null }])
  const apresCharset = reglesCss('@charset "u"; @media (max-width:700px) { .x { color: red } }')
  assert.equal(apresCharset.length, 1)
  assert.equal(apresCharset[0].media, '@media (max-width:700px)')
})

test('reglesCss : une accolade CITÉE dans une valeur ne ferme pas le bloc', () => {
  assert.deepEqual(reglesCss(".a::after { content: '}' } .b { color: red }").map((r) => r.selecteurs), [['.a::after'], ['.b']])
})

test('declarations : sépare sur les `;` de premier niveau seulement', () => {
  assert.deepEqual(declarations('padding: 0 max(12px, env(safe-area-inset-left)); color: red;'), [
    { prop: 'padding', valeur: '0 max(12px, env(safe-area-inset-left))' },
    { prop: 'color', valeur: 'red' },
  ])
  assert.deepEqual(declarations('  ;  '), [])
})

test('estPlacement : les propriétés nommées et les familles à préfixe placent, tout le reste PEINT', () => {
  const MOT_CLE_CSS = 'initial'
  for (const p of ['display', 'flex', 'flex-direction', 'grid-template-columns', 'gap', 'padding-left',
    'margin-inline-start', 'min-width', 'max-height', 'overflow-y', 'position', 'z-index', 'text-align',
    'white-space', 'list-style', 'touch-action', 'user-select', 'transform', '--ma-var',
    'contain', 'container', 'container-type', 'container-name',
    'column-count', 'column-width', 'column-span', 'column-fill', 'column-gap',
    'list-style-type', 'list-style-position']) {
    assert.equal(estPlacement(p, MOT_CLE_CSS), true, `${p} PLACE`)
  }
  for (const p of ['color', 'background', 'border', 'border-color', 'border-radius', 'box-shadow',
    'font-size', 'font-weight', 'opacity', 'cursor', 'transition', 'filter', 'line-height',
    'column-rule', 'column-rule-color', 'column-rule-style', 'column-rule-width', 'list-style-image']) {
    assert.equal(estPlacement(p, MOT_CLE_CSS), false, `${p} PEINT`)
  }
})

test('estPlacement : un PORTEUR d’image (`list-style`, `list-style-type`) peint dès que sa valeur APPELLE une fonction autre que `symbols()` — `var()` compris ; une chaîne reste le marqueur, qui place', () => {
  for (const v of ['none', 'disc inside', 'square outside', 'decimal', 'none !important', ' inherit ', '"→"', 'none /* puce (x) */', "'(' inside",
    "symbols(cyclic '*')", "SYMBOLS(fixed '◆' '◇') inside"]) {
    assert.equal(estPlacement('list-style', v), true, `list-style: ${v}`)
    assert.equal(estPlacement('list-style', v), estPlacement('list-style-type', v), `list-style: ${v} se classe comme son membre list-style-type`)
  }
  for (const v of ['url(puce.svg)', 'disc url("x.png") inside', 'linear-gradient(red, blue)', 'image-set("a.png" 1x)',
    'var(--puce)', 'disc var(--img)', 'paint(puce)', '-webkit-gradient(linear, 0 0, 0 100%)', 'URL(a.png)',
    'symbols(cyclic url(etoile.svg))', "symbols(fixed '*' var(--img))", 'none /* ( ']) {
    assert.equal(estPlacement('list-style', v), false, `list-style: ${v} PEINT`)
    assert.equal(estPlacement('list-style', v), estPlacement('list-style-type', v), `list-style-type: ${v} peint comme le raccourci`)
  }
  assert.equal(estPlacement('list-style-image', 'none'), false, 'le membre qui peint reste de l’identité, valeur comprise')
  for (const [p, v] of [['columns', '2 200px'], ['flex', '1 1 0'], ['grid', 'auto / 1fr 1fr'], ['overflow', 'var(--o)']]) {
    assert.equal(estPlacement(p, v), true, `${p}: ${v} — aucun membre ne peint`)
  }
})

test('physique : une propriété LOGIQUE se classe comme son équivalent physique', () => {
  const PAIRES = [
    ['block-size', 'height'], ['inline-size', 'width'], ['min-block-size', 'min-height'], ['max-inline-size', 'max-width'],
    ['inset-block-start', 'top'], ['inset-block-end', 'bottom'], ['inset-inline-start', 'left'], ['inset-inline-end', 'right'],
    ['inset-block', 'top'], ['margin-inline', 'margin-left'], ['margin-block-end', 'margin-bottom'],
    ['padding-inline-end', 'padding-right'], ['scroll-padding-inline-start', 'scroll-padding-left'],
    ['overflow-inline', 'overflow-x'], ['overscroll-behavior-block', 'overscroll-behavior-y'], ['border-inline-start-color', 'border-left-color'], ['border-block', 'border-top'],
    ['border-start-start-radius', 'border-top-left-radius'], ['width', 'width'],
  ]
  for (const [logique, attendu] of PAIRES) assert.equal(physique(logique), attendu, logique)
  for (const [logique, equivalent] of PAIRES) {
    assert.equal(estPlacement(logique, 'initial'), estPlacement(equivalent, 'initial'), `${logique} se classe comme ${equivalent}`)
  }
  for (const p of ['block-size', 'inline-size', 'inset-inline-end', 'margin-block']) assert.equal(estPlacement(p, 'initial'), true, `${p} PLACE`)
  for (const p of ['border-inline-color', 'border-block-start-width']) assert.equal(estPlacement(p, 'initial'), false, `${p} PEINT`)
})

test('valeurHorsEchelle : un littéral de longueur NON NUL, et rien d’autre', () => {
  for (const v of ['10px', '0 10px', '1.5rem', '0 max(12px, env(safe-area-inset-left))', '8px 10px']) {
    assert.equal(valeurHorsEchelle(v), true, v)
  }
  for (const v of ['0', 'auto', '0 auto', 'var(--sp-md)', 'calc(3 * var(--sp-md))', '50%', '2vw', '0px']) {
    assert.equal(valeurHorsEchelle(v), false, v)
  }
})

test('reglesCss : une virgule DANS `:has()`/`:is()` ne coupe pas la liste (#1806)', () => {
  const regles = reglesCss('label:has(> a, > .btn) { color: red }')
  assert.deepEqual(regles[0].selecteurs, ['label:has(> a, > .btn)'])
  // Les virgules de NIVEAU 0 séparent toujours, y compris autour d'un sélecteur à parenthèses.
  assert.deepEqual(reglesCss('.a:is(.x, .y), .b[data-k="1,2"] { color: red }')[0].selecteurs, [
    '.a:is(.x, .y)',
    '.b[data-k="1,2"]',
  ])
})

test('decoupeSelecteurs : niveau 0 seulement, espaces réduits, vides écartés', () => {
  assert.deepEqual(decoupeSelecteurs('  .a ,  .b:not(.c, .d) , '), ['.a', '.b:not(.c, .d)'])
})

test('moduleHorsCouche : `src/ui/styles/`, ou la zone du `fichier` hors de `src/ui` (#1806 A3)', () => {
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/styles/roll-shell.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.css'), false)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/ui/styles/hud.css'), false)
  // Une primitive de `src/ui` ne colocalise pas sa feuille ; une autre ne sort pas de SA zone.
  assert.equal(moduleHorsCouche('src/ui/RollShell.tsx', 'src/ui/RollShell.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/state/anim.css'), true)
  assert.equal(moduleHorsCouche('src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/anim.ts'), true)
})

// ── Partition et ventilation (#1806) ─────────────────────────────────────────────────────────────

const ECRAN = 'src/ui/styles/ecran.css'
const PRIMITIVE = 'src/ui/styles/prim.css'

/** Image fixture : `feuilles` = `{ chemin: texte }` (`null` = absent), `exemptes` = les modules d'une
 *  primitive RÉUTILISÉE. */
const image = (feuilles, ...exemptes) => ({
  fichiers: Object.entries(feuilles).filter(([, t]) => t != null).map(([rel, text]) => ({ rel, text })),
  manifeste: [{ id: 'sans-css' }, ...exemptes.map((css) => ({ id: css, fichier: `${css}.tsx`, css }))],
  partagees: [],
  reutilises: new Set(exemptes.map((css) => `${css}.tsx`)),
})

test('partition : écran et layout au stock (identité ET espacement), primitive réutilisée et partagée exemptées', () => {
  const p = partitionCss({
    ...image({
      [ECRAN]: '.e { color: red; gap: 3px }',
      [PRIMITIVE]: '.p { color: red; gap: 3px }',
      'src/ui/styles/base.css': '.b { color: red }',
      [FEUILLE_LAYOUT]: '.l { color: red; gap: 3px }',
    }, PRIMITIVE),
    partagees: FEUILLES_PARTAGEES,
  })
  assert.deepEqual(p.stock.identite.map((s) => s.file), [ECRAN, FEUILLE_LAYOUT])
  assert.deepEqual(p.stock.espacement.map((s) => s.file), [ECRAN, FEUILLE_LAYOUT])
  assert.deepEqual(p.exempte.identite.map((s) => s.file), [PRIMITIVE, 'src/ui/styles/base.css'])
  assert.deepEqual(p.exempte.espacement.map((s) => s.file), [PRIMITIVE])
})

test('L1 : réutilisée = ≥ 2 importeurs de `src/` hors suites et galerie, ou le `fichier` d’une autre primitive', () => {
  const manifeste = [
    { id: 'a', fichier: 'src/ui/A.tsx', css: 'src/ui/styles/a.css' },
    { id: 'b', fichier: 'src/ui/B.tsx', css: 'src/ui/styles/b.css' },
    { id: 'c', fichier: 'src/ui/C.tsx', css: 'src/ui/styles/c.css' },
    { id: 'd', fichier: 'src/ui/D.tsx', css: 'src/ui/styles/d.css' },
  ]
  const imports = [
    ['src/ui/Ecran1.tsx', ['src/ui/A.tsx', 'src/ui/C.tsx']],
    ['src/ui/Ecran2.tsx', ['src/ui/A.tsx']],
    ['src/ui/A.tsx', ['src/ui/B.tsx']],
    ['src/ui/C.test.tsx', ['src/ui/C.tsx']],
    ['src/ui/gallery/Galerie.tsx', ['src/ui/C.tsx']],
    ['src/ui/D.tsx', ['src/ui/D.tsx']],
    ['scripts/outil.mjs', ['src/ui/D.tsx']],
    ['src/ui/Ecran3.tsx', ['src/ui/D.tsx']],
  ]
  const reutilises = fichiersReutilises(manifeste, imports)
  assert.deepEqual([...reutilises].sort(), ['src/ui/A.tsx', 'src/ui/B.tsx'])
  assert.deepEqual(
    [...modulesExemptes({ manifeste, partagees: FEUILLES_PARTAGEES, reutilises })].sort(),
    ['src/ui/styles/a.css', 'src/ui/styles/b.css', 'src/ui/styles/base.css', 'src/ui/styles/components.css', 'src/ui/styles/tabs.css'],
    'C : une suite et la galerie ne comptent pas ; D : ni lui-même, ni hors `src/`, un seul hôte ; layout reste au stock',
  )
})

/** Un volet ventilé, réduit à ses six nombres. */
const six = ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE }) => ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE })
/** Les deux invariants de D6″, sur un volet. */
const invariants = (nom, v) => {
  assert.equal(v.stock[1] - v.stock[0], v.APPARU + v.RETOURNE - v.SORTI, `${nom} : Δstock = APPARU + RETOURNÉ − SORTI`)
  assert.equal(v.SORTI, v.RECLASSE + v.PRIMITIVISE + v.DISPARU, `${nom} : SORTI = RECLASSÉ + PRIMITIVISÉ + DISPARU`)
  for (const [k, n] of Object.entries(six(v))) assert.ok(n >= 0, `${nom} : ${k} ≥ 0`)
}

const Q = 'src/ui/styles/ecran-q.css'
const X = 'src/ui/styles/ecran-x.css'
const P = 'src/ui/styles/prim-p.css'
const E = 'src/ui/styles/prim-e.css'
const Y = 'src/ui/styles/ecran-y.css'
const S = 'src/ui/styles/stub.css'
const CSS = '.e { color: red; border: 0; font-size: 3px; gap: 3px }'
const CSS2 = `${CSS}\n.f { color: blue; border: 1px; font-size: 4px; gap: 4px }`
const REINDENTE = CSS2.split('\n').map((l) => `\t${l}`).join('\n')
const STUB = '.s { color: blue }'

/** S1-S12 (sonde `j6-final.mjs` du juge, 2026-09-23) : `[nom, parent, commit, franchis, identité, espacement]`,
 *  un volet = `[SORTI, RECLASSÉ, PRIMITIVISÉ, DISPARU, APPARU, RETOURNÉ]`, RETOURNÉ nul s'il est omis. */
const CAS = [
  ['S1 Q franchit, X +4', image({ [Q]: CSS, [X]: CSS }), image({ [Q]: CSS, [X]: CSS2 }, Q), [[Q, 4]], [3, 3, 0, 0, 3], [1, 1, 0, 0, 1]],
  ['S2 P fraîche + Q franchit', image({ [Q]: CSS }), image({ [Q]: CSS, [P]: CSS }, Q, P), [[Q, 4]], [3, 3, 0, 0, 0], [1, 1, 0, 0, 0]],
  ['S3 cure Y→E établie + P fraîche', image({ [E]: CSS, [Y]: CSS }, E), image({ [E]: CSS2, [Y]: '', [P]: CSS }, E, P), [], [3, 0, 3, 0, 0], [1, 0, 1, 0, 0]],
  ['S4 X +4 après un franchissement de Q', image({ [Q]: CSS, [X]: CSS }, Q), image({ [Q]: CSS, [X]: CSS2 }, Q), [], [0, 0, 0, 0, 3], [0, 0, 0, 0, 1]],
  ['S5 E rendue exemptée', image({ [E]: CSS2, [Y]: '' }), image({ [E]: CSS2, [Y]: '' }, E), [[E, 8]], [6, 6, 0, 0, 0], [2, 2, 0, 0, 0]],
  ['S6 souche MONO-hôte', image({ [Y]: CSS, [S]: STUB }), image({ [S]: `${STUB}\n${CSS}` }), [], [3, 0, 0, 3, 3], [1, 0, 0, 1, 1]],
  ['S6 souche RÉUTILISÉE', image({ [Y]: CSS, [S]: STUB }, S), image({ [S]: `${STUB}\n${CSS}` }, S), [], [3, 0, 3, 0, 0], [1, 0, 1, 0, 0]],
  ['S7 échange E↔Q', image({ [E]: CSS, [Q]: CSS }, E), image({ [E]: CSS, [Q]: CSS }, Q), [[Q, 4]], [3, 3, 0, 0, 0, 3], [1, 1, 0, 0, 0, 1]],
  ['S8 mv Y→P retouché, P réutilisée', image({ [Y]: CSS2 }), image({ [P]: `${CSS}\n.g { gap: var(--sp-md) }` }, P), [], [6, 0, 3, 3, 0], [2, 0, 1, 1, 0]],
  ['S9 franchit et cure au même commit', image({ [Q]: CSS2 }), image({ [Q]: `${CSS}\n.f { gap: var(--sp-md) }` }, Q), [[Q, 4]], [6, 3, 0, 3, 0], [2, 1, 0, 1, 0]],
  ['S10 mv réindenté, P mono-hôte', image({ [Y]: CSS2 }), image({ [P]: REINDENTE }), [], [6, 0, 0, 6, 6], [2, 0, 0, 2, 2]],
  ['S10 mv réindenté, P réutilisée', image({ [Y]: CSS2 }), image({ [P]: REINDENTE }, P), [], [6, 0, 6, 0, 0], [2, 0, 2, 0, 0]],
  ['S11 composant gagne son 2e importeur', image({ [P]: CSS }), image({ [P]: CSS }, P), [[P, 4]], [3, 3, 0, 0, 0], [1, 1, 0, 0, 0]],
  ['S12 composant perd son 2e importeur', image({ [P]: CSS }, P), image({ [P]: CSS }), [], [0, 0, 0, 0, 0, 3], [0, 0, 0, 0, 0, 1]],
]
const volet = ([SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE = 0]) => ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE })

for (const [nom, parent, commit, franchis, identite, espacement] of CAS) {
  test(`D1″/D6″ ${nom}`, () => {
    const v = ventiler(parent, commit)
    assert.deepEqual(v.franchis.map((f) => [f.module, f.n]), franchis)
    assert.deepEqual(six(v.identite), volet(identite))
    assert.deepEqual(six(v.espacement), volet(espacement))
    invariants('identité', v.identite)
    invariants('espacement', v.espacement)
  })
}

test('D1″ : un module ABSENT du parent ne franchit pas — il naît exempté, sa matière est APPARUE en zone exempte', () => {
  const v = ventiler(image({}), image({ [P]: CSS }, P))
  assert.deepEqual(v.franchis, [])
  assert.deepEqual([six(v.identite), v.identite.ENTRE], [volet([0, 0, 0, 0, 0]), 3])
})

test('D5″ : un renommage entre deux modules AU STOCK reporte les clés du parent — rien ne sort, rien n’apparaît', () => {
  const renommages = new Map([[Y, X]])
  const v = ventiler(image({ [Y]: CSS2 }), image({ [X]: CSS2 }), { renommages })
  assert.deepEqual([six(v.identite), six(v.espacement)], [volet([0, 0, 0, 0, 0]), volet([0, 0, 0, 0, 0])])
  const sansCarte = ventiler(image({ [Y]: CSS2 }), image({ [X]: CSS2 }))
  assert.deepEqual(six(sansCarte.identite), volet([6, 0, 0, 6, 6]), 'témoin : sans la carte, la dette change de fichier')
  const versLaZone = ventiler(image({ [Y]: CSS2 }), image({ [P]: CSS2 }, P), { renommages: new Map([[Y, P]]) })
  assert.deepEqual(versLaZone.franchis, [], 'un couple qui touche la zone exempte n’est pas reporté : P ne franchit pas')
  assert.deepEqual(six(versLaZone.identite), volet([6, 0, 6, 0, 0]))
})

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
/** Les chiffres signés du juge (commentaire #1806 5803399612, 2026-09-23) ; RETOURNÉ mesuré sur le
 *  stock ÉCRIT au parent, que la règle de réutilisation (L1) rend en partie au stock. */
const ATTENDU = {
  '41aa406d5': [[19, 0, 0, 19, 3, 227], [0, 0, 0, 0, 0, 77]],
  'd25652e73': [[21, 0, 0, 21, 0, 450], [3, 0, 0, 3, 0, 133]],
  'c251f46af': [[352, 0, 158, 194, 111, 0], [122, 0, 48, 74, 38, 0]],
}
for (const [sha, [identite, espacement]] of Object.entries(ATTENDU)) {
  test(`D6″ commit cible ${sha}, lu dans l'histoire : aucun franchissement, la ventilation signée`, () => {
    const v = ventilationDeGit({ cwd: RACINE, base: `${sha}^`, tete: sha })
    assert.deepEqual(v.franchis.filter((f) => f.n > 0), [])
    assert.deepEqual(six(v.identite), volet(identite))
    assert.deepEqual(six(v.espacement), volet(espacement))
    invariants('identité', v.identite)
    invariants('espacement', v.espacement)
  })
}

/** Les entrées que compte le stock d'une image (ce que son régénérateur écrirait). */
const stockDe = (img) => {
  const { stock } = partitionCss(img)
  return { identite: sitesEnEntrees(stock.identite), espacement: sitesEnEntrees(stock.espacement) }
}
/** Le texte d'un stock écrit par son format (`FORMAT_MJS`, `stockDeSites.mjs`), une collection par volet. */
const texteDeStock = ({ identite, espacement }) => FORMAT_MJS.ecrire({
  chemin: CHEMIN_STOCK_CSS,
  horsCollections: ['export const I = ', '\nexport const E = ', '\n'],
  collections: new Map([['I', identite], ['E', espacement]]),
})

test('D (#1806) : sur un changement de frontière, Σ CLIQUET du stock CSS = APPARU + RETOURNÉ', () => {
  const parent = image({ [P]: CSS, [X]: CSS }, P)
  const commit = image({ [P]: CSS, [X]: CSS2 })
  const avant = stockDe(parent)
  const apres = stockDe(commit)
  const v = ventiler(parent, commit, { stockAvant: avant })
  assert.deepEqual([v.identite.APPARU, v.identite.RETOURNE, v.espacement.APPARU, v.espacement.RETOURNE], [3, 3, 1, 1])
  const pre = texteDeStock(avant).split('\n')
  const post = texteDeStock(apres).split('\n')
  assert.ok(pre.every((l) => post.includes(l)), 'le cas n’ajoute que des lignes : un hunk par ligne ajoutée suffit')
  const diff = [
    `diff --git a/${CHEMIN_STOCK_CSS} b/${CHEMIN_STOCK_CSS}`, `--- a/${CHEMIN_STOCK_CSS}`, `+++ b/${CHEMIN_STOCK_CSS}`,
    ...post.flatMap((l, i) => (pre.includes(l) ? [] : [`@@ -${i},0 +${i + 1} @@`, `+${l}`])),
  ].join('\n')
  const cliquet = croissanceDesStocks(diff, {
    lirePostImage: () => texteDeStock(apres),
    lirePreImage: () => texteDeStock(avant),
  }).reduce((t, c) => t + c.net, 0)
  assert.equal(cliquet, v.identite.APPARU + v.identite.RETOURNE + v.espacement.APPARU + v.espacement.RETOURNE)
})

test('C (#1806) : l\'admission rend au stock les sites que HEAD portait, et refuse un site NEUF du module qui quitte la zone', () => {
  const tete = image({ [P]: CSS, [X]: CSS }, P)
  const stockDeTete = stockDe(tete)
  const juge = (arbre) => {
    const v = ventiler(tete, arbre, { stockAvant: stockDeTete })
    const mesurees = stockDe(arbre).identite
    const admis = admisAuRetour(mesurees, stockDeTete.identite, v.identite.retournes)
    return refusDeCroissance(mesurees, [...stockDeTete.identite, ...admis], { nom: 'IDENTITE', motif: 'm' })
  }
  assert.equal(juge(image({ [P]: CSS, [X]: CSS })), null, 'témoin : P quitte la zone, ses sites de HEAD retournent')
  const refus = juge(image({ [P]: CSS2, [X]: CSS }))
  assert.ok(refus?.includes(`${P} :: .f :: color`), String(refus))
  assert.ok(!refus.includes(`${P} :: .e :: color`), refus)
})

test('C (#1806) : la régénération du stock CSS admet le RETOURNÉ, refuse un site NEUF, et ne lit la ventilation qu’au refus', () => {
  const tete = image({ [P]: CSS, [X]: CSS }, P)
  const stockDeTete = stockDe(tete)
  const enPlace = FORMAT_MJS.ecrire({
    chemin: CHEMIN_STOCK_CSS,
    horsCollections: [`export const ${COLLECTIONS_VENTILEES.identite} = `, `\nexport const ${COLLECTIONS_VENTILEES.espacement} = `, '\nexport const STYLE_INLINE_RATCHET = ', '\n'],
    collections: new Map([[COLLECTIONS_VENTILEES.identite, stockDeTete.identite], [COLLECTIONS_VENTILEES.espacement, stockDeTete.espacement], ['STYLE_INLINE_RATCHET', []]]),
  })
  const regenere = (arbre, inline = []) => {
    let lectures = 0
    const retour = () => {
      lectures++
      return { ...ventiler(tete, arbre, { stockAvant: stockDeTete }), stockAvant: stockDeTete }
    }
    const [r] = regenerations({ ...partitionCss(arbre).stock, inline }, retour)
    return { ...texteRegenere(r, { enPlace }), lectures }
  }
  const temoin = regenere(tete)
  assert.deepEqual([temoin.refus, temoin.texte === enPlace, temoin.lectures], [undefined, true, 0], 'témoin : point fixe, aucune lecture')
  const retourne = regenere(image({ [P]: CSS, [X]: CSS }))
  assert.equal(retourne.refus, undefined, String(retourne.refus))
  assert.ok(retourne.texte.includes(`fichier: '${P}', ref: '.e :: color'`), 'P quitte la zone : ses sites de HEAD entrent au stock')
  assert.equal(retourne.lectures, 1, 'une lecture pour les deux volets')
  const neuf = regenere(image({ [P]: CSS2, [X]: CSS }))
  assert.ok(neuf.refus?.includes(`${P} :: .f :: color`), String(neuf.refus))
  assert.ok(!neuf.refus.includes(`${P} :: .e :: color`), neuf.refus)
  const inline = regenere(tete, [{ file: 'src/ui/A.tsx', ref: 'div :: expr' }])
  assert.ok(inline.refus?.includes('STYLE_INLINE_RATCHET'), String(inline.refus))
  assert.equal(inline.lectures, 0, 'le volet inline n’admet aucun retour')
})

test('ligneDeVentilation : SORTI décomposé, puis APPARU et RETOURNÉ', () => {
  const v = ventiler(image({ [Q]: CSS, [X]: CSS }), image({ [Q]: CSS, [X]: CSS2 }, Q))
  assert.equal(
    ligneDeVentilation('identité', v.identite),
    'identité   stock 6 → 6 · exempté 0 → 3 · SORTI 3 = RECLASSÉ 3 + PRIMITIVISÉ 0 + DISPARU 0 · APPARU 3 · RETOURNÉ 0',
  )
})

test('feuillesPartageesDe : lit la liste dans le TEXTE de cssCouches.mjs ; absent → [] ; illisible → refus nommé', () => {
  const texte = readFileSync(new URL('./cssCouches.mjs', import.meta.url), 'utf8')
  assert.equal(CHEMIN_COUCHES, 'scripts/guards/lib/cssCouches.mjs')
  assert.deepEqual(feuillesPartageesDe(texte), [...FEUILLES_PARTAGEES])
  assert.deepEqual(feuillesPartageesDe(null), [])
  assert.throws(() => feuillesPartageesDe('export const AUTRE = []'), /FEUILLES_PARTAGEES/)
})

test('manifesteDe : UN lecteur — absent → [], JSON invalide ou non-tableau → refus nommé, jamais [] silencieux', () => {
  assert.deepEqual(manifesteDe(null), [])
  assert.deepEqual(manifesteDe('[{"id":"a"}]'), [{ id: 'a' }])
  assert.throws(() => manifesteDe('[{"id":'), /primitives\.manifest\.json/)
  assert.throws(() => manifesteDe('{"id":"a"}'), /primitives\.manifest\.json/)
})

