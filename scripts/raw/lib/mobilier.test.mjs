// Banc du prédicat de MOBILIER DE PAGE (`lib/mobilier.mjs`, #1739) : O tiré de la donnée `onglets`,
// les trois familles de sites (onglet seul, folios de tête, onglet mot), l'exclusion des en-têtes de PROFIL, le retrait d'un jeton.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chiffresDes, exempter, exemptionDe, exemptionsFausses, fenetreDe, sansJeton, sitesDeMobilier, sitesDuFichier } from './mobilier.mjs'

const ONGLETS = [{ chiffre: 'I', pages: [3, 7] }, { chiffre: 'II', pages: [23, 41] }, { chiffre: 'III', pages: [43, 107] }]

test('O : les chiffres dont l’étendue RENCONTRE la fenêtre de pages — une page paire de frontière n’en porte aucun', () => {
  assert.deepEqual([...chiffresDes(ONGLETS, [41, 43])], ['II', 'III'])
  assert.deepEqual([...chiffresDes(ONGLETS, [42, 42])], [])
  assert.deepEqual([...chiffresDes(ONGLETS, fenetreDe({ page: 22, pageFin: 22 }))], ['II'])
  assert.deepEqual([...chiffresDes(null, [1, 400])], [])
})

test('(a) une ligne RÉDUITE à un chiffre de O ou à un folio de la plage est un site ; hors O ou hors plage, non', () => {
  const texte = ['III', '', 'IV', '', '58', '', '12', '', '  III  '].join('\n')
  const sites = sitesDeMobilier(texte, { O: new Set(['III']), folios: [43, 108] })
  assert.deepEqual(sites.map((s) => [s.ligne, s.classe, s.jeton]), [[1, 'romain-seul', 'III'], [5, 'folio-nu', '58'], [9, 'romain-seul', 'III']])
})

test('(b) un chiffre de O comme MOT ISOLÉ hors gras est un site, à sa position ; dans le gras ou collé, non', () => {
  const O = new Set(['V'])
  const t = ['# **POISONS** V', 'V **Aimed Shots** text', '# **APPENDIX V**', 'Vx and xV', '| TITRE | V |'].join('\n')
  const sites = sitesDeMobilier(t, { O, folios: [0, 0] })
  assert.deepEqual(sites.map((s) => [s.ligne, s.debut]), [[1, 14], [2, 0], [5, 10]])
})

test('(b) les cellules d’EN-TÊTE d’une table de PROFIL (≥ 3 abréviations de Caractéristique) sont exclues ; ses rangées, non', () => {
  const t = ['| CC | CT | F | E | I | Ag |', '|----|----|---|---|---|----|', '| 30 | 25 | 30 | 30 | I | 30 |'].join('\n')
  const sites = sitesDeMobilier(t, { O: new Set(['I']), folios: [0, 0] })
  assert.deepEqual(sites.map((s) => s.ligne), [3])
  const deux = ['| CC | I |', '|----|---|'].join('\n')
  assert.deepEqual(sitesDeMobilier(deux, { O: new Set(['I']), folios: [0, 0] }).map((s) => s.ligne), [1])
})

test('sitesDuFichier tire O et la plage de folios de l’entrée de découpe', () => {
  const sites = sitesDuFichier('II\n\n25\n\n# **X** III\n\nI', { page: 23, pageFin: 24 }, ONGLETS)
  assert.deepEqual(sites.map((s) => [s.ligne, s.classe, s.jeton]), [[1, 'romain-seul', 'II'], [3, 'folio-nu', '25']])
})

test('exemptionDe : même fichier ET motif qui tient au texte de la ligne', () => {
  const e = { fichier: 'S/004 - X.md', motif: /^I am no stranger/, jetons: 2 }
  const texte = 'I am no stranger to radical thought'
  assert.equal(exemptionDe(texte, 'S/004 - X.md', [e]), e)
  assert.equal(exemptionDe(texte, 'S/005 - X.md', [e]), null)
  assert.equal(exemptionDe('I am a stranger', 'S/004 - X.md', [e]), null)
})

