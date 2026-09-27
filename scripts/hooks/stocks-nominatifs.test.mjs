// PORTE A POSTERIORI (node --test, sans réseau) — un STOCK NOMINATIF qui naît ou grandit dans la
// PLAGE POUSSÉE sans que le message de son commit le dise.
//
// Le garde `solde-ticket-guard` pose la même règle AU COMMIT, mais il vit dans le hook PreToolUse :
// un commit fait hors de ce canal (autre outil, autre machine, hook non installé) n'y passe pas.
// Cette mesure relit les commits une fois posés — même règle, mêmes libs (`stocksNominatifs.mjs`,
// `plageStock.mjs`), un seul endroit où elle est écrite. Lancée par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import {
  croissanceDesStocks, croissancesNonCouvertes, cliquetsDuMessage, entreesDeStock, estEntreeDeStock,
  estPorteurDeStock, raisonDeRefus,
} from '../guards/lib/stocksNominatifs.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage, SHA_NUL } from '../guards/lib/plageStock.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1e8 })

/** ARRÊT NOMMÉ sur un clone SUPERFICIEL : `git show HEAD` y rend un diff tronqué et la mesure
 *  dirait « rien à signaler » sur un commit qu'elle n'a pas lu (patron de
 *  `fermetures-sans-solde.test.mjs`). Jamais un `skip` vert. */
function exigerHistoireComplete() {
  assert.equal(
    git('rev-parse', '--is-shallow-repository').trim(), 'false',
    "dépôt SUPERFICIEL : cette mesure lit le DIFF du dernier commit — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.",
  )
}

/** La porte était-elle EN VIGUEUR dans le commit jugé ? (sa lib y est-elle ?) Une porte juge les
 *  commits qui la PORTENT ; condamner l'histoire d'avant serait un verdict rétroactif, et l'échapper
 *  par un stock de shas rendrait à cette porte le vice qu'elle combat. Rien à tenir à jour : la
 *  condition s'éteint d'elle-même dès le premier commit qui embarque la lib. */
function porteEnVigueur() {
  try {
    git('cat-file', '-e', 'HEAD:scripts/guards/lib/stocksNominatifs.mjs')
    return true
  } catch { return false }
}

/** Début de la plage à juger. En CI, l'événement de push le porte (`GITHUB_EVENT_PATH` → `before`) ;
 *  `origin/main` n'y a PAS de reflog, il ne peut donc pas servir de base. Sans événement lisible, la
 *  base reste nulle et `croissancesDeLaPlage` juge HEAD seul en le DISANT (jamais un silence). */
function debutDeLaPlage(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) return SHA_NUL
  try {
    const avant = String(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.before ?? '')
    return /^[0-9a-f]{40}$/.test(avant) && avant !== SHA_NUL ? avant : SHA_NUL
  } catch { return SHA_NUL }
}

// ── La règle, sur des diffs FABRIQUÉS (ce que la porte voit, et ce qu'elle ne voit pas) ──────────

