// Test de la PRIMITIVE de stock nominatif (node --test) : la CLÉ d'un site, l'ordinal d'occurrence,
// et les deux sens de l'écart avec leur REMÈDE. Ce que vérifient ici les gardes qui en dépendent
// (check-code-refs, citation-graphy-guard, reanchor, check-refs, check-folio-continuity, le cliquet
// `littéral == jeton` des tenues) est le CONTRAT, jamais un compte : les plafonds vivent dans le test
// de chaque garde — quand il en reste un. Lancé par `npm run test:hooks`.
// `ecartsDeStock`, `champsAveugles`, `couvertureDuBalayage` et `lignesMalQualifiees` du même module
// sont tenus par `src/stock-primitive.test.ts` (vitest).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleDeSite, ecartDuVolet, ecrireStockSousLot, naissanceDu, phraseDeNaissance, refusDeCroissance, sitesEnEntrees, survieDeLecheance } from './stock.mjs'

test('#1739 : « à la naissance » — `naissanceDu` relit ce que `phraseDeNaissance` écrit ; une famille absente rend null', () => {
  const comptes = { a: 3, 'b-c': 148 }
  assert.deepEqual(naissanceDu(`Stock. ${phraseDeNaissance(comptes, ['a', 'b-c'])} Suite.`, ['a', 'b-c']), comptes)
  assert.equal(naissanceDu(phraseDeNaissance(comptes, ['a', 'b-c']), ['a', 'b-c', 'd']), null)
  assert.equal(naissanceDu('sans phrase', ['a']), null)
})

test('sitesEnEntrees : deux sites de la MÊME réf dans le MÊME fichier se distinguent par leur OCCURRENCE', () => {
  const entrees = sitesEnEntrees([
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/a.ts', ref: 'LDB 6 l.2' },
    { file: 'src/b.ts', ref: 'LDB 6 l.2' },
  ])
  assert.deepEqual(entrees.map((e) => e.occurrence), [1, 2, 1])
  assert.equal(new Set(entrees.map(cleDeSite)).size, entrees.length, 'la clé doit distinguer chaque site')
})

test('ecartDuVolet : un site dont le NOMBRE grandit rougit ; plus petit ou égal, il reste couvert', () => {
  const stock = [{ famille: 'f', fichier: 'Source/X/01 - A.md', ref: '<sup>', occurrence: 1, nombre: 3 }]
  const ecart = (nombre) => ecartDuVolet({ sites: [{ file: 'Source/X/01 - A.md', ref: '<sup>', nombre }], stock, famille: 'f', ou: 'x-stock.json' })
  assert.deepEqual(ecart(4).neuves, ['f :: Source/X/01 - A.md :: <sup> :: 1 — nombre 4 > 3 en stock : la dette GRANDIT, corriger le site (x-stock.json).'])
  assert.deepEqual(ecart(4).perimees, [])
  assert.deepEqual([ecart(3).neuves, ecart(2).neuves, ecart(2).perimees], [[], [], []])
  assert.equal(survieDeLecheance(sitesEnEntrees([{ file: 'Source/X/01 - A.md', ref: '<sup>', nombre: 2 }], { famille: 'f' }), { lot: '#1', date: '2026-09-25', ancien: stock })[0].nombre, 2, 'plus petit : la régénération recale le stock')
})

// La LIGNE DU FICHIER PORTEUR n'entre pas dans la clé : deux sites de même (fichier, réf) écrits à
// des lignes différentes ne se distinguent QUE par leur occurrence — c'est ce qui rend une entrée
// survivante à l'édition du fichier qui la porte. La ligne CITÉE (`l.2`, dans `Source/`), elle,
// appartient à la réf, donc à la clé.
test('cleDeSite : la ligne du fichier PORTEUR n’entre pas dans la clé — seule l’occurrence sépare deux homonymes', () => {
  const enHaut = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 12 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 300 }])
  const deplaces = sitesEnEntrees([{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 480 }, { file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }])
  assert.deepEqual(enHaut.map(cleDeSite), deplaces.map(cleDeSite), 'déplacer les deux sites dans leur fichier ne change aucune clé')
  assert.deepEqual(enHaut.map(cleDeSite), [' :: src/a.ts :: LDB 6 l.2 :: 1', ' :: src/a.ts :: LDB 6 l.2 :: 2'])
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2', row: 902 }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    0, 'un site déplacé dans son fichier reste couvert par son entrée',
  )
  assert.equal(
    ecartDuVolet({ sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.3' }], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' }).neuves.length,
    1, 'la ligne CITÉE, elle, appartient à la clé : l.2 → l.3 est un autre site',
  )
})

