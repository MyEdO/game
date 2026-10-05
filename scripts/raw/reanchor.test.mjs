// Test du GATE `reanchor.mjs` (#434 défaut 1 — « une réf verte peut pointer sur le mauvais texte »,
// node --test). Le cas réel (`e0cf886a` → `c54ba899`) : une réf `ZI 13 l.954` pointait sur un texte
// hors-sujet, quand le vrai passage vivait en `ZI 2 l.68` — `reanchor.mjs` l'avait dans son rapport
// (LOW + « texte trouvé en ZI 2 l.68 ») mais ne bloquait rien. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { ecartDeRegeneration, texteEnPlace } from '../guards/lib/stockDeSites.mjs'
import { buildIndex, chapitreDuParagraphe, chapitresDeLaSection, citationsEnTete, classifyQuote, continuations, regenerations, scan, sitesLow, RAWDIR } from './reanchor.mjs'
import { avecAtlasFixture } from './atlasFixture.mjs'

// La fiche vit SOUS un cœur : un Atlas est PARTITIONNÉ, et la couture refuse une page de règles
// posée à sa racine. Fabrique PARTAGÉE avec les autres bancs de lecteurs (`atlasFixture.mjs`).
const withTempRawDir = (content, fn) =>
  avecAtlasFixture({ 'fixture.md': content }, (dir, coeur) => fn(dir, `${coeur}/fixture.md`), { prefixe: 'reanchor-' })
/** Source de catalogues d'un Atlas de fixture : aucun (`pagesDeLAtlasRendues`). */
const AUCUN_CATALOGUE = () => new Map()

// ---------- classifyQuote (pur, fixtures synthétiques — reproduit la FORME du bug réel) ----------

test('citation absente ici mais présente dans un AUTRE chapitre → LOW, réf trouvée pointée en réponse (cas réel ZI 13→ZI 2)', () => {
  // « chapitre 13 » ne contient PAS le texte cité (topic Fouissement hors-sujet, comme le vrai bug).
  const li13 = buildIndex(['Introduction du chapitre.', '**DR nécessaires :** 18', 'Suite sans rapport.'])
  // « chapitre 2 » contient le VRAI texte, à la ligne 68 dans le cas réel — ici une ligne connue de la fixture.
  const _li2 = buildIndex(['pad', 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.'])
  const findCross = () => ({ label: 'ZI 2 l.68' })   // simule crossChapter() ayant trouvé l'unique occurrence
  const r = classifyQuote(li13, 954, 'Cette créature peut se déplacer en creusant un tunnel dans le sol meuble.', findCross)
  assert.equal(r.status, 'LOW')
  assert.match(r.reason, /texte trouvé en ZI 2 l\.68/)
})

test('citation absente ici et nulle part ailleurs → LOW, "aucune occurrence"', () => {
  const li = buildIndex(['Rien à voir avec la citation cherchée.'])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'LOW')
  assert.equal(r.reason, 'aucune occurrence')
})

test('citation juste à la ligne citée → OK, silencieux', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 2, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'OK')
})

test('citation présente mais à une AUTRE ligne du MÊME chapitre → DRIFT (réparable --apply)', () => {
  const li = buildIndex(['avant', 'Une phrase suffisamment longue pour être une ancre verbatim valide.', 'après'])
  const r = classifyQuote(li, 3, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'DRIFT')
  assert.equal(r.foundStart, 2)
})

test('citation dupliquée (occurrences multiples) → MEDIUM, jamais auto-résolu', () => {
  const li = buildIndex([
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
    'x',
    'Une phrase suffisamment longue pour être une ancre verbatim valide.',
  ])
  const r = classifyQuote(li, 1, 'Une phrase suffisamment longue pour être une ancre verbatim valide.', () => null)
  assert.equal(r.status, 'MEDIUM')
  assert.deepEqual(r.candidates, [1, 3])
})

// ---------- scan() bout en bout (docs/raw temporaire + chapitre RÉEL LDB 6, patron check-refs.test.mjs) ----------

const LDB6_LINE5 = "*(Page 48 partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l'extraction Marker.)*"