/** Diff unifié minimal d'un fichier : `ajoutees`/`retirees` sont des lignes ENTIÈRES. */
const diffDe = (fichier, ajoutees = [], retirees = []) =>
  [
    `diff --git a/${fichier} b/${fichier}`,
    `--- a/${fichier}`,
    `+++ b/${fichier}`,
    '@@ -20,0 +21,1 @@',
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

/** Lecteur d'image qui rend `null` : la porte l'a, et le REPLI de ligne juge. C'est la voie que
 *  mesurent les diffs FABRIQUÉS ci-dessous, dont aucun fichier n'existe — un appel SANS lecteur,
 *  lui, est REFUSÉ (`croissanceDesStocks`, un compte sans image ment). */
const REPLI = { lirePostImage: () => null }

const ENTREE_A = "  'src/state/combatSlice.ts',"
const ENTREE_B = "  'src/ui/CampaignView.test.tsx // div',"
const ENTREE_CLE = "  'scripts/guards/lib/labelLogic.mjs': 'raison mesurée',"

test('périmètre — les porteurs de stock, et eux seuls', () => {
  assert.equal(estPorteurDeStock('src/state/flowtest-derived-stake.test.ts'), true)
  assert.equal(estPorteurDeStock('scripts/guards/lib/domResiduStock.mjs'), true)
  assert.equal(estPorteurDeStock('scripts/hooks/fermetures-sans-solde.test.mjs'), true)
  assert.equal(estPorteurDeStock('scripts/hooks/ecrans-ui.json'), true)
  assert.equal(estPorteurDeStock('scripts/raw/reconciliation-stock.json'), true, 'stock nominatif de l\'Atlas RAW (#1709 D2)')
  assert.equal(estPorteurDeStock('scripts/raw/empty-folios-perdues-stock.json'), true, 'ancres sans contenu PERDUES : porteur par son motif `scripts/raw/*-stock.json` (#1727 T2)')
  assert.equal(estPorteurDeStock('scripts/raw/empty-folios-benignes-stock.json'), true, 'et son pendant bénin — DEUX fichiers, pour qu\'un reclassement soit une croissance nette (#1727 T2)')
  assert.equal(estPorteurDeStock('scripts/guards/raw-blind-refs-stock.json'), true, 'stock nominatif tenu hors du dossier `raw/` par `rawRefIntegrity.mjs`')
  assert.equal(estPorteurDeStock('scripts/guards/lib/decisions-baseline.json'), true, 'stock NOMINATIF de sites du détecteur de commentaires')
  assert.equal(estPorteurDeStock('knip-exports-baseline.json'), true, 'gel d\'exports à clés-chemins, à la RACINE')
  assert.equal(estPorteurDeStock('src/state/combatFlow.ts'), false, 'un module de prod n\'est pas un stock')
  assert.equal(estPorteurDeStock('docs/architecture.md'), false)
})

/** Un JSON PORTE-T-IL un stock, lu sur sa STRUCTURE ? Deux formes, celles du dépôt : une racine
 *  d'objet dont TOUTE clé est un chemin de dépôt ; une liste d'entrées (`entrees`/`sites`/`trous`)
 *  dont au moins une nomme un `fichier`. Rien d'autre n'est réputé stock ici : la dérivation sert à
 *  NOMMER un porteur oublié, jamais à requalifier une donnée de jeu. */
function porteUnStockParSaForme(json) {
  const estChemin = (s) => /^(?:src|scripts|docs)\/[^\s]+\.(?:ts|tsx|mjs|mts|json|md|css)$/.test(s)
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false
  const cles = Object.keys(json)
  if (cles.length > 0 && cles.every(estChemin)) return true
  return ['entrees', 'sites', 'trous'].some((rubrique) => {
    const v = json[rubrique]
    const liste = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []
    return liste.some((e) => e && typeof e === 'object' && typeof e.fichier === 'string')
  })
}

// NON-VACUITÉ DÉRIVÉE du périmètre : la liste `PORTEURS` est écrite à la main, et un stock neuf
// posé hors de ses motifs sort MUET des deux portes (vécu : `decisions-baseline.json`, nominatif
// depuis son contrat, invisible jusqu'à #1711). Ce test confronte la liste à la FORME réelle des
// JSON suivis — un porteur oublié est nommé, avec le chemin à ajouter.
test('périmètre — tout JSON suivi dont la FORME est un stock tombe sous un motif de PORTEURS', () => {
  exigerHistoireComplete()
  const suivis = git('ls-files', '--cached', '--', '*.json').split('\n').map((l) => l.trim()).filter(Boolean)
  assert.ok(suivis.length > 0, 'aucun .json suivi listé — la dérivation jugerait vert par vacuité')
  const oublies = []
  let lus = 0
  for (const rel of suivis) {
    if (estPorteurDeStock(rel)) continue
    // `docs/.sources-lues.json` a la FORME d'un stock (clés = les générateurs, valeurs = ce qu'ils
    // lisent) et n'en est pas un : c'est un registre DÉRIVÉ, réécrit en entier à chaque
    // `docs:build` (`scripts/docs/lib/empreinte-sources.mjs`). Le rendre porteur ferait de chaque
    // régénération une croissance à déclarer — une dette ne se mesure pas sur un artefact généré.
    if (rel === 'docs/.sources-lues.json') continue
    let json
    try { json = JSON.parse(readFileSync(join(RACINE, rel), 'utf8')) } catch { continue }
    lus++
    if (porteUnStockParSaForme(json)) oublies.push(`${rel} — sa FORME est un stock nominatif, mais aucun motif de \`PORTEURS\` ne le couvre : les deux portes le laissent croître MUET.`)
  }
  assert.ok(lus > 0, 'aucun .json non porteur lu — la dérivation jugerait vert par vacuité')
  assert.deepEqual(oublies, [], oublies.join('\n'))
})

// ── BASELINES DE COMPTE (#1711 T1) : ce que le filet voit, et ce qu'il ne voit pas ───────────────

const BASELINE = 'knip-exports-baseline.json'
/** Diff d'UN fichier, lignes ajoutées/retirées données telles quelles, avec le numéro de la
 *  première ligne touchée : les images réelles sont fournies à côté, c'est elles qui font foi. */
const diffAuxLignes = (fichier, debut, ajoutees, retirees = []) =>
  [
    `diff --git a/${fichier} b/${fichier}`, `--- a/${fichier}`, `+++ b/${fichier}`,
    `@@ -${debut},${retirees.length} +${debut},${ajoutees.length} @@`,
    ...retirees.map((l) => `-${l}`), ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

test('baseline de compte — une CLÉ neuve est une croissance déclarable', () => {
  const avant = '{\n  "src/engine/ops.ts": 2,\n  "src/engine/combat.ts": 1\n}\n'
  const apres = '{\n  "src/engine/ops.ts": 2,\n  "src/x.ts": 3,\n  "src/engine/combat.ts": 1\n}\n'
  const r = croissanceDesStocks(
    diffAuxLignes(BASELINE, 3, ['  "src/x.ts": 3,']),
    { lirePostImage: () => apres, lirePreImage: () => avant },
  )
  assert.deepEqual(r.map((x) => x.fichier), [BASELINE], `${BASELINE} n'est plus vue comme porteuse : la clé neuve passe muette`)
  const [c] = r
  assert.deepEqual([c.ajoutees, c.retirees, c.net], [1, 0, 1])
  assert.deepEqual(c.exemples, ['"src/x.ts": 3,'])
})

test('baseline de compte — LIMITE dite : un NOMBRE relevé est invisible', () => {
  const avant = '{\n  "src/engine/ops.ts": 2,\n  "src/engine/combat.ts": 1\n}\n'
  const apres = '{\n  "src/engine/ops.ts": 3,\n  "src/engine/combat.ts": 1\n}\n'
  const r = croissanceDesStocks(
    diffAuxLignes(BASELINE, 2, ['  "src/engine/ops.ts": 3,'], ['  "src/engine/ops.ts": 2,']),
    { lirePostImage: () => apres, lirePreImage: () => avant },
  )
  assert.deepEqual(
    r, [],
    'limite de (a) : un nombre relevé est invisible, seule la forme nominative le déclare',
  )
})

test('porteur — une entrée qui ne NOMME aucun fichier n est vue par AUCUNE porte', () => {
  // Chemin de FIXTURE : le motif `scripts/raw/*-baseline.json` reste un porteur (une baseline de
  // compte peut renaître), alors qu'aucun fichier suivi ne le porte plus — c'est la FORME de
  // l'entrée, pas le fichier, que ce banc mesure.
  const GEL = 'scripts/raw/gel-par-chapitre-baseline.json'
  const entree = '    { "chapitre": "LDB 8", "folio": 12 },'
  const avant = `{\n  "entrees": [\n${entree}\n    { "chapitre": "LDB 8", "folio": 14 }\n  ]\n}\n`
  const apres = `{\n  "entrees": [\n${entree}\n    { "chapitre": "LDB 8", "folio": 13 },\n    { "chapitre": "LDB 8", "folio": 14 }\n  ]\n}\n`
  assert.deepEqual(entreesDeStock(avant, GEL), [], 'un chapitre et un folio ne nomment aucun fichier')
  assert.deepEqual(
    croissanceDesStocks(diffAuxLignes(GEL, 4, ['    { "chapitre": "LDB 8", "folio": 13 },']),
      { lirePostImage: () => apres, lirePreImage: () => avant }),
    [],
    'un gel par CHAPITRE reste hors de vue des deux portes — il se rend déclarable en nommant son fichier',
  )
})

test('stock NOMINATIF de l Atlas RAW — une entrée ajoutée est une croissance déclarable, exemple cité', () => {
  const f = 'scripts/raw/empty-line-code-refs-stock.json'
  assert.equal(estPorteurDeStock(f), true)
  const entree = (ref) => [
    '    {',
    '      "fichier": "src/engine/ops.ts",',
    `      "ref": "${ref}",`,
    '      "occurrence": 1,',
    '      "lot": "#1711",',
    '      "date": "2026-09-12"',
    '    }',
  ]
  const enveloppe = (corps) => ['{', '  "quoi": "fixture",', '  "entrees": [', ...corps, '  ]', '}', ''].join('\n')
  const avant = enveloppe(entree('LDB 40 l.53'))
  const apres = enveloppe([...entree('LDB 40 l.53').map((l, i) => (i === 6 ? '    },' : l)), ...entree('LDB 13 l.184')])
  // L'entrée ajoutée VIT à la ligne 11 du post-image (enveloppe de 3 lignes + 7 lignes de la
  // première entrée) : le hunk part de là, sans quoi la porte lirait le diff à une autre hauteur que
  // l'image et citerait la ligne voisine.
  const [c] = croissanceDesStocks(
    diffAuxLignes(f, 11, entree('LDB 13 l.184'), []),
    { lirePostImage: () => apres, lirePreImage: () => avant },
  )
  assert.equal(c.fichier, f)
  assert.equal(c.net, 1, 'une entrée MULTILIGNE compte pour UNE : la porte voit l’ajout, jamais ses lignes internes')
  assert.equal(
    c.exemples[0], '"fichier": "src/engine/ops.ts",',
    'l’exemple cité est la ligne qui NOMME le fichier — une accolade ouvrante n’apprend rien au lecteur du refus',
  )
})

// CAS B (#1727 T2) — un RECLASSEMENT entre deux classes de dette. La porte compte PAR FICHIER : sous
// UN seul toit (deux rubriques `perdues`/`benignes` d'un même JSON), retirer ici et ajouter là vaut
// net 0, et le compte des pages PERDUES baisse sans un mot. En DEUX fichiers, le receveur croît :
// c'est la porte EXISTANTE qui exige alors le `CLIQUET:`, sans une ligne de garde de plus.
test('CAS B — reclasser une entrée d’un stock vers un AUTRE est une croissance NETTE du receveur', () => {
  const source = 'scripts/raw/empty-folios-perdues-stock.json'
  const receveur = 'scripts/raw/empty-folios-benignes-stock.json'
  const entree = (folio) => [
    '    {',
    '      "fichier": "Source/WH - V4 - Le zoo imperial/05 - Amibe.md",',
    `      "ref": "ZI 5 folio ${folio}",`,
    '      "occurrence": 1,',
    '      "pdfChars": 2136',
    '    }',
  ]
  const enveloppe = (corps) => ['{', '  "quoi": "fixture",', '  "entrees": [', ...corps, '  ]', '}', ''].join('\n')
  const virgule = (lignes) => lignes.map((l, i) => (i === lignes.length - 1 ? '    },' : l))
  const images = {
    [source]: { avant: enveloppe([...virgule(entree(62)), ...entree(55)]), apres: enveloppe(entree(55)) },
    [receveur]: { avant: enveloppe(entree(58)), apres: enveloppe([...virgule(entree(58)), ...entree(62)]) },
  }
  const diff = [
    diffAuxLignes(source, 4, [], virgule(entree(62))),
    diffAuxLignes(receveur, 10, entree(62), []),
  ].join('\n')
  const r = croissanceDesStocks(diff, {
    lirePostImage: (f) => images[f]?.apres ?? null,
    lirePreImage: (f) => images[f]?.avant ?? null,
  })
  assert.deepEqual(r.map((c) => [c.fichier, c.net]), [[receveur, 1]],
    'le receveur croît de 1 — le fichier source, lui, décroît et ne se déclare pas')
  assert.equal(r[0].exemples[0], '"fichier": "Source/WH - V4 - Le zoo imperial/05 - Amibe.md",',
    'l’exemple cité nomme le chapitre reclassé')

  // Le MÊME geste sous UN seul toit : net 0, invisible — la raison d'être des DEUX fichiers.
  const seul = 'scripts/raw/empty-folios-stock.json'
  const unToit = (perdues, benignes) => ['{', '  "perdues": [', ...perdues, '  ],', '  "benignes": [', ...benignes, '  ]', '}', ''].join('\n')
  assert.deepEqual(
    croissanceDesStocks(
      [diffAuxLignes(seul, 3, [], virgule(entree(62))), diffAuxLignes(seul, 11, entree(62), [])].join('\n'),
      {
        lirePostImage: () => unToit(entree(55), [...virgule(entree(58)), ...entree(62)]),
        lirePreImage: () => unToit([...virgule(entree(62)), ...entree(55)], entree(58)),
      },
    ),
    [],
    'deux rubriques d’un même fichier : `-1` et `+1` sous le même toit, net 0 — le reclassement passerait muet',
  )
})

test('stock NOMINATIF de l Atlas RAW — une entrée qui nomme une FICHE (docs/raw) est vue elle aussi', () => {
  const f = 'scripts/raw/reanchor-low-stock.json'
  assert.equal(estPorteurDeStock(f), true)
  const entree = (fiche, ref) => [
    '    {',
    `      "fichier": "${fiche}",`,
    `      "ref": "${ref}",`,
    '      "occurrence": 1,',
    '      "lot": "#1711",',
    '      "date": "2026-09-12"',
    '    }',
  ]
  const enveloppe = (corps) => ['{', '  "quoi": "fixture",', '  "entrees": [', ...corps, '  ]', '}', ''].join('\n')
  const ajoutee = entree('docs/raw/4e/bestiaire.md', 'ZI 13 l.954')
  const avant = enveloppe(entree('docs/raw/4e/combat.md', 'LDB 46 l.12'))
  const apres = enveloppe([...entree('docs/raw/4e/combat.md', 'LDB 46 l.12').map((l, i) => (i === 6 ? '    },' : l)), ...ajoutee])
  const [c] = croissanceDesStocks(
    diffAuxLignes(f, 11, ajoutee, []),
    { lirePostImage: () => apres, lirePreImage: () => avant },
  )
  assert.equal(c.fichier, f)
  assert.equal(c.net, 1, 'une fiche de l’Atlas est un chemin de dépôt : la porte de plage compte l’entrée ajoutée')
  assert.equal(
    c.exemples[0], '"fichier": "docs/raw/4e/bestiaire.md",',
    'l’exemple cité est la ligne qui NOMME la fiche',
  )
})

// ── RACINE `Source/` : le chapitre EXTRAIT, nom à ESPACES (#1711 T4) ─────────────────────────────

// Trois chapitres, VRAIS chemins du dépôt, pris à trois familles de répertoires : sans apostrophe
// ASCII (LDB), et avec (ADE I, ACE — sept répertoires de `Source/` en portent une, et 36 des 76
// entrées du stock des sauts de folio tombent sous elles). Trois CONSTANTES de chaîne plutôt qu'un
// tableau : en portée de module, un tableau de chemins serait lui-même un stock nominatif de trois
// entrées — la règle que ce fichier mesure.
const CHAPITRE = 'Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.md'
const CHAPITRE_ADE = "Source/Warhammer v4 - Les archives de l'Empire volume 1/01 - LES GRANDES PROVINCES.md"
const CHAPITRE_ACE = "Source/Warhammer v4 - Aldorf la Couronne de l'Empire/12 - Activites.md"

const casDuChapitre = (chapitre) => {
  test(`stock NOMINATIF de l Atlas RAW — l entrée qui nomme « ${chapitre.split('/')[1]} » est vue (espaces et apostrophe admis)`, () => {
    const f = 'scripts/raw/folio-gaps-stock.json'
    assert.equal(estPorteurDeStock(f), true)
    const entree = (ref) => [
      '    {',
      `      "fichier": ${JSON.stringify(chapitre)},`,
      `      "ref": "${ref}",`,
      '      "occurrence": 1,',
      '      "lot": "#1711",',
      '      "date": "2026-09-12"',
      '    }',
    ]
    const enveloppe = (corps) => ['{', '  "quoi": "fixture",', '  "entrees": [', ...corps, '  ]', '}', ''].join('\n')
    const ajoutee = entree('LDB 8 69→71')
    const avant = enveloppe(entree('LDB 8 65→67'))
    const apres = enveloppe([...entree('LDB 8 65→67').map((l, i) => (i === 6 ? '    },' : l)), ...ajoutee])
    assert.equal(
      entreesDeStock(apres, f).length, 2,
      'les deux entrées sont lues : un nom de chapitre à espaces — apostrophe ASCII comprise — nomme un fichier',
    )
    const [c] = croissanceDesStocks(
      diffAuxLignes(f, 11, ajoutee, []),
      { lirePostImage: () => apres, lirePreImage: () => avant },
    )
    assert.ok(c, `un saut de folio ajouté sous « ${chapitre} » doit être une croissance rendue`)
    assert.equal(c.fichier, f)
    assert.equal(c.net, 1, 'un saut de folio déclaré est une entrée de plus, visible à la porte de plage')
    assert.equal(
      c.exemples[0], ajoutee[1].trim(),
      'l’exemple cité est la ligne qui NOMME le chapitre',
    )
  })
}
casDuChapitre(CHAPITRE)
casDuChapitre(CHAPITRE_ADE)
casDuChapitre(CHAPITRE_ACE)

test('racine `Source/` — ce qui n en est PAS : prose à espaces, dossier sans `.md`, extension étrangère', () => {
  const f = 'scripts/raw/folio-gaps-stock.json'
  const stock = (valeur) => ['{', '  "entrees": [', `    { "fichier": ${JSON.stringify(valeur)}, "occurrence": 1 }`, '  ]', '}', ''].join('\n')
  assert.equal(entreesDeStock(stock(CHAPITRE), f).length, 1, 'témoin : le chapitre extrait EST une entrée')
  for (const valeur of [
    'le chapitre du Statut dans Source',
    'Source/Warhammer v4 - Livre de base version corrigee',
    'Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.pdf',
  ]) {
    assert.deepEqual(entreesDeStock(stock(valeur), f), [], `« ${valeur} » ne nomme aucun fichier`)
  }
})

// ── L'entrée MULTILIGNE qui ne CROÎT PAS : trois gestes qui valent `net 0` ──────────────────
//
// Sonde du juge de diff (2026-09-12) promue. Les témoins de CROISSANCE vivent plus haut (une entrée
// ajoutée → net 1, exemple nommant) ; ces trois-là tiennent l'autre bord — ce qu'une entrée-objet
// de sept lignes ne doit PAS rendre, là où un compte de lignes naïf verrait des croissances.
// Chaque cas ANCRE ses hunks : il affirme d'abord où `entreesDeStock` pose les entrées de chaque
// image, sans quoi un numéro de hunk faux rendrait un vert qui ne mesure rien.
const FOLIO = 'scripts/raw/folio-gaps-stock.json'

const entreeFolio = (chapitre, ref, date = '2026-09-12') => [
  '    {',
  `      "fichier": ${JSON.stringify(chapitre)},`,
  `      "ref": "${ref}",`,
  '      "occurrence": 1,',
  '      "lot": "#1711",',
  `      "date": "${date}"`,
  '    }',
]
/** Les blocs mis bout à bout sous l'enveloppe du stock — virgule posée sur tous sauf le dernier. */
const stockFolio = (...blocs) => [
  '{', '  "quoi": "fixture",', '  "entrees": [',
  ...blocs.flatMap((b, i) => b.map((l, j) => (j === b.length - 1 && i < blocs.length - 1 ? `${l},` : l))),
  '  ]', '}', '',
].join('\n')
/** Le bloc tel qu'il s'écrit quand une autre entrée le SUIT. */
const suivi = (bloc) => bloc.map((l, j) => (j === bloc.length - 1 ? `${l},` : l))
/** Diff unifié à PLUSIEURS hunks : un déplacement s'écrit en deux (le retrait à sa hauteur du
 *  PRÉ-image, l'ajout à la sienne du POST-image). */
const diffHunks = (fichier, hunks) => [
  `diff --git a/${fichier} b/${fichier}`, `--- a/${fichier}`, `+++ b/${fichier}`,
  ...hunks.flatMap(({ pre, post, retirees = [], ajoutees = [] }) => [
    `@@ -${pre},${retirees.length} +${post},${ajoutees.length} @@`,
    ...retirees.map((l) => `-${l}`), ...ajoutees.map((l) => `+${l}`),
  ]),
].join('\n')
const lignesDEntree = (image) => entreesDeStock(image, FOLIO).map((e) => e.ligne)

test('entrée MULTILIGNE — une entrée DÉPLACÉE dans son stock ne rend RIEN', () => {
  const a = entreeFolio(CHAPITRE, 'LDB 8 65→67')
  const b = entreeFolio(CHAPITRE_ACE, 'ACE 12 3→5')
  const c = entreeFolio(CHAPITRE, 'LDB 8 90→92')
  const avant = stockFolio(a, b, c)
  const apres = stockFolio(b, a, c)
  assert.deepEqual(lignesDEntree(avant), [4, 11, 18], 'ancrage : enveloppe de 3 lignes, puis trois entrées de 7')
  assert.deepEqual(lignesDEntree(apres), [4, 11, 18], 'ancrage : le déplacement laisse les mêmes hauteurs')
  const diff = diffHunks(FOLIO, [
    { pre: 4, post: 3, retirees: suivi(a) },
    { pre: 17, post: 11, ajoutees: suivi(a) },
  ])
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }), [],
    'une entrée retirée d’une hauteur et reposée à une autre est `+1/-1` : le stock ne CROÎT pas',
  )
})

