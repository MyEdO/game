// Banc de la migration `2026-09-14-1699-source-chemins-ascii.mjs` — joué sur un DÉPÔT JETABLE
// (`instanceDeDepot`), jamais sur l'arbre réel : les gestes y sont de vrais `git mv` et de vraies
// écritures. Le banc vit sous `lib/` parce que `replay.mjs` REJOUE tout `.mjs` daté posé à la racine
// des migrations (un `*.test.mjs` daté y serait exécuté comme une migration).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { migrer, planDeRenommage, reecrireChemins, reecrireLiensRelatifs, couplesTextuels, couplesDeBasenames, formeWindows, formeEchappee, STOCK_ANCRES_VIDES } from '../2026-09-14-1699-source-chemins-ascii.mjs'
import { lancerGit } from '../../test/gitDeBanc.mjs'

const LIVRE = "Source/Livre d'Épreuve é"
const CHAPITRE = `${LIVRE}/01 - Côte de l'Ostland.md`
const INDEX = `${LIVRE}/00 - Index.md`
const CORPS_CHAPITRE = `*Pages PDF 7*

Un chapitre dont le CONTENU ne bouge pas d'un octet.
`
const CORPS_INDEX = `# Livre — Index

- [01 - Côte de l'Ostland](<01 - Côte de l'Ostland.md>) — folio 7
`
const DOC_VIVANT = `Trois formes du même chemin :
POSIX \`${CHAPITRE}\`
Windows \`${formeWindows(CHAPITRE)}\`
Littéral \`${formeEchappee(CHAPITRE)}\`
Et une citation NUE du basename, comme en commentaire : \`01 - Côte de l'Ostland.md\`
Et le NOM DE DOSSIER nu, comme en colonne de table : \`Livre d'Épreuve é/\`
La PROSE, elle, nomme l'ouvrage et ne bouge pas : *L'Épreuve é*
`
// Le `file` du stock nomme À DESSEIN un chapitre ABSENT du corpus de la fixture : le pas 6 est ainsi
// jugé SEUL (sur un basename du corpus, le second jeu de couples du pas 5 le réécrirait déjà).
const STOCK = `{
  "seuil": 200,
  "perdues": [
    {
      "ref": "XX 1",
      "file": "07 - Chimère.md",
      "folio": 7,
      "pdfChars": 1500
    }
  ],
  "benignes": []
}
`

// Chemins de FIXTURE (dans le dépôt jetable, jamais dans celui-ci) composés à l'exécution depuis un
// SEGMENT, pour deux raisons : écrits en clair, `docs:check` les lirait comme des citations de docs de
// CE dépôt et les déclarerait mortes ; écrits en éléments de littéral, ils feraient de ce banc un
// PORTEUR D'ENTRÉES au sens de `scripts/guards/lib/stocksNominatifs.mjs` — une fixture n'est pas un
// stock, et ne doit pas coûter un cliquet.
const DOCS = 'docs'
const DOC_VIF = `${DOCS}/vivant.md`
const DOC_ARCHIVE = `${DOCS}/plans/2026-01-01-archive.md`

const fixture = () => instanceDeDepot({
  fichiers: {
    '.gitignore': `*.pdf
`,
    [CHAPITRE]: CORPS_CHAPITRE,
    [INDEX]: CORPS_INDEX,
    [DOC_VIF]: DOC_VIVANT,
    [DOC_ARCHIVE]: DOC_VIVANT,
    [STOCK_ANCRES_VIDES]: STOCK,
  },
})

const suivis = (racine) => lancerGit(['-c', 'core.quotePath=false', 'ls-files', '--', 'Source'], { cwd: racine })
  .split(/\r?\n/).filter(Boolean)