test('scan() : citation juste → silencieuse (pas de ligne LOW, pas dans lowRows)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.equal(r.tally.OK, 1)
    assert.equal(r.tally.LOW, 0)
    assert.equal(r.lowRows.length, 0)
  })
})

test('scan() : citation introuvable dans le chapitre cité → LOW, alimente lowRows (unité du cliquet)', () => {
  const md = `Une note.\n> « Une phrase qui n'existe nulle part dans ce chapitre source. »\n> \`LDB 6 l.5\`\n`
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.equal(r.tally.LOW, 1)
    assert.equal(r.lowRows.length, 1)
    assert.equal(basename(r.lowRows[0].doc), 'fixture.md', 'le site NOMME la fiche où la réf est lue')
    assert.equal(r.lowRows[0].doc, `${dir.split('\\').join('/')}/${relatif}`, 'chemin de la fiche depuis la racine du balayage, CŒUR COMPRIS, en séparateurs /')
    assert.equal(r.lowRows[0].full, 'LDB 6 l.5', 'et la RÉF CITÉE telle qu’écrite')
    assert.deepEqual(sitesLow(r.lowRows), [{ file: r.lowRows[0].doc, ref: 'LDB 6 l.5' }])
  })
})

test('scan() : citation présente mais à une autre ligne du chapitre RÉEL → DRIFT (réparable, jamais silencieux)', () => {
  const md = `Une note.\n> « ${LDB6_LINE5} »\n> \`LDB 6 l.3\`\n`
  withTempRawDir(md, (dir) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.equal(r.tally.DRIFT, 1)
    assert.equal(r.tally.OK, 0)
  })
})

// ---------- cliquet NOMINATIF (mêmes primitives que check-code-refs.mjs / citation-graphy-guard.mjs) ----------