test('entrée MULTILIGNE — un champ NON nommant modifié (la date) ne rend RIEN', () => {
  const a = entreeFolio(CHAPITRE, 'LDB 8 65→67')
  const b = entreeFolio(CHAPITRE_ACE, 'ACE 12 3→5')
  const avant = stockFolio(a, b)
  const apres = stockFolio(entreeFolio(CHAPITRE, 'LDB 8 65→67', '2026-10-01'), b)
  assert.deepEqual(lignesDEntree(avant), [4, 11], 'ancrage : la première entrée vit à la ligne 4, sa date à la 9')
  assert.deepEqual(lignesDEntree(apres), [4, 11])
  const diff = diffHunks(FOLIO, [
    { pre: 9, post: 9, retirees: ['      "date": "2026-09-12"'], ajoutees: ['      "date": "2026-10-01"'] },
  ])
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }), [],
    'la date vit DANS une entrée sans en OUVRIR une : ni ajout ni retrait à compter (0/0)',
  )
})

// LIMITE dite ici et non ailleurs : l'ÉCHANGE EN PLACE — réécrire le `fichier` d'une entrée pour
// couvrir un AUTRE site — touche la ligne NOMMANTE, qui n'OUVRE aucune entrée (l'entrée vit à son
// accolade) : la porte ne compte ni ajout ni retrait, et le stock ne peut pas CROÎTRE ainsi. Ce qui
// voit l'échange est la garde du volet (`ecartDuVolet`), dont la clé change des deux côtés : une
// périmée ET une neuve.
test('entrée MULTILIGNE — la ligne `fichier` REMPLACÉE ne rend RIEN (échange en place)', () => {
  const a = entreeFolio(CHAPITRE, 'LDB 8 65→67')
  const b = entreeFolio(CHAPITRE_ACE, 'ACE 12 3→5')
  const avant = stockFolio(a, b)
  const apres = stockFolio(entreeFolio(CHAPITRE_ACE, 'LDB 8 65→67'), b)
  assert.deepEqual(lignesDEntree(avant), [4, 11], 'ancrage : la ligne NOMMANTE de la première entrée est la 5')
  assert.deepEqual(lignesDEntree(apres), [4, 11])
  const diff = diffHunks(FOLIO, [{
    pre: 5,
    post: 5,
    retirees: [`      "fichier": ${JSON.stringify(CHAPITRE)},`],
    ajoutees: [`      "fichier": ${JSON.stringify(CHAPITRE_ACE)},`],
  }])
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }), [],
    'la ligne NOMMANTE n’ouvre aucune entrée (0/0) : la porte de plage se tait, la garde du volet parle',
  )
})