// La clé NOMME son fichier, et c'est ce qui rend l'entrée visible à la porte de plage
// (`croissanceDesStocks`) : une entrée dont le `fichier` ne serait pas un chemin ne coûterait rien à
// ajouter. La mesure de cette visibilité vit sur les porteurs réels
// (`scripts/hooks/stocks-nominatifs.test.mjs`) ; ici, le contrat de la clé.
test('cleDeSite : le FICHIER est dans la clé, avant la réf et l’occurrence', () => {
  assert.equal(
    cleDeSite({ fichier: 'src/gameIso/rig/parts/tenues/defs/Bailli.ts', ref: 'bailli:torse:front', occurrence: 3 }),
    ' :: src/gameIso/rig/parts/tenues/defs/Bailli.ts :: bailli:torse:front :: 3',
  )
  assert.equal(
    cleDeSite({ famille: 'graphy', fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }),
    'graphy :: src/a.ts :: LDB 6 l.2 :: 1', 'la famille ouvre la clé quand la garde en distingue',
  )
})

test('écart : un site hors du stock est NEUF, une entrée sans site est SOLDÉE, les deux nommés', () => {
  const stock = [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }, { fichier: 'src/c.ts', ref: 'LDB 6 l.2', occurrence: 1 }]
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/b.ts', ref: 'LDB 6 l.2' }],
    stock, ou: 'x-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /src\/b\.ts/)
  assert.match(neuves[0], /site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /src\/c\.ts/)
  assert.match(perimees[0], /entrée SOLDÉE/)
})

// Une entrée dont AUCUN champ ne nomme (faute de saisie, champ renommé) rend une clé réduite à ses
// séparateurs : le refus désigne alors une entrée que le lecteur ne peut pas retrouver dans son
// fichier de stock. Le remède la CITE en JSON — le seul texte qui la localise.
test('écart : une entrée périmée qui ne NOMME rien est citée en JSON, jamais par une clé vide', () => {
  const bidon = { occurrence: 1, lot: '#1711', date: '2026-09-12' }
  const { perimees } = ecartDuVolet({ sites: [], stock: [bidon], ou: 'x-stock.json' })
  assert.equal(perimees.length, 1)
  assert.ok(
    perimees[0].startsWith(JSON.stringify(bidon)),
    `le refus doit citer l’entrée elle-même, il dit : ${perimees[0]}`,
  )
  assert.match(perimees[0], /entrée SOLDÉE/)
  const nommee = ecartDuVolet({ sites: [], stock: [{ fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }], ou: 'x-stock.json' })
  assert.match(nommee.perimees[0], /^ :: src\/a\.ts :: LDB 6 l\.2 :: 1 —/, 'une entrée qui nomme garde sa CLÉ')
})

// BARRIÈRE DÉCROISSANT-SEULEMENT des régénérateurs. La fixture est SYNTHÉTIQUE : le contrat doit
// survivre au solde du dernier stock réel du dépôt. Le cas qui compte est l'ÉCHANGE À TAILLE
// CONSTANTE — une entrée du stock qui ne couvre plus rien pendant qu'un site mesuré se découvre :
// les deux longueurs restent égales, et un refus qui compare des nombres écrirait le stock.
test('refusDeCroissance : un ÉCHANGE à taille CONSTANTE est refusé, et le refus NOMME le site découvert', () => {
  const mesurees = sitesEnEntrees([{ file: 'src/a.ts', ref: 'r1' }, { file: 'src/b.ts', ref: 'r2' }])
  const echange = [
    { fichier: 'src/a.ts', ref: 'r1', occurrence: 1 },
    { fichier: 'src/disparu.ts', ref: 'r9', occurrence: 1 },
  ]
  assert.equal(echange.length, mesurees.length, 'la fixture doit rester à taille constante')
  const refus = refusDeCroissance(mesurees, echange, { nom: 'X_RATCHET', motif: 'Ça se corrige, ça ne s’entérine pas ici.' })
  assert.ok(refus, 'un site mesuré hors du stock refuse même à taille constante')
  assert.match(refus, /^REFUS : X_RATCHET porte 1 site\(s\) MESURÉ\(s\) hors du stock en place \(2 entrée\(s\)\)\./)
  assert.match(refus, / :: src\/b\.ts :: r2 :: 1/)
  assert.match(refus, /Ça se corrige, ça ne s’entérine pas ici\.$/)
})