test('exempter : une exemption couvre ses `jetons` sites de la ligne, PAS UN DE PLUS — un onglet ajouté reste un site', () => {
  const e = { fichier: 'S/004 - X.md', motif: /^Alas, I neglected/, jetons: 1 }
  const O = new Set(['I'])
  const juste = sitesDeMobilier('Alas, I neglected to consider', { O, folios: [0, 0] })
  assert.deepEqual(exempter(juste, 'S/004 - X.md', [e]).map((s) => s.exemption), [e])
  const ajoute = sitesDeMobilier('Alas, I neglected to consider I', { O, folios: [0, 0] })
  const poses = exempter(ajoute, 'S/004 - X.md', [e])
  assert.deepEqual(poses.map((s) => [s.debut, s.exemption]), [[6, e], [30, null]])
  assert.deepEqual(exemptionsFausses(poses, [e]), [])
  assert.deepEqual(exemptionsFausses([], [e]), [{ exemption: e, couverts: 0 }])
})

test('sansJeton : une espace entre deux textes, rien en bord de ligne ; la cellule de table garde sa largeur', () => {
  assert.equal(sansJeton('# **POISONS** V', 14, 'V'), '# **POISONS**')
  assert.equal(sansJeton('V **Aimed Shots** text', 0, 'V'), '**Aimed Shots** text')
  assert.equal(sansJeton('# V **EXAMPLE OUTCOMES**', 2, 'V'), '# **EXAMPLE OUTCOMES**')
  assert.equal(sansJeton('carry sceptres to XI indicate', 18, 'XI'), 'carry sceptres to indicate')
  assert.equal(sansJeton('| TITRE | V |', 10, 'V'), '| TITRE |   |')
  assert.throws(() => sansJeton('abc', 0, 'V'), /absent/)
})

test('(b) FOLIOS en tête de ligne (CRB) : seuls, derrière `#`, ou soudés en tête de prose — un site par nombre, à sa position', () => {
  const t = ['# 274 274 275', '288 289', "298 299 *Fatigued* Conditions are accrued at the end of a day's travel", "314 315 **Wizard's Robes:** Elaborate robes"].join('\n')
  const sites = sitesDeMobilier(t, { O: new Set(), folios: [272, 316] })
  assert.deepEqual(sites.map((s) => [s.ligne, s.classe, s.jeton, s.debut]), [
    [1, 'folio-nu', '274', 2], [1, 'folio-nu', '274', 6], [1, 'folio-nu', '275', 10],
    [2, 'folio-nu', '288', 0], [2, 'folio-nu', '289', 4],
    [3, 'folio-tete', '298', 0], [3, 'folio-tete', '299', 4],
    [4, 'folio-tete', '314', 0], [4, 'folio-tete', '315', 4],
  ])
})

test('(b) faux positifs réels : un nombre de tête HORS de la fenêtre, ou une suite qui en sort d’un seul, n’est pas un folio', () => {
  const t = ['1 gold crown (1 GC) = 20 silver shillings (20/–) = 240 brass pennies (240d)', '10 Shots *or* 5 Throwing Knives, Garotte, Poison', '298 12 soldiers', '40–42: Levy'].join('\n')
  assert.deepEqual(sitesDeMobilier(t, { O: new Set(), folios: [295, 299] }), [])
})

test('sitesDuFichier : la fenêtre des folios s’ouvre à `page - 1` — le folio de gauche de la double page (CRB 085:51)', () => {
  const sites = sitesDuFichier('298 299 *Fatigued* Conditions', { page: 299, pageFin: 299 }, ONGLETS)
  assert.deepEqual(sites.map((s) => s.jeton), ['298', '299'])
  assert.deepEqual(sitesDuFichier('297 text', { page: 299, pageFin: 299 }, ONGLETS), [])
})