test('entrée — élément de liste, clé d objet et balise commentée comptent', () => {
  assert.equal(estEntreeDeStock(ENTREE_A), true)
  assert.equal(estEntreeDeStock(ENTREE_B), true)
  assert.equal(estEntreeDeStock(ENTREE_CLE), true)
  assert.equal(estEntreeDeStock("  'src/ui/Tabs.tsx:42',"), true)
})

test('entrée — le cas FONDATEUR : une clé de registre en NOM DE FICHIER nu', () => {
  assert.equal(estEntreeDeStock("  'criticals.json':"), true)
  assert.equal(estEntreeDeStock("  'criticals.json': 'Blessures critiques (LDB 18) : le noeud est auto-résolu.',"), true)
})

test('entrée — tuple dont le fichier est la CLÉ ou la QUEUE', () => {
  assert.equal(estEntreeDeStock("  ['src/state/combatFlow.ts', { n: 32, kind: 'mixte' }],"), true)
  assert.equal(estEntreeDeStock("  ['CritEscalation', 'onRepeat', 'src/engine/critical.ts:325'],"), true)
})

test('entrée — un chemin cité en PROSE ou en commentaire n en est pas une', () => {
  assert.equal(estEntreeDeStock("      `⛔ src/state/combatSlice.ts a grossi`,"), false)
  assert.equal(estEntreeDeStock('  // src/state/combatSlice.ts reste à traiter'), false)
  assert.equal(estEntreeDeStock("    'src/x.ts est absent de l index',"), false)
  assert.equal(estEntreeDeStock("  const stock = ['src/a.ts', 'src/b.ts']"), false)
  assert.equal(estEntreeDeStock("import { scanTombstones } from '../guards/lib/commentPoison.mjs'"), false)
})

test('croissance — un stock qui NAÎT est une croissance nette, avec ses exemples', () => {
  const [c] = croissanceDesStocks(diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B]), REPLI)
  assert.equal(c.fichier, 'src/state/flowtest-derived-stake.test.ts')
  assert.deepEqual([c.ajoutees, c.retirees, c.net], [2, 0, 2])
  assert.deepEqual(c.exemples, [ENTREE_A.trim(), ENTREE_B.trim()])
})

test('croissance — un stock qui DÉCROÎT ou qui se déplace ne dit rien', () => {
  assert.deepEqual(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [], [ENTREE_A, ENTREE_B]), REPLI), [])
  assert.deepEqual(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [ENTREE_A], [ENTREE_B]), REPLI), [])
})

test('croissance — un diff qui n’est PAS une chaîne LÈVE, et un « 0 » ne peut plus mentir', () => {
  // Témoin POSITIF d'abord : sans lui, un `[]` prouverait autant que la lib cassée. Le même diff,
  // passé en OBJET (l'appel qu'un juge a fait le 2026-09-04), doit lever au lieu de rendre [].
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  assert.ok(croissanceDesStocks(diff, REPLI).length > 0, 'témoin positif muet : la mesure ne mesure rien')
  assert.throws(() => croissanceDesStocks({ diff }, REPLI), /POSITIONNELLE/)
  assert.throws(() => croissanceDesStocks(undefined, REPLI), /attend le diff en CHAÎNE/)
  assert.throws(() => croissanceDesStocks(null, REPLI), /attend le diff en CHAÎNE/)
})

test('croissance — hors fichier PORTEUR, la règle se tait', () => {
  assert.deepEqual(croissanceDesStocks(diffDe('src/state/combatFlow.ts', [ENTREE_A, ENTREE_B]), REPLI), [])
})

test('CLIQUET — le message couvre le fichier s il annonce le BON compte et un motif', () => {
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  const couvrant =
    'feat: lot\n\nCLIQUET: src/state/flowtest-derived-stake.test.ts +2 — deux familles auto-résolues mesurées ce jour\n'
  assert.deepEqual(cliquetsDuMessage(couvrant).map((k) => k.n), [2])
  assert.deepEqual(croissancesNonCouvertes({ diff, message: couvrant }, REPLI), [])
})

test('CLIQUET — un compte FAUX ou un motif de tampon ne couvre rien, et le refus le dit', () => {
  const diff = diffDe('src/state/flowtest-derived-stake.test.ts', [ENTREE_A, ENTREE_B])
  const fauxCompte = 'CLIQUET: src/state/flowtest-derived-stake.test.ts +1 — motif suffisamment long pour passer'
  const [c] = croissancesNonCouvertes({ diff, message: fauxCompte }, REPLI)
  assert.deepEqual([c.net, c.declare], [2, 1])
  assert.match(raisonDeRefus([c]), /annonce `\+1`, pas \+2/)
  const tampon = 'CLIQUET: src/state/flowtest-derived-stake.test.ts +2 — besoin'
  assert.equal(croissancesNonCouvertes({ diff, message: tampon }, REPLI).length, 1)
  const autreFichier = 'CLIQUET: scripts/guards/lib/domResiduStock.mjs +2 — un motif assez long mais pour un autre fichier'
  assert.equal(croissancesNonCouvertes({ diff, message: autreFichier }, REPLI).length, 1)
})

test('refus — nomme le fichier, le compte et jusqu à trois exemples', () => {
  const raison = raisonDeRefus(croissanceDesStocks(diffDe('scripts/guards/lib/domResiduStock.mjs', [ENTREE_A, ENTREE_B, ENTREE_CLE, ENTREE_A]), REPLI))
  assert.match(raison, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
  assert.match(raison, /scripts\/guards\/lib\/domResiduStock\.mjs : \+4 entrée\(s\) nette\(s\)/)
  assert.equal(raison.split(' · ').length, 3, 'trois exemples, pas la liste entière')
  assert.match(raison, /CLIQUET: <fichier> \+N/)
})

// ── PORTÉE DE MODULE : une fixture DANS un test n'est pas un stock ────────────────────────────────
// Les trois « entrées » de `429b9a1a2` et le `+8` de `572e60b8b` étaient des littéraux écrits dans
// des corps de `test(...)` — des données locales, pas une dette. Le défaut était celui du LECTEUR
// (précédent `0d6ddeee1` : la classe se règle au garde, jamais à la fixture).

/** L'entrée telle qu'elle vit dans `enregistreur-lectures.test.mjs` (429b9a1a2), copiée ici. */
const FIXTURE =
  "  'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: ['src/state/store.ts'], dossiers: [] },"

/** Post-image où la fixture vit DANS un corps de test (donnée locale). */
const POST_LOCALE = [
  "import { test } from 'node:test'",
  '',
  "test('une cible SANS pied est nommée', () => {",
  '  const par = {',
  FIXTURE,
  '  }',
  '  return par',
  '})',
  '',
].join('\n')

/** Le MÊME littéral, hissé en constante de MODULE : là, c'est un stock. */
const POST_MODULE = [
  "import { test } from 'node:test'",
  '',
  'const PAR = {',
  FIXTURE,
  '}',
  '',
  "test('x', () => PAR)",
  '',
].join('\n')

/** Diff qui AJOUTE la fixture à la ligne `ligne` du post-image (les `-U0` de git ont cette forme). */
const diffAjoutA = (fichier, ligne) =>
  [
    `diff --git a/${fichier} b/${fichier}`,
    `--- a/${fichier}`,
    `+++ b/${fichier}`,
    `@@ -${ligne},0 +${ligne},1 @@`,
    `+${FIXTURE}`,
  ].join('\n')

test('portée — le MÊME littéral compte en constante de module, jamais dans un corps de test', () => {
  const f = 'scripts/docs/lib/enregistreur-lectures.test.mjs'
  assert.deepEqual(
    croissanceDesStocks(diffAjoutA(f, 5), { lirePostImage: () => POST_LOCALE }), [],
    'une fixture écrite dans un `test(...)` ne s’ajoute à aucune dette',
  )
  const [c] = croissanceDesStocks(diffAjoutA(f, 4), { lirePostImage: () => POST_MODULE })
  assert.deepEqual([c.fichier, c.net], [f, 1])
})

test('portée — quand le lecteur rend `null`, le REPLI juge et l\'entrée COMPTE', () => {
  const f = 'scripts/docs/lib/enregistreur-lectures.test.mjs'
  assert.equal(
    croissanceDesStocks(diffAjoutA(f, 5), REPLI).length, 1,
    'fichier supprimé ou binaire : la porte perd sa précision, jamais sa vue',
  )
})

test('portée — le RETRAIT se juge sur le PRÉ-image : retirer une fixture ne compense pas un ajout', () => {
  const f = 'scripts/guards/lib/lintStage.test.mjs'
  const diff = [
    `diff --git a/${f} b/${f}`,
    `--- a/${f}`,
    `+++ b/${f}`,
    '@@ -5,1 +4,0 @@',
    `-${FIXTURE}`,
    '@@ -4,0 +4,1 @@',
    `+${FIXTURE}`,
  ].join('\n')
  // La fixture vit à la ligne 5 du PRÉ-image (corps de `test`) et à la ligne 4 du POST (module).
  const [c] = croissanceDesStocks(diff, { lirePostImage: () => POST_MODULE, lirePreImage: () => POST_LOCALE })
  assert.deepEqual(
    [c.ajoutees, c.retirees, c.net], [1, 0, 1],
    'le retrait d’une FIXTURE locale ne solde pas l’ajout d’une entrée de module',
  )
})

// Une règle contournable par trois enveloppes d'une ligne ne garde rien : `export const STOCK =
// (() => […])()`, `export function stock() { return […] }`, `export const stock = () => […]`
// rendaient le stock INVISIBLE (sonde 2026-09-04). Seul ce qui vit dans une fonction passée en
// ARGUMENT d'un appel est local — le corps d'un `test`/`it`/`describe`, pas une déclaration.
test('portée — aucune ENVELOPPE ne cache un stock de module', () => {
  const f = 'scripts/guards/lib/xStock.mjs'
  const E = ["  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", "  'src/ui/Tabs.tsx',"]
  const diff = [
    `diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, `@@ -2,0 +2,${E.length} @@`, ...E.map((e) => `+${e}`),
  ].join('\n')
  const enveloppes = {
    'const de module': ['export const STOCK = [', ...E, ']'],
    'IIFE de module': ['export const STOCK = (() => [', ...E, '])()'],
    'fonction exportée': ['export function stock() { return [', ...E, '] }'],
    'fléchée exportée': ['export const stock = () => [', ...E, ']'],
    'objet figé': ['export const STOCK = Object.freeze([', ...E, '])'],
  }
  for (const [nom, lignes] of Object.entries(enveloppes)) {
    const [c] = croissanceDesStocks(diff, { lirePostImage: () => `${lignes.join('\n')}\n` })
    assert.equal(c?.net, 3, `${nom} : le stock a disparu derrière l'enveloppe`)
  }
  const dansUnDescribe = ["describe('x', () => { const S = [", ...E, '] })'].join('\n')
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => `${dansUnDescribe}\n` }), [],
    'un corps de `describe(…)` reste une donnée locale',
  )
})