test('refusDeCroissance : un stock PLUS GRAND que la mesure ne refuse rien — le solde est le geste servi', () => {
  const mesurees = sitesEnEntrees([{ file: 'src/a.ts', ref: 'r1' }])
  const plusGrand = [
    { fichier: 'src/a.ts', ref: 'r1', occurrence: 1 },
    { fichier: 'src/a.ts', ref: 'r1', occurrence: 2 },
    { fichier: 'src/c.ts', ref: 'r3', occurrence: 1 },
  ]
  assert.equal(refusDeCroissance(mesurees, plusGrand, { nom: 'X_RATCHET', motif: 'm' }), null)
})

// La CLÉ est un paramètre : un stock à clé NUE (chemins, ids) passe la sienne et la barrière est la
// même — une seule lecture de « croître » pour tous les régénérateurs du dépôt.
test('refusDeCroissance : une clé NUE fournie par l’appelant sert la même barrière', () => {
  const p = { cle: (k) => k, nom: 'Y_RATCHET', motif: 'm' }
  assert.equal(refusDeCroissance(['a', 'b'], ['a', 'b', 'c'], p), null)
  assert.match(refusDeCroissance(['a', 'z'], ['a', 'b'], p), /\bz\b/)
})

test('écart : un stock qui décrit EXACTEMENT les sites observés ne dit rien', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: [{ file: 'src/a.ts', ref: 'LDB 6 l.2' }, { file: 'src/a.ts', ref: 'LDB 6 l.2' }],
    stock: [
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 },
      { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 2 },
    ],
    ou: 'x-stock.json',
  })
  assert.deepEqual([neuves, perimees], [[], []])
})

// SURVIE (#1820) : une régénération de stock ne rajeunit pas une dette. Contrat tenu ICI parce que
// les deux régénérateurs datés du dépôt (`check-source-tables`, `check-source-format`) le partagent.
const MESUREES = () => sitesEnEntrees([
  { file: 'Source/L/01 - A.md', ref: 'r1' },
  { file: 'Source/L/02 - B.md', ref: 'r2' },
], { famille: 'f' })