test('écart : un site ❌ LOW hors du stock est NEUF, une entrée sans site est SOLDÉE, les deux nommés', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesLow([{ doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' }]),
    stock: [{ fichier: 'docs/raw/4e/magie.md', ref: 'LDB 6 l.5', occurrence: 1 }],
    ou: 'reanchor-low-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /docs\/raw\/[\w-]+\/bestiaire\.md :: ZI 13 l\.954 :: 1 — site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /docs\/raw\/[\w-]+\/magie\.md/)
  assert.match(perimees[0], /entrée SOLDÉE/)
})

test('écart : deux sites de la MÊME réf dans la MÊME fiche se distinguent par leur OCCURRENCE', () => {
  const sites = sitesLow([
    { doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' },
    { doc: 'docs/raw/4e/bestiaire.md', full: 'ZI 13 l.954' },
  ])
  const stock = [
    { fichier: 'docs/raw/4e/bestiaire.md', ref: 'ZI 13 l.954', occurrence: 1 },
    { fichier: 'docs/raw/4e/bestiaire.md', ref: 'ZI 13 l.954', occurrence: 2 },
  ]
  const couvert = ecartDuVolet({ sites, stock, ou: 'reanchor-low-stock.json' })
  assert.deepEqual([couvert.neuves, couvert.perimees], [[], []], 'deux entrées d’occurrences distinctes couvrent les deux sites')
  const { neuves } = ecartDuVolet({ sites, stock: stock.slice(0, 1), ou: 'reanchor-low-stock.json' })
  assert.equal(neuves.length, 1, 'le second site n’est pas couvert par l’entrée du premier')
})

// ---------- auto-cohérence sur le VRAI Atlas (le cliquet vaut pour de vrai, pas seulement en fixture) ----------

test('régime ZÉRO-TOLÉRANCE (#1898) : le VRAI Atlas n’a aucun site ❌ LOW, et reanchor-low-stock.json reste ABSENT', () => {
  const r = scan(RAWDIR, {})
  assert.deepEqual(sitesLow(r.lowRows).map((x) => `${x.file} :: ${x.ref}`), [], 'réf(s) ❌ LOW : la citation est introuvable à la ligne annoncée')
  for (const x of regenerations(r.lowRows)) assert.equal(ecartDeRegeneration(x, texteEnPlace(x.chemin)), null)
  // #2199 : la citation à réf EN TÊTE se lit aussi — aucune dérive, aucune ambiguïté, aucune réf nue sans chapitre.
  assert.deepEqual({ DRIFT: r.tally.DRIFT, MEDIUM: r.tally.MEDIUM, 'NO-SOURCE': r.tally['NO-SOURCE'] }, { DRIFT: 0, MEDIUM: 0, 'NO-SOURCE': 0 },
    r.sections.flatMap((x) => x.rows.filter((w) => w.status !== 'RANGE').map((w) => `${x.file} ${w.full} ${w.status} ${w.detail}`)).join('\n'))
})

// ---------- citation à réf EN TÊTE (#2199) : `> **Verbatim** (l.X) : « … »`, `LDB 59 l.43 : « … »` ----------

test('citationsEnTete : la réf qui PRÉCÈDE « : « » porte la citation, nue ou à sigle, en groupe ou avec libellé', () => {
  const vu = (l, suite) => citationsEnTete(l, suite).map((c) => [c.ecrit, c.abbr, c.ch, c.depart, c.citation.trim()])
  assert.deepEqual(vu('> **Verbatim** (l.24) : « Pour lancer un Sort. »'), [['l.24', null, null, 24, 'Pour lancer un Sort.']])
  assert.deepEqual(vu('> Verbatim LDB 59 l.43 : « Marchandage est couramment utilisé »'), [['LDB 59 l.43', 'LDB', '59', 43, 'Marchandage est couramment utilisé']])
  assert.deepEqual(vu('> **Verbatim Sort** (`LDB 47 l.15`) : « Pour chaque +2 DR »'), [['LDB 47 l.15', 'LDB', '47', 15, 'Pour chaque +2 DR']])
  assert.deepEqual(vu('> **Verbatim** (l.160, l.162) : « Premier. » / « Second. »').map((c) => [c[3], c[4]]), [[160, 'Premier.'], [162, 'Second.']])
  assert.deepEqual(vu('> **Verbatim** *Silence* (l.349 → l.351) : « Début » … « fin. »').map((c) => [c[3], c[4]]), [[349, 'Début'], [351, 'fin.']])
  assert.deepEqual(vu('> **Verbatim** (l.205, *Bourbier vivant*) : « Tant qu’il est pris. »').map((c) => c[3]), [205])
  assert.deepEqual(vu('(`VDM 02 l.5`, l.7) : « Bien entendu »').map((c) => [c.slice(1, 4), c[4]].flat()), [['VDM', '02', 5, 'Bien entendu']])
  assert.deepEqual(vu('> LDB 61 l.4 : « Le nombre de Points', ['> d’Encombrement est »']).map((c) => c[4]), ['Le nombre de Points d’Encombrement est'])
  assert.deepEqual(vu('(`EDO 12 l.81` : « \\| Wellentag \\| 1 \\| »)').map((c) => c[4]), ['| Wellentag | 1 |'], 'le `\\|` de cellule est le `|` cité')
  assert.deepEqual(vu('- CC : LDB 05 l.345 — « votre capacité »').map((c) => [c[0], c[4]]), [['LDB 05 l.345', 'votre capacité']], 'lien au tiret cadratin')
  assert.deepEqual(vu('- `AA 07 l.11` – « Une fois tous »').map((c) => c[0]), ['AA 07 l.11'], 'lien au tiret demi-cadratin')
  assert.deepEqual(vu('**6. Esquive à cheval -20 (l.184).** *« Lorsque vous chevauchez »*').map((c) => [c[0], c[4]]), [['l.184', 'Lorsque vous chevauchez']], 'titre gras puis citation en italique')
})

test('citationsEnTete : faux positifs écartés par la FORME — deux-points sans citation, citation AVANT la réf, ligne Implémente', () => {
  assert.deepEqual(citationsEnTete('> **Ruleset** (`VDM 02 l.5-7`) : VDM 02 propose des règles'), [], 'deux-points suivis de prose')
  assert.deepEqual(citationsEnTete('> « Texte cité » (LDB 6 l.5) : commentaire'), [], 'la réf SUIT la citation : chemin `extractQuote`')
  assert.deepEqual(citationsEnTete('- `LDB 46` (l.5-9) → `miscast-mineure`'), [], 'ligne Implémente')
})

test('chapitre d’une réf nue : la réf à sigle de son paragraphe, sinon l’en-tête « Sources RAW » de sa section', () => {
  const lignes = ['## A', '', '**Sources RAW :** `LDB 46 l.5-9` · `LDB 13 l.110`', '', 'Prose `MDG 13 l.354-420` puis', 'la suite (l.418 : « x »)', '', '> **Verbatim** (l.7) : « y »', '## B', '> **Verbatim** (l.9) : « z »']
  assert.deepEqual(chapitreDuParagraphe(lignes, 5, 10), { abbr: 'MDG', ch: '13' })
  assert.equal(chapitreDuParagraphe(lignes, 7, 3), null)
  assert.deepEqual(chapitresDeLaSection(lignes, 7), [{ abbr: 'LDB', ch: '46' }, { abbr: 'LDB', ch: '13' }])
  assert.deepEqual(chapitresDeLaSection(lignes, 9), [], 'le titre `##` ferme la remontée')
})

const MONTE = "Lorsque vous chevauchez, vous subissez une pénalité de -20 pour toute tentative d'utiliser la Compétence Esquive"
const CC = "votre capacité à vous battre au Corps à corps, à exécuter une frappe mesurée, et de votre efficacité dans le tumulte d'une mêlée générale."

test('scan() : réf au tiret décalée → DRIFT ; `(l.X).** *« … »*` décalée, chapitre de section → 🟡 à trancher (LDB 05 l.345, LDB 14 l.184 réels)', () => {
  withTempRawDir(`## S\n\n- CC : LDB 05 l.300 — « ${CC} »\n`, (dir) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.deepEqual([r.tally.DRIFT, r.sections[0]?.rows[0]?.found], [1, 345])
  })
  withTempRawDir(`## S\n\nle Combat monté (LDB 14 l.177).\n\n**6. Esquive à cheval -20 (l.150).** *« ${MONTE} »*\n`, (dir) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.deepEqual([r.tally.DRIFT, r.tally.MEDIUM, r.sections[0]?.rows[0]?.found], [0, 1, 184], 'chapitre déduit de la section : signalé, jamais réparé')
  })
})

const HEMO = 'Une fois tous les États *Hémorragique* retirés, gagnez un État *Exténué*.'

test('scan() : un lien DÉDUIT ne se répare jamais seul — 🟡 à trancher, porte rouge, fiche INCHANGÉE après --apply', () => {
  const cas = {
    'FP-a : titre derrière une PLAGE de synthèse, lien par simple blanc': `## Poursuite\n\n- Étapes de la poursuite (LDB 15 l.90-108) « Modificateurs de Mouvement » : différence de M = DR bonus.\n`,
    'FP-b : réf nue, chapitre pris à une AUTRE réf de la section': `## Hémorragie\n\nMise à jour d'Aux Armes (AA 07 l.3).\n\nAu livre de base (l.109) « ${HEMO} »\n`,
  }
  for (const [nom, md] of Object.entries(cas)) {
    withTempRawDir(md, (dir, relatif) => {
      const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
      assert.deepEqual([r.tally.DRIFT, r.tally.MEDIUM], [0, 1], nom)
      scan(dir, { catalogues: AUCUN_CATALOGUE, apply: true })
      assert.equal(readFileSync(join(dir, relatif), 'utf8'), md, `${nom} : --apply n’écrit rien`)
    })
  }
  withTempRawDir(`## Hémorragie\n\nMise à jour d'Aux Armes (AA 07 l.3).\n\nAu livre de base (LDB 16 l.109) « ${HEMO} »\n`, (dir) => {
    assert.equal(scan(dir, { catalogues: AUCUN_CATALOGUE }).tally.OK, 1, 'témoin : la réf à sigle explicite reste juste')
  })
})

test('scan() : `> **Verbatim** (l.X)` nue, chapitre lu à l’en-tête — juste → OK, décalée → DRIFT réécrite par --apply, sans chapitre → NO-SOURCE', () => {
  const juste = `## S\n\n**Sources RAW :** \`LDB 6 l.5\`\n\n> **Verbatim** (l.5) : « ${LDB6_LINE5} »\n`
  withTempRawDir(juste, (dir) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.equal(r.tally.OK, 1)
    assert.equal(r.tally.DRIFT, 0)
  })
  withTempRawDir(juste.replace('(l.5)', '(l.3)'), (dir, relatif) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE })
    assert.equal(r.tally.DRIFT, 1, 'la citation n’est pas à la ligne annoncée')
    scan(dir, { catalogues: AUCUN_CATALOGUE, apply: true })
    assert.match(readFileSync(join(dir, relatif), 'utf8'), /\(l\.5\) : «/)
  })
  withTempRawDir(`## S\n\n> **Verbatim** (l.5) : « ${LDB6_LINE5} »\n`, (dir) => {
    assert.equal(scan(dir, { catalogues: AUCUN_CATALOGUE }).tally['NO-SOURCE'], 1)
  })
})