// ── LA DÉFINITION : porteur = tableau OU objet atteignable depuis une liaison de module ───────────
// Une entrée se lit sur l'IMAGE, par l'AST : c'est la POSITION dans le porteur qui la définit, jamais
// la forme de son littéral. Les deux plus gros stocks du dépôt (`slotsStock`, `structuresStock`)
// ouvrent leurs lignes par une accolade, et chacune de leurs entrées compte.

/** Les quatre formes de stock du dépôt, et les lignes (1-based) où vivent leurs entrées. */
const FORMES = {
  'tableau de chaînes': {
    corps: ['const STOCK = [', "  'src/state/combatFlow.ts',", "  'src/ui/Tabs.tsx',", ']'],
    entrees: [2, 3],
  },
  'tableau d’objets': {
    corps: [
      'const STOCK = [',
      "  { dataset: 'src/data/careers.json', n: 3 },",
      "  { dataset: 'src/data/spells.json', n: 1 },",
      ']',
    ],
    entrees: [2, 3],
  },
  'objet à clés-chemins (le cas FONDATEUR)': {
    corps: [
      'const AUTO_RESOLUS = {',
      "  'criticals.json': 'Blessures critiques (LDB 18) : le noeud est auto-résolu.',",
      "  'src/ui/Tabs.tsx': 'auto-résolu',",
      '}',
    ],
    entrees: [2, 3],
  },
  // Une propriété dont la valeur est un littéral est une RUBRIQUE : on y descend, elle ne compte pas.
  'objet dont les valeurs sont des tableaux': {
    corps: [
      'const ECRIVAINS = {',
      "  'test:hooks': [",
      "    'scripts/hooks/a.test.mjs',",
      "    'scripts/hooks/b.test.mjs',",
      '  ],',
      '}',
    ],
    entrees: [3, 4],
  },
  // Une CLÉ qui nomme un fichier est une entrée, et l'on ne descend pas dans sa valeur.
  'clé-chemin dont la valeur est un objet': {
    corps: [
      'const STOCK = {',
      "  'src/ui/Tabs.tsx': {",
      "    raison: 'vocabulaire hérité',",
      "    voir: 'src/ui/App.tsx',",
      '  },',
      '}',
    ],
    entrees: [2],
  },
}

const lignesDe = (source, chemin) => entreesDeStock(source, chemin).map((e) => e.ligne)

test('définition — les quatre formes de stock sont VUES en portée de module', () => {
  for (const [nom, { corps, entrees }] of Object.entries(FORMES)) {
    assert.deepEqual(lignesDe(`${corps.join('\n')}\n`, 'scripts/guards/lib/xStock.mjs'), entrees, nom)
  }
})

test('définition — les mêmes formes, écrites DANS un test, ne sont aucune entrée', () => {
  for (const [nom, { corps }] of Object.entries(FORMES)) {
    const locale = ["test('x', () => {", ...corps.map((l) => `  ${l}`), '})'].join('\n')
    assert.deepEqual(lignesDe(`${locale}\n`, 'scripts/guards/lib/xStock.mjs'), [], nom)
  }
})

test('définition — une entrée MULTILIGNE vit à la ligne de son PREMIER caractère', () => {
  const corps = [
    'export const STOCK = [',
    '  {',
    "    fichier: 'src/ui/Tabs.tsx',",
    "    raison: 'vocabulaire hérité',",
    '  },',
    ']',
  ].join('\n')
  assert.deepEqual(lignesDe(`${corps}\n`, 'scripts/guards/lib/legacyVocabStock.mjs'), [2])
  assert.equal(estEntreeDeStock('  {'), false, 'le REPLI de ligne ne voit pas une accolade ouvrante')
})

test('définition — un porteur JSON se lit comme les autres', () => {
  const f = 'scripts/hooks/ecrans-ui.json'
  const table = ['{', '  "ecrans": [', '    "src/ui/App.tsx",', '    "src/ui/Tabs.tsx"', '  ]', '}'].join('\n')
  assert.deepEqual(lignesDe(`${table}\n`, f), [3, 4], 'les deux écrans ; la rubrique `ecrans` n’en est pas un')
  const [c] = croissanceDesStocks(diffAjoutA(f, 3), { lirePostImage: () => table })
  assert.deepEqual([c.fichier, c.net], [f, 1])
})