test('la migration renomme, réécrit les trois formes, suit les liens et laisse les chapitres byte-identiques', () => {
  const { racine } = fixture()
  // PDF gitignoré homonyme du dossier — présent sur le disque, invisible de git.
  writeFileSync(join(racine, `${LIVRE}.pdf`), 'pdf-factice')

  const r = migrer({ racine, apply: true, ecrire: () => {} })

  assert.deepEqual(r.collisions, [])
  assert.equal(r.dossiers, 1)
  assert.equal(r.fichiers, 1)
  assert.equal(r.pdf, 1)
  assert.equal(r.liens, 1)
  assert.equal(r.stock, 1)

  const apres = suivis(racine)
  assert.ok(apres.every((f) => [...f].every((c) => c.codePointAt(0) >= 0x20 && c.codePointAt(0) <= 0x7e)), apres.join(' | '))
  const livreAscii = "Source/Livre d'Epreuve e"
  const chapitreAscii = `${livreAscii}/01 - Cote de l'Ostland.md`
  assert.ok(apres.includes(chapitreAscii), apres.join(' | '))

  // CHAPITRE : byte-identique.
  assert.equal(readFileSync(join(racine, chapitreAscii), 'utf8'), CORPS_CHAPITRE)
  // INDEX : seule la CIBLE du lien change (le libellé, lui, est du texte).
  assert.equal(
    readFileSync(join(racine, `${livreAscii}/00 - Index.md`), 'utf8'),
    `# Livre — Index

- [01 - Côte de l'Ostland](<01 - Cote de l'Ostland.md>) — folio 7
`,
  )
  // DOC VIVANT : les trois formes.
  const doc = readFileSync(join(racine, DOC_VIF), 'utf8')
  assert.ok(doc.includes(chapitreAscii), doc)
  assert.ok(doc.includes(formeWindows(chapitreAscii)), doc)
  assert.ok(doc.includes(formeEchappee(chapitreAscii)), doc)
  // BASENAME cité nu (pas 5, second jeu de couples) : un commentaire ne ment plus.
  assert.ok(doc.includes("`01 - Cote de l'Ostland.md`"), doc)
  // NOM DE DOSSIER cité nu (même jeu de couples) — et la PROSE voisine, qui nomme l'ouvrage par son
  // TITRE et non par son dossier, reste à l'octet.
  assert.ok(doc.includes("`Livre d'Epreuve e/`"), doc)
  assert.ok(doc.includes("*L'Épreuve é*"), doc)
  assert.equal(r.basenames, 2)
  assert.deepEqual(r.ambigus, [])
  // ARCHIVE DATÉE : intacte.
  assert.equal(readFileSync(join(racine, DOC_ARCHIVE), 'utf8'), DOC_VIVANT)
  // PDF gitignoré : renommé sur le disque.
  assert.ok(existsSync(join(racine, `${livreAscii}.pdf`)), 'le PDF ignoré homonyme n’a pas suivi')
  assert.ok(!existsSync(join(racine, `${LIVRE}.pdf`)))
  // STOCK keyé par basename.
  assert.match(readFileSync(join(racine, STOCK_ANCRES_VIDES), 'utf8'), /"file": "07 - Chimere\.md"/)

  // SECOND PASSAGE : 0 geste.
  const r2 = migrer({ racine, apply: true, ecrire: () => {} })
  assert.equal(r2.gestes, 0, JSON.stringify(r2))
})

test('pas 3 INDÉPENDANT du plan git : aucun chemin suivi non ASCII, un PDF ignoré accentué est quand même renommé', () => {
  const { racine } = instanceDeDepot({
    fichiers: { '.gitignore': `*.pdf
`, 'Source/Livre ASCII/01 - Chapitre.md': CORPS_CHAPITRE },
  })
  writeFileSync(join(racine, 'Source/Livre é.pdf'), 'pdf-factice')
  const r = migrer({ racine, apply: true, ecrire: () => {} })
  assert.equal(r.dossiers, 0)
  assert.equal(r.fichiers, 0)
  assert.equal(r.pdf, 1)
  assert.ok(existsSync(join(racine, 'Source/Livre e.pdf')))
})

test('COLLISION : deux chemins convergent — rien n’est écrit, la migration le NOMME', () => {
  const { racine } = instanceDeDepot({
    fichiers: {
      'Source/Livre/01 - Côte.md': CORPS_CHAPITRE,
      'Source/Livre/01 - Cote.md': CORPS_CHAPITRE,
    },
  })
  const lignes = []
  const r = migrer({ racine, apply: true, ecrire: (l) => lignes.push(l) })
  assert.equal(r.collisions.length, 1)
  assert.match(r.collisions[0], /Source\/Livre\/01 - Cote\.md/)
  assert.ok(lignes.some((l) => /COLLISION/.test(l)))
  assert.deepEqual(suivis(racine).sort(), ['Source/Livre/01 - Cote.md', 'Source/Livre/01 - Côte.md'])
})