// ---------- --remap : carte de lignes EXACTE (#1739), continuations nues comprises ----------
// La carte est INJECTÉE (`carteDe`) : aucun diff git n'est lu. Le chapitre `CRB 075` réel ne sert
// qu'aux bornes (46 lignes) ; les réfs n'y portent aucune citation — ce sont des réfs de SYNTHÈSE.

test('continuations : un `l.N` nu hérite de la réf qui le PRÉCÈDE sur sa ligne, jamais au-delà d’une cellule de table', () => {
  assert.deepEqual(continuations('- `CRB 075 l.24`, `l.26` — texte').map((c) => [c.abbr, c.ch, c.depart]), [['CRB', '075', 26]])
  assert.deepEqual(continuations('| `CRB 075 l.24` | `l.26` |'), [], 'autre cellule : aucun hôte')
  assert.deepEqual(continuations('- `l.26` seul'), [], 'sans réf qui précède : pas une réf')
  assert.deepEqual(continuations('(`CRB 024 l.7-9`, `l.29-31`)').map((c) => c.full), ['l.29-31'])
})

// Carte forgée : l.24 → l.23 (une ligne ôtée avant), l.26 → l.25, l.30 supprimée, l.32 dans un hunk ambigu.
const CARTE_FORGEE = (n) => n === 30 ? { supprimee: true } : n === 32 ? { ambigue: true, candidates: [30, 31] } : { ligne: n - 1 }