test('survie : une entrée CONNUE garde son lot, sa date et sa preuve ; une régénération ne la rajeunit pas', () => {
  const ancien = survieDeLecheance(MESUREES(), { lot: '#1384 B2', date: '2026-09-14' })
    .map((e, i) => (i === 0 ? { ...e, preuve: 'PDF p.42 : lu.' } : e))
  const rendu = survieDeLecheance(MESUREES(), { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, ancien)
})

test('survie : un site NEUF prend le lot et la date DU RUN, et ne porte aucune preuve', () => {
  const ancien = survieDeLecheance(MESUREES().slice(0, 1), { lot: '#1384 B2', date: '2026-09-14' })
  const rendu = survieDeLecheance(MESUREES(), { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu.map((e) => [e.fichier, e.lot, e.date, 'preuve' in e]), [
    ['Source/L/01 - A.md', '#1384 B2', '2026-09-14', false],
    ['Source/L/02 - B.md', '#9999 Z', '2030-01-01', false],
  ])
})

// La survie suit la CLÉ, jamais le rang : une entrée ancienne dont la clé a changé (réf corrigée)
// est un site NEUF, et l'entrée voisine ne lui prête ni sa date ni sa preuve.
test('survie : la clé SEULE apparie — une réf qui bouge redate l’entrée', () => {
  const ancien = survieDeLecheance(
    sitesEnEntrees([{ file: 'Source/L/01 - A.md', ref: 'AUTRE' }], { famille: 'f' }),
    { lot: '#1384 B2', date: '2026-09-14' },
  ).map((e) => ({ ...e, preuve: 'PDF p.7 : lu.' }))
  const rendu = survieDeLecheance(MESUREES().slice(0, 1), { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, [
    { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'r1', occurrence: 1, lot: '#9999 Z', date: '2030-01-01' },
  ])
})

// La RÉGÉNÉRATION SOUS LOT : `rendre` est la couture de chaque régénérateur (`entreesDe` + `stockDe`),
// `ecrire` est INJECTÉ — le banc n'écrit rien, il compte les écritures.
const ANCIEN = [{ famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'a', occurrence: 1, lot: '#1 X', date: '2026-01-01' }]
const CONNUE = { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'a', occurrence: 1 }
const NEUVE = { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'b', occurrence: 1 }
const regenerer = (args, mesurees) => {
  const ecrits = []
  const rendre = (lot, date) => {
    const entrees = survieDeLecheance(mesurees, { lot, date, ancien: ANCIEN })
    return { entrees, texte: JSON.stringify(entrees) }
  }
  const r = ecrireStockSousLot(args, rendre, (t) => ecrits.push(t), 'x-stock.json', '2026-09-23')
  return { ...r, ecrits }
}

test('régénération sous lot : une entrée NEUVE sans `--lot` REFUSE l’écriture, nommée — rien n’est écrit', () => {
  for (const args of [['--ecrire-stock'], ['--ecrire-stock', '--lot'], ['--lot', '--ecrire-stock']]) {
    const r = regenerer(args, [CONNUE, NEUVE])
    assert.equal(r.code, 1, JSON.stringify(args))
    assert.match(r.message, /^x-stock\.json : 1 entrée\(s\) NEUVE\(s\) ou ACCRUE\(s\) sans lot/)
    assert.ok(r.message.includes(cleDeSite(NEUVE)))
    assert.deepEqual(r.ecrits, [])
  }
})

test('régénération sous lot : `--lot` étiquette la NEUVE, la CONNUE garde le sien ; sans neuve, aucun lot requis', () => {
  const r = regenerer(['--ecrire-stock', '--lot', '#1739 3b-2b'], [CONNUE, NEUVE])
  assert.equal(r.code, 0)
  assert.deepEqual(JSON.parse(r.ecrits[0]).map((e) => e.lot), ['#1 X', '#1739 3b-2b'])
  const sansNeuve = regenerer(['--ecrire-stock'], [CONNUE])
  assert.equal(sansNeuve.code, 0)
  assert.equal(sansNeuve.ecrits.length, 1)
})

test('régénérer un stock dont un nombre a GRANDI est refusé sans `--lot` ; `--lot` date la croissance', () => {
  const tenue = { ...ANCIEN[0], nombre: 3, preuve: 'PDF p.1' }
  const regen = (args, nombre) => {
    const ecrits = []
    const rendre = (lot, date) => {
      const entrees = survieDeLecheance([{ ...CONNUE, nombre }], { lot, date, ancien: [tenue] })
      return { entrees, texte: JSON.stringify(entrees) }
    }
    return { ...ecrireStockSousLot(args, rendre, (t) => ecrits.push(t), 'x-stock.json', '2026-09-25'), ecrits }
  }
  const refus = regen(['--ecrire-stock'], 4)
  assert.equal(refus.code, 1)
  assert.ok(refus.message.includes(cleDeSite(CONNUE)))
  assert.deepEqual(refus.ecrits, [])
  assert.deepEqual(JSON.parse(regen(['--ecrire-stock', '--lot', '#1739 x'], 4).ecrits[0]), [{ ...CONNUE, nombre: 4, lot: '#1739 x', date: '2026-09-25' }])
  assert.deepEqual(JSON.parse(regen(['--ecrire-stock'], 2).ecrits[0]), [{ ...CONNUE, nombre: 2, lot: '#1 X', date: '2026-01-01', preuve: 'PDF p.1' }])
})