test('COLLISION DE DOSSIERS à basenames DISJOINTS : la fusion silencieuse est refusée', () => {
  const { racine } = instanceDeDepot({
    fichiers: {
      'Source/Créatures/01 - A.md': CORPS_CHAPITRE,
      'Source/Creatures/02 - B.md': CORPS_CHAPITRE,
    },
  })
  const r = migrer({ racine, apply: true, ecrire: () => {} })
  // Aucun FICHIER ne converge (basenames disjoints) : seule la porte de DOSSIER voit la fusion.
  assert.equal(r.collisions.length, 1)
  assert.match(r.collisions[0], /^DOSSIER Source\/Creatures <= /)
  assert.equal(suivis(racine).filter((f) => f.startsWith('Source/Créatures/')).length, 1)
})

test('basenames : uniques réécrits, AMBIGUS (portés par plusieurs livres) rendus à part', () => {
  const suivisPlan = [
    'Source/Aé/00 - Index.md',
    'Source/Bé/00 - Index.md',
    'Source/Aé/01 - Unique é.md',
  ]
  const { mappe } = planDeRenommage(suivisPlan)
  const { uniques, ambigus } = couplesDeBasenames(suivisPlan, mappe)
  // Le basename unique ET les deux noms de DOSSIER de 1er niveau (uniques par construction).
  assert.deepEqual(uniques, [['01 - Unique é.md', '01 - Unique e.md'], ['Aé', 'Ae'], ['Bé', 'Be']])
  assert.deepEqual(ambigus, [])
  const { mappe: m2 } = planDeRenommage(['Source/A/01 - Côte.md', 'Source/B/01 - Côte.md'])
  const r2 = couplesDeBasenames(['Source/A/01 - Côte.md', 'Source/B/01 - Côte.md'], m2)
  assert.deepEqual(r2.uniques, [])
  assert.deepEqual(r2.ambigus, [['01 - Côte.md', '01 - Cote.md']])
})

test('un titre vidé reste dans la forme canonique `NN - <titre>.md`', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'Source/Livre/12 - ￼.md': CORPS_CHAPITRE } })
  migrer({ racine, apply: true, ecrire: () => {} })
  assert.deepEqual(suivis(racine), ['Source/Livre/12 - Sans titre.md'])
})

test('hors dépôt git : 0 geste, aucune levée', () => {
  const lignes = []
  const r = migrer({ racine: join(process.env.TEMP ?? '/tmp', 'aucun-depot-1699'), apply: true, ecrire: (l) => lignes.push(l) })
  assert.equal(r.gestes, 0)
  assert.ok(lignes.some((l) => /pas un dépôt git/.test(l)))
})

test('le plan renomme les DOSSIERS d’abord, par profondeur croissante, et la clé de lien est un chemin COMPLET', () => {
  const { gestesDossiers, gestesFichiers, mappe } = planDeRenommage([
    'Source/Aé/Bé/01 - Cé.md',
    'Source/Aé/01 - Cé.md',
  ])
  assert.deepEqual(gestesDossiers.map((g) => [g.de, g.vers]), [
    ['Source/Aé', 'Source/Ae'],
    ['Source/Ae/Bé', 'Source/Ae/Be'],
  ])
  assert.equal(gestesFichiers.length, 2)
  // Deux fichiers de MÊME basename dans deux livres : chacun garde sa clé complète.
  assert.equal(mappe.get('Source/Aé/Bé/01 - Cé.md'), 'Source/Ae/Be/01 - Ce.md')
  assert.equal(mappe.get('Source/Aé/01 - Cé.md'), 'Source/Ae/01 - Ce.md')

  const lien = reecrireLiensRelatifs('- [x](<01 - Cé.md>)', 'Source/Aé/00 - Index.md', mappe)
  assert.equal(lien.texte, '- [x](<01 - Ce.md>)')
  assert.equal(lien.cibles, 1)
})

test('la réécriture textuelle va du chemin le plus LONG au plus court', () => {
  const { mappe } = planDeRenommage(['Source/Aé/01 - Cé.md'])
  const couples = couplesTextuels(mappe)
  assert.ok(couples[0][0].length >= couples[couples.length - 1][0].length)
  assert.equal(
    reecrireChemins('voir Source/Aé/01 - Cé.md et le dossier Source/Aé', couples),
    'voir Source/Ae/01 - Ce.md et le dossier Source/Ae',
  )
})