test('repli — sur une image `null`, une entrée à ACCOLADE n’est pas vue, et l’en-tête le dit', () => {
  const f = 'scripts/guards/lib/legacyVocabStock.mjs'
  const post = ['export const STOCK = [', '  {', "    fichier: 'src/ui/Tabs.tsx',", '  },', ']'].join('\n')
  const diff = [
    `diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, '@@ -2,0 +2,3 @@',
    '+  {', "+    fichier: 'src/ui/Tabs.tsx',", '+  },',
  ].join('\n')
  assert.deepEqual(croissanceDesStocks(diff, REPLI), [], 'image `null` : le repli de ligne ne voit pas l’accolade')
  const [c] = croissanceDesStocks(diff, { lirePostImage: () => `${post}\n` })
  assert.deepEqual([c.fichier, c.net], [f, 1], 'avec l’image, l’entrée multiligne est vue une fois')
})

// ── NAISSANCE : le compte d'un fichier qui naît vient du LECTEUR, ou l'appel est REFUSÉ ─────────
// Sonde 3 de la revue de palier du 2026-09-08 : `croissanceDesStocks(diff)` SANS lecteur rendait
// `[]` sur `5756d2d2c`, où `scripts/raw/reconciliation-stock.json` NAÎT avec 13 entrées — un zéro
// qui ment pour tout appelant hors CI (diagnostic, sonde, revue). Un tel appel est désormais un
// REFUS NOMMÉ : la lib ne devine aucune image, elle exige son unique source.

/** Diff d'un fichier qui NAÎT : la graphie de `git diff` (pré-image `/dev/null`, hunk à partir de 1). */
const diffNaissance = (fichier, source) => {
  const lignes = source.replace(/\n$/, '').split('\n')
  return [
    `diff --git a/${fichier} b/${fichier}`,
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    `+++ b/${fichier}`,
    `@@ -0,0 +1,${lignes.length} @@`,
    ...lignes.map((l) => `+${l}`),
  ].join('\n')
}

/** Un `*-stock.json` de l'Atlas à sa forme RÉELLE : une entrée = une rubrique dont la propriété
 *  `sites` nomme les fichiers — aucune de ses lignes, prise seule, ne se lit comme une entrée. */
const stockJson = (entrees) => [
  '{',
  '  "quoi": "fixture — un trou dur par rubrique",',
  '  "trous": {',
  entrees.map(([cle, sites]) => [
    `    "${cle}": {`,
    `      "sites": [${sites.map((s) => `"${s}"`).join(', ')}],`,
    '      "lot": "#1709 D3",',
    '      "date": "2026-09-11"',
    '    }',
  ].join('\n')).join(',\n'),
  '  }',
  '}',
  '',
].join('\n')

// Les rubriques de fixture s'écrivent DANS le corps de chaque test : au MODULE d'un
// `scripts/**.test.mjs`, le même littéral — fût-il derrière une flèche à corps concis — serait un
// stock de trois entrées, et cette porte se ferait croître elle-même.

test('lecteur — un appel SANS lecteur d’image est REFUSÉ nommément, jamais compté', () => {
  const f = 'scripts/raw/fixture-stock.json'
  const diff = diffNaissance(f, stockJson([
    ['ADE I 2', ['src/data/talents.json']],
    ['EDO 10', ['src/data/skills.json']],
    ['MDG 3', ['src/state/seaActivities.ts', 'src/state/travelFlow.ts']],
  ]))
  const attendu = /aucun lecteur d'image post — un compte sans image ment/
  assert.throws(() => croissanceDesStocks(diff), attendu)
  assert.throws(() => croissanceDesStocks(diff, {}), attendu)
  assert.throws(() => croissanceDesStocks(diff, { lirePostImage: null }), attendu)
  assert.throws(() => croissancesNonCouvertes({ diff, message: 'muet' }), attendu, 'le refus se propage')
})

test('naissance — un `*-stock.json` qui naît compte ses entrées sur l’image du lecteur', () => {
  const f = 'scripts/raw/fixture-stock.json'
  const source = stockJson([
    ['ADE I 2', ['src/data/talents.json']],
    ['EDO 10', ['src/data/skills.json']],
    ['MDG 3', ['src/state/seaActivities.ts', 'src/state/travelFlow.ts']],
  ])
  assert.deepEqual(
    source.split('\n').filter((l) => estEntreeDeStock(l)), [],
    'témoin : le REPLI de ligne ne voit AUCUNE de ces entrées — le compte ne peut venir que d’une image',
  )
  assert.equal(entreesDeStock(source, f).length, 3)
  const diff = diffNaissance(f, source)
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => source }).map((c) => [c.fichier, c.net]), [[f, 3]],
    'le lecteur rend le contenu du fichier qui naît : trois entrées',
  )
  assert.deepEqual(
    croissanceDesStocks(diff, REPLI), [],
    'lecteur qui rend `null` : le repli ne lit aucune de ces entrées — le prix dit en tête de module',
  )
})

// ── L'INVARIANT sur les porteurs RÉELS : l'image VOIT, et jamais moins que le repli ───────────────
// Un stock est une DETTE vers zéro : son cardinal décroît (mesuré — la fusion des matières du monde
// a fait passer `slotsStock` de 339 à 338 et `structuresStock` de 1049 à 1047). Un test qui fige ce cardinal se casse sur le
// travail qu'il devrait saluer. Ce qui ne bouge pas, c'est ce que la porte DOIT tenir sur chacun :
// elle lit des entrées, et sa voie précise n'en voit jamais moins que sa voie de secours — une porte
// dont l'image voit moins que le repli se contourne en changeant la graphie du littéral.
//
// La liste vit DANS le test : en portée de module, elle serait elle-même un stock nominatif qui naît
// (mesuré — la porte a mordu ce fichier pour `+4 entrée(s)`). Une fixture est une donnée LOCALE.
//
// Elle est NOMMÉE plutôt que dérivée : `estPorteurDeStock` retient des FAMILLES de chemins (tests
// de `src/**`, libs de garde, tests de `scripts/**`, tables et stocks JSON), et la plupart des
// fichiers qui y tombent ne portent aucun stock (`image = 0`) ; parmi les plus gros, `image < repli`
// (`structures-contrat.test.ts` 1 contre 9, `refs-migrated.test.ts` 0 contre 5) — le repli compte
// toute LIGNE qui ressemble à une entrée, y compris dans une donnée locale, là où l'image ne compte
// que les entrées d'un porteur de portée MODULE. L'invariant vaut pour les stocks réels, pas pour un
// fichier quelconque : un corpus dérivé par la taille le réfuterait sans rien dire de la porte.
test('porteurs réels — l’image lit des entrées, et jamais moins que le repli de ligne', (t) => {
  const porteurs = [
    'scripts/guards/lib/slotsStock.mjs',
    'scripts/guards/lib/structuresStock.mjs',
    'scripts/guards/lib/legacyVocabStock.mjs',
    'scripts/hooks/ecrans-ui.json',
  ]
  for (const rel of porteurs) {
    const contenu = readFileSync(join(RACINE, rel), 'utf8')
    // `null` = image illisible (dialecte absent de `DIALECTE`) : ZÉRO entrée lue, et le repli
    // prendrait seul la main — donc un porteur dont l'image ne rend rien est un DÉFAUT, pas un cas.
    const parImage = (entreesDeStock(contenu, rel) ?? []).length
    const parRepli = contenu.split(/\r?\n/).filter((l) => estEntreeDeStock(l)).length
    t.diagnostic(`${rel} — image ${parImage} entrée(s), repli ${parRepli} ligne(s)`)
    assert.ok(parImage > 0, `${rel} : l’image ne lit AUCUNE entrée (image ${parImage}, repli ${parRepli})`)
    assert.ok(
      parImage >= parRepli,
      `${rel} : l’image voit MOINS que le repli (image ${parImage}, repli ${parRepli}) — la porte se `
      + 'contournerait en changeant la graphie du littéral',
    )
  }
})

// STOCKS NOMINATIFS DE L'ATLAS RAW : la porte les voit-elle EN ENTIER ? Un stock à moitié vu est
// pire qu'un stock invisible — il donne un compte qui a l'air juste (sans `CHEMIN_SOURCE`, 36 des 76
// entrées des sauts de folio seraient muettes à la porte de plage, sous les seuls répertoires de
// `Source/` à apostrophe ASCII, et y ajouter un saut vaudrait `net 0`). Le corpus est un GLOB,
// jamais une liste : un stock neuf tombe sous la mesure le jour où il naît. Les ancres sans contenu
// y sont entrées par ce chemin (#1727 T2) : `empty-folios-perdues-stock.json` et son pendant bénin
// nomment leur chapitre par `Source/…md`, et ce corpus les compte sans qu'une ligne ait à les citer.
test('stocks de `scripts/raw` — la porte voit CHAQUE entrée déclarée (corpus par GLOB)', (t) => {
  const dossier = join(RACINE, 'scripts', 'raw')
  const stocks = readdirSync(dossier).filter((nom) => nom.endsWith('-stock.json'))
  assert.ok(stocks.length >= 4, `corpus vide ou tronqué : ${stocks.length} stock(s) trouvé(s) sous scripts/raw`)
  for (const nom of stocks) {
    const rel = `scripts/raw/${nom}`
    const contenu = readFileSync(join(dossier, nom), 'utf8')
    const json = JSON.parse(contenu)
    // Deux formes de stock dans `scripts/raw`, et chacune dit son UNITÉ : la liste `entrees` (une
    // entrée par occurrence, un objet par entrée), et la table `trous` de la réconciliation (une
    // entrée par TROU, dont les sites tiennent sur UNE ligne — plusieurs jetons sur une ligne n'en
    // font qu'un pour la porte, sous-comptage assumé dit en tête de `stocksNominatifs.mjs`). Une
    // troisième forme ARRÊTE la mesure au lieu de la laisser compter zéro.
    let declarees
    if (Array.isArray(json.entrees)) declarees = json.entrees.length
    else if (json.trous) declarees = Object.keys(json.trous).length
    else { assert.fail(`${rel} : forme de stock inconnue — la mesure ne sait pas compter ses entrées`) }
    const vues = (entreesDeStock(contenu, rel) ?? []).length
    t.diagnostic(`${rel} — ${vues} vue(s) / ${declarees} déclarée(s)`)
    assert.equal(estPorteurDeStock(rel), true, `${rel} : hors des motifs de porteur, aucune porte ne le lit`)
    assert.equal(
      vues, declarees,
      `${rel} : la porte voit ${vues} entrée(s) sur ${declarees} déclarée(s) — y ajouter une entrée `
      + 'muette serait `net 0`, donc sans `CLIQUET:` à porter au message',
    )
  }
})

// STOCKS NOMINATIFS `.mjs` DE GARDE (#1727) : même mesure que ci-dessus, même raison — un stock à
// moitié vu donne un compte qui a l'air juste. Le corpus est un GLOB sur les porteurs de
// `scripts/guards/lib`, RESSERRÉ à ceux qui portent déjà la forme nominative, lue sur la VALEUR
// EXPORTÉE (un tableau dont au moins une entrée nomme un `fichier`) et jamais sur la graphie du
// littéral : `{ fichier: "…" }`, `{fichier:` ou une entrée posée par une fonction resteraient du
// corpus. Ce qui EST une condition d'entrée, c'est le NOM DE CHAMP `fichier` (graphie canonique de
// `stock.d.mts`) : un tableau d'entrées à graphie autre (`{ file, ref }`…) n'est pas un stock
// nominatif pour ce test et reste hors corpus, silencieusement.
// Les stocks encore à CLÉ AVEUGLE n'ont rien à prouver ici tant qu'ils ne sont pas convertis — le
// jour où ils le sont, ils tombent sous la mesure sans qu'on écrive une ligne. `domResiduStock.mjs`
// n'y tombera PAS, et c'est cohérent : sa clé EST un chemin de fichier, la porte de plage le voit
// déjà — lui inventer une `ref` serait une donnée sans mesure.
test('stocks `.mjs` de garde à la forme NOMINATIVE — la porte voit CHAQUE entrée déclarée (corpus par GLOB)', async (t) => {
  const dossier = join(RACINE, 'scripts', 'guards', 'lib')
  /** Les entrées NOMINATIVES exportées par un module de stock, toutes collections confondues. */
  const entreesExportees = (mod) => Object.values(mod)
    .filter((v) => Array.isArray(v))
    .flatMap((liste) => liste.filter((e) => e && typeof e.fichier === 'string'))
  const modules = new Map()
  for (const nom of readdirSync(dossier).filter((n) => n.endsWith('Stock.mjs'))) {
    modules.set(nom, await import(pathToFileURL(join(dossier, nom)).href))
  }
  const convertis = [...modules].filter(([, mod]) => entreesExportees(mod).length > 0).map(([nom]) => nom)
  // Une assertion PAR stock converti : sans elles, la mesure serait verte par VACUITÉ le jour où une
  // conversion se défait (le module sort du corpus sans un mot).
  for (const nom of [
    'paletteLiteralStock.mjs',
    'rigPartViewStock.mjs',
    'rigViewStock.mjs',
    'entityOrphanStock.mjs',
    'tableConsumerStock.mjs',
    'jambesGabaritStock.mjs',
    'quadDecoStock.mjs',
    'folioLineAlignStock.mjs',
    'horsStrateStock.mjs',
    'spellNarratifStock.mjs',
  ]) {
    assert.ok(
      convertis.includes(nom),
      `${nom} : stock converti à la forme nominative par #1727, mais hors du corpus — la mesure serait verte par vacuité (conversion défaite, ou module renommé hors du motif \`*Stock.mjs\`)`,
    )
  }
  for (const nom of convertis) {
    const rel = `scripts/guards/lib/${nom}`
    const contenu = readFileSync(join(dossier, nom), 'utf8')
    const declarees = entreesExportees(modules.get(nom)).length
    const vues = (entreesDeStock(contenu, rel) ?? []).length
    t.diagnostic(`${rel} — ${vues} vue(s) / ${declarees} déclarée(s)`)
    assert.equal(estPorteurDeStock(rel), true, `${rel} : hors des motifs de porteur, aucune porte ne le lit`)
    assert.equal(
      vues, declarees,
      `${rel} : la porte voit ${vues} entrée(s) sur ${declarees} déclarée(s) — y ajouter une entrée `
      + 'muette serait `net 0`, donc sans `CLIQUET:` à porter au message',
    )
  }
})

// L'APPEND sur un stock `.mjs` nominatif : ce que la clé AVEUGLE rendait gratuit. Sonde du juge de
// design (2026-09-14) promue : la même ligne ajoutée vaut `[]` quand la clé ne nomme aucun fichier
// (`'apothicaire:tete:back#0'`), et `net 1` dès que l'entrée porte son def. Le cas ANCRE ses hunks :
// il affirme d'abord où `entreesDeStock` pose les entrées de chaque image.
test('stock `.mjs` nominatif — une entrée AJOUTÉE est vue par la porte de plage (net 1, exemple nommant)', () => {
  const f = 'scripts/guards/lib/paletteLiteralStock.mjs'
  const entree = (occ) => `  { fichier: 'src/gameIso/rig/parts/tenues/defs/Bailli.ts', ref: 'bailli:torse:front', occurrence: ${occ} },`
  const image = (...lignes) => [
    "/** @type {import('./stock.mjs').EntreeNominative[]} */",
    'export const PALETTE_LITERAL_RATCHET = [', ...lignes, ']', '',
  ].join('\n')
  const avant = image(entree(1))
  const apres = image(entree(1), entree(2))
  assert.deepEqual(entreesDeStock(avant, f).map((e) => e.ligne), [3], 'ancrage : la première entrée vit à la ligne 3')
  assert.deepEqual(entreesDeStock(apres, f).map((e) => e.ligne), [3, 4], 'ancrage : la seconde entrée vit à la ligne 4')
  const diff = [`diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, '@@ -4,0 +4,1 @@', `+${entree(2)}`].join('\n')
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }),
    [{ fichier: f, ajoutees: 1, retirees: 0, net: 1, exemples: [entree(2).trim()] }],
    "l'entrée nomme son def : la porte la compte, et l'exemple qu'elle cite EST l'entrée ajoutée",
  )
  // Le témoin NEGATIF : la même dette écrite en clé aveugle (ni chemin, ni extension) n'est vue par
  // AUCUNE des deux portes — c'est la mesure qui a fondé la conversion #1727.
  const aveugle = (occ) => `  'bailli:torse:front#${occ}',`
  const imageAveugle = (...lignes) => ['/** @type {ReadonlySet<string>} */', 'export const PALETTE_LITERAL_RATCHET = new Set([', ...lignes, '])', ''].join('\n')
  const diffAveugle = [`diff --git a/${f} b/${f}`, `--- a/${f}`, `+++ b/${f}`, '@@ -4,0 +4,1 @@', `+${aveugle(2)}`].join('\n')
  assert.deepEqual(entreesDeStock(imageAveugle(aveugle(1), aveugle(2)), f), [], 'une clé qui ne nomme aucun fichier n’est pas une entrée pour la porte')
  assert.deepEqual(
    croissanceDesStocks(diffAveugle, { lirePostImage: () => imageAveugle(aveugle(1), aveugle(2)), lirePreImage: () => imageAveugle(aveugle(1)) }),
    [], 'clé aveugle : allonger le stock reste GRATUIT et MUET — la raison d’être de la forme nominative',
  )
})

// ── Les FENÊTRES : ce que la porte aveugle ratait, et ce qu'elle voit ─────────────────────────
//
// Chaque fenêtre est une FIXTURE (shas figés) réduite au plus petit intervalle qui porte ENCORE son
// événement : un `git show` par porteur et par commit, plus un parse AST de chaque image, se paie au
// commit. La fenêtre unique 2c11fdd9a..f0f9436f5 (27 commits) coûtait 66,5 s à elle seule ; les trois
// événements qu'elle portait vivent chacun dans UN commit, mesuré (#1679 L3b) :
//   · `02cc09c04` fait CROÎTRE `slotsStock` (335→336) pendant que `structuresStock` DÉCROÎT (1046→1045) :
//     les deux plus gros stocks du dépôt, comptés aux deux bornes, un rendu et l'autre pas ;
//   · `c8d3105ae` fait croître un registre à clés en NOM DE FICHIER (`AUTO_RESOLUS`) ;
//   · `a9b7edf17` fait croître un stock OBJET dont les valeurs sont des tableaux.
const FENETRE_STOCKS = { avant: '571f54287', apres: '02cc09c04' }
const FENETRE_REGISTRE = { avant: '2c11fdd9a', apres: 'c8d3105ae' }
const FENETRE_STOCK_OBJET = { avant: 'da3acf95c', apres: 'a9b7edf17' }
const gitOuNull = (...args) => {
  try { return git(...args) } catch { return null }
}
const imagesDe = (avant, apres) => ({
  lirePostImage: (f) => gitOuNull('show', `${apres}:${f}`),
  lirePreImage: (f) => gitOuNull('show', `${avant}:${f}`),
})

test('fenêtre — les deux plus gros stocks du dépôt sont comptés à l’entrée comme à la sortie', () => {
  const compte = (sha, rel) => entreesDeStock(gitOuNull('show', `${sha}:${rel}`), rel).length
  const slots = 'scripts/guards/lib/slotsStock.mjs'
  const structures = 'scripts/guards/lib/structuresStock.mjs'
  assert.deepEqual([compte(FENETRE_STOCKS.avant, slots), compte(FENETRE_STOCKS.apres, slots)], [335, 336])
  assert.deepEqual([compte(FENETRE_STOCKS.avant, structures), compte(FENETRE_STOCKS.apres, structures)], [1046, 1045])

  const cumule = git('diff', '-U0', '--no-renames', `${FENETRE_STOCKS.avant}..${FENETRE_STOCKS.apres}`)
  const croissances = croissanceDesStocks(cumule, imagesDe(FENETRE_STOCKS.avant, FENETRE_STOCKS.apres))
  const parFichier = new Map(croissances.map((c) => [c.fichier, c]))
  assert.deepEqual(
    [parFichier.get(slots)?.ajoutees, parFichier.get(slots)?.retirees, parFichier.get(slots)?.net], [2, 1, 1],
    'la croissance NETTE de `slotsStock` sur la fenêtre est rendue',
  )
  assert.equal(parFichier.has(structures), false, '`structuresStock` DÉCROÎT sur la fenêtre : rien à rendre')
})

test('fenêtre — les croissances non couvertes de la plage, par commit', (t) => {
  const { refus } = croissancesDeLaPlage({ cwd: RACINE, ...FENETRE_REGISTRE })
  const vus = refus.map((r) => `${r.sha.slice(0, 9)} ${r.fichier} +${r.net}`)
  for (const v of vus) t.diagnostic(v)
  assert.ok(
    vus.includes('c8d3105ae src/state/flowtest-derived-stake.test.ts +2'),
    'la croissance du registre `AUTO_RESOLUS` (clés en NOM DE FICHIER) reste rendue',
  )
  // Le MÊME commit fait DÉCROÎTRE `structuresStock` (1047 → 1046, mesuré) : la plage le lit et ne le
  // refuse pas — c'est le contrôle négatif, sur le commit même qui porte le contrôle positif.
  assert.equal(
    refus.some((r) => r.fichier === 'scripts/guards/lib/structuresStock.mjs'), false,
    'un stock qui décroît sur la plage n’est jamais refusé',
  )
})

test('fenêtre — un stock OBJET dont les valeurs sont des tableaux est rendu, avec son déclaré', () => {
  const { refus } = croissancesDeLaPlage({ cwd: RACINE, ...FENETRE_STOCK_OBJET })
  const ecrivains = refus.find((r) => r.fichier === 'scripts/gates/ecrivainsAtteints.test.mjs')
  assert.deepEqual(
    [ecrivains?.sha.slice(0, 9), ecrivains?.net, ecrivains?.declare], ['a9b7edf17', 63, 53],
    'un stock OBJET dont les valeurs sont des tableaux est rendu — la définition tableau-seul le perdait',
  )
})

// ── La mesure sur le dépôt RÉEL ───────────────────────────────────────────────────────────────────

test('CLIQUET stocks : la PLAGE POUSSÉE ne fait grossir aucun stock en silence', (t) => {
  if (!porteEnVigueur()) {
    t.diagnostic(
      `HEAD (${git('rev-parse', '--short', 'HEAD').trim()}) est ANTÉRIEUR à cette porte : sa lib n'y ` +
        'est pas, la règle ne juge que les commits qui la portent.',
    )
    return
  }
  exigerHistoireComplete()
  const { refus, notes, commits } = croissancesDeLaPlage({
    cwd: RACINE, avant: debutDeLaPlage(), apres: git('rev-parse', 'HEAD').trim(),
  })
  for (const n of notes) t.diagnostic(n)
  if (commits !== undefined) t.diagnostic(`${commits} commit(s) jugé(s)`)
  assert.deepEqual(
    refus.map((r) => `${r.sha.slice(0, 9)} ${r.fichier} +${r.net}`), [],
    raisonDeRefusDePlage(refus),
  )
})

// Sonde du juge de diff (2026-09-05) promue : un chemin écrit en GABARIT à substitution
// (`` `src/${n}.test.ts` ``) est une entrée comme une autre. La lecture par IMAGE n'en voyait aucune
// là où le REPLI en comptait deux — une porte dont la voie précise voit MOINS que sa voie de secours
// se contourne en changeant de graphie.
test('portée — une entrée écrite en GABARIT à substitution est vue par l’IMAGE comme par le repli', () => {
  const f = 'scripts/guards/lib/xTemplate.mjs'
  const post = ["const n = 'a'", 'export const S = [', '  `src/${n}.test.ts`,', '  `src/${n}b.test.ts`,', ']'].join('\n')
  const pre = ["const n = 'a'", 'export const S = [', ']'].join('\n')
  const diff = [
    `--- a/${f}`, `+++ b/${f}`, '@@ -2,1 +2,3 @@', 'export const S = [',
    '+  `src/${n}.test.ts`,', '+  `src/${n}b.test.ts`,', ']',
  ].join('\n')
  const parImage = croissanceDesStocks(diff, { lirePostImage: () => `${post}\n`, lirePreImage: () => `${pre}\n` })
  const parRepli = croissanceDesStocks(diff, REPLI)
  assert.deepEqual(parImage.map((c) => [c.fichier, c.net]), [[f, 2]])
  assert.deepEqual(parImage.map((c) => c.net), parRepli.map((c) => c.net), 'l’image ne voit pas MOINS que le repli')
})

// ── ARGUMENT D'APPEL : un paramètre n'est pas un stock (#1709 D1) ─────────────────────────────────
// Trois trains de gates perdus (2026-09-07) sur la même classe : la migration des marches d'arbre
// vers `readCorpus` écrit `readCorpus(['src/ui'])`, et l'IMAGE y lisait « +1 entrée de stock » —
// le repli de ligne, lui, n'y voyait rien. Les cliquets payés (`6382c792d`, `cc71eb45c`) NIENT tous
// leur propre croissance. Le discriminant n'est PAS la position d'argument seule (elle s'obtient
// en UNE ligne d'enveloppe) : c'est qu'un tel argument ne nomme aucun FICHIER — ce sont des
// RACINES de scan que l'appelé consomme.

const CORPUS = 'scripts/guards/lib/xCorpus.mjs'
const entreesA = (lignes) => lignesDe(`${lignes.join('\n')}\n`, CORPUS)

test('argument — le stock RÉEL d’un `const` de module reste compté (contre-preuve)', () => {
  assert.deepEqual(
    entreesA(['const X = [', "  'src/a.ts',", "  'src/b.ts',", ']']), [2, 3],
    'la correction d’argument ne doit rien coûter au cas que la porte existe pour voir',
  )
  assert.deepEqual(
    entreesA(['const X = new Set([', "  'src/a.ts',", "  'src/b.ts',", '])']), [2, 3],
    '`new Set([ … ])` PREND le littéral pour contenu : c’est un porteur',
  )
  assert.deepEqual(
    entreesA(['export const X = Object.freeze([', "  'src/a.ts',", '])']), [2],
    '`Object.freeze` est transparent : la liaison porte bien le littéral',
  )
})

// L'ASYMÉTRIE, écrite ici pour qu'elle ne se découvre pas : la MÊME liste de racines compte
// au module et ne compte pas en argument. C'est la ligne « un stock de DOSSIERS passé en ARGUMENT est
// hors de vue » de l'en-tête de `stocksNominatifs.mjs`.
test('argument — la même liste de RACINES : comptée au module, exempte en argument', () => {
  const R = ["  'src/ui',", "  'src/state',"]
  assert.deepEqual(entreesA(['const R = [', ...R, ']']), [2, 3], 'au module, une racine est une entrée')
  assert.deepEqual(entreesA(['const R = registre([', ...R, '])']), [], 'en argument, elle ne l’est plus')
})

test('argument — une liste de RACINES passée à un APPEL n’est une entrée à aucun niveau', () => {
  for (const [nom, lignes] of Object.entries({
    'appel nu': ["readCorpus(['src/ui'])"],
    'appel lié à un const de module': ["const SHEETS = readCorpus(['src/ui/styles'], { exts: ['.css'] })"],
    'appel imbriqué': ["const X = f(g(['src/ui', 'src/gameIso']))"],
    'argument multiligne': ['const X = readCorpus([', "  'src/ui',", "  'src/gameIso',", '])'],
  })) {
    assert.deepEqual(entreesA(lignes), [], nom)
  }
})

// SONDE DU JUGE DE DIFF (2026-09-07), promue en contrat : exempter TOUT argument ouvrait un
// contournement d'UNE ligne — la classe que `lignesLocales` refuse nommément (« un stock reste un
// stock, quelle que soit la façade qui le sert »). Dès qu'un FICHIER est nommé, la façade ne protège
// rien. Le repli de ligne compte 2 sur chacune de ces formes : l'image ne doit pas voir moins.
test('argument — sept FAÇADES d’une ligne ne cachent pas un stock qui NOMME des fichiers', () => {
  const E = ["  'src/a.ts',", "  'src/b.ts',"]
  for (const [nom, lignes] of Object.entries({
    'défaut exporté': ['export default defineStock([', ...E, '])'],
    'fabrique': ['export const X = registre([', ...E, '])'],
    'Array.from': ['export const X = Array.from([', ...E, '])'],
    'concat': ['export const X = [].concat([', ...E, '])'],
    'identité': ['export const X = id([', ...E, '])'],
    'gel d’une fabrique': ['export const X = Object.freeze(registre([', ...E, ']))'],
    'objet en argument': ['export const X = table({', "  'src/a.ts': 1,", "  'src/b.ts': 2,", '})'],
  })) {
    assert.deepEqual(entreesA(lignes), [2, 3], nom)
  }
})

// FRONTIÈRE mesurée : un ÉLÉMENT de stock qui nomme son fichier À TRAVERS un appel reste une
// entrée — `scripts/test/run.test.mjs:69` (`node: [abs('src/i18n/labels.test.ts'), …]`) et
// `scripts/hooks/settings-guard-canaux.test.mjs:27` (`[join(REPO, '.claude', 'settings.json'), …]`)
// sont des stocks nominatifs à part entière. La règle porte sur le PORTEUR en position d'argument :
// il n'est exempt que s'il ne nomme AUCUN fichier — un élément qui en nomme un le rend porteur.
test('argument — un ÉLÉMENT de stock qui nomme son fichier via un appel reste une entrée', () => {
  assert.deepEqual(
    entreesA(['const X = [', "  abs('src/a.test.ts'),", "  join(R, '.claude', 'settings.json'),", ']']),
    [2, 3],
  )
})

test('argument — une flèche à corps CONCIS qui APPELLE ne compte rien, mais son littéral NU compte', () => {
  assert.deepEqual(
    entreesA(["const ecranFiles = () => readCorpus(['src/ui', 'src/gameIso']);"]), [],
    'le littéral est l’argument de `readCorpus`, pas le stock que la flèche rend',
  )
  assert.deepEqual(
    entreesA(['export const stock = () => [', "  'src/a.ts',", ']']), [2],
    'la flèche qui rend le littéral LUI-MÊME reste de portée module (enveloppe d’une ligne, 2026-09-04)',
  )
})

test('argument — la forme VÉCUE, dans un `describe` comme au module, ne compte rien', () => {
  const boucle = "for (const { rel, text } of readCorpus(['src/ui'])) {"
  assert.deepEqual(entreesA([boucle, '  void rel; void text;', '}']), [], 'au niveau du module')
  assert.deepEqual(
    entreesA(["describe('x', () => {", `  ${boucle}`, '    void rel; void text;', '  }', '})']), [],
    'dans un corps de `describe`',
  )
  assert.equal(estEntreeDeStock(boucle), false, 'le repli de ligne ne l’a jamais vue : c’est l’IMAGE qui la voyait')
})