test('--remap : réf directe ET continuation nue réécrites par la carte', () => {
  const md = '- `CRB 075 l.24`, `l.26` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE, remap: true, carteDe: () => CARTE_FORGEE })
    assert.deepEqual(r.nonRemappees, [])
    assert.equal(r.remappedTotal, 2)
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), '- `CRB 075 l.23`, `l.25` — synthèse\n')
  })
})

test('--remap : une réf vers une ligne SUPPRIMÉE ou AMBIGUË est RAPPORTÉE avec son site, jamais réécrite', () => {
  const md = '- `CRB 075 l.30`, `l.32` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE, remap: true, carteDe: () => CARTE_FORGEE })
    assert.deepEqual(r.nonRemappees.map((n) => [basename(n.doc), n.ligne, n.full, n.detail]), [
      ['fixture.md', 1, 'CRB 075 l.30', 'l.30 : ligne supprimée'],
      ['fixture.md', 1, 'l.32', 'l.32 : hunk ambigu, candidates l.30/31'],
    ])
    assert.equal(r.remappedTotal, 0)
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), md)
  })
})

test('--remap : une réf dont le chapitre n’a PAS de carte (absent de HEAD) est RAPPORTÉE, jamais passée sous silence', () => {
  const md = '- `CRB 075 l.24`, `l.26` — synthèse\n'
  withTempRawDir(md, (dir, relatif) => {
    const r = scan(dir, { catalogues: AUCUN_CATALOGUE, remap: true, carteDe: () => null })
    assert.deepEqual(r.nonRemappees.map((n) => [n.full, n.detail]), [
      ['CRB 075 l.24', 'chapitre absent de HEAD'],
      ['l.26', 'chapitre absent de HEAD'],
    ])
    assert.equal(readFileSync(join(dir, relatif), 'utf8'), md)
  })
})
