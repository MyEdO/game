// Test de la PRIMITIVE de stock nominatif (node --test) : la CLÉ d'un site, l'ordinal d'occurrence,
// et les deux sens de l'écart avec leur REMÈDE. Ce que vérifient ici les gardes qui en dépendent
// (check-code-refs, citation-graphy-guard, reanchor, check-refs, check-folio-continuity, le cliquet
// `littéral == jeton` des tenues) est le CONTRAT, jamais un compte : les plafonds vivent dans le test
// de chaque garde — quand il en reste un. Lancé par `npm run test:hooks`.
// `ecartsDeStock`, `champsAveugles`, `couvertureDuBalayage` et `lignesMalQualifiees` du même module
// sont tenus par `src/stock-primitive.test.ts` (vitest).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleDeSite, ecartDuVolet, estEntreeDeSite, estNeuveOuAccrue, naissanceDu, phraseDeNaissance, refusDeCroissance, sitesEnEntrees, survieDeLecheance } from './stock.mjs'

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
  const ecart = (nombre) => ecartDuVolet({ sites: [{ famille: 'f', file: 'Source/X/01 - A.md', ref: '<sup>', nombre }], stock, ou: 'x-stock.json' })
  assert.deepEqual(ecart(4).neuves, ['f :: Source/X/01 - A.md :: <sup> :: 1 — nombre 4 > 3 en stock : la dette GRANDIT, corriger le site (x-stock.json).'])
  assert.deepEqual(ecart(4).perimees, [])
  assert.deepEqual([ecart(3).neuves, ecart(2).neuves, ecart(2).perimees], [[], [], []])
  assert.equal(survieDeLecheance(sitesEnEntrees([{ famille: 'f', file: 'Source/X/01 - A.md', ref: '<sup>', nombre: 2 }]), { lot: '#1', date: '2026-09-25', ancien: stock })[0].nombre, 2, 'plus petit : la régénération recale le stock')
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

test('ecartDuVolet : remède neuf optionnel reçoit clé intégrale et entrée, sans changer périmés ni accroissements', () => {
  const sites = [{ file: 'src/fixture.ts', ref: 'flow — fixture' }]
  const entree = sitesEnEntrees(sites)[0]
  const cle = cleDeSite(entree)
  const appele = []
  const remede = { neuve: (k, e) => { appele.push([k, e]); return `${k} — remède spécifique` } }
  const defaut = ecartDuVolet({ sites, stock: [], ou: 'fixture-stock.mjs' })
  assert.deepEqual(defaut.neuves, [`${cle} — site NEUF : corriger la réf, ou déclarer une entrée dans fixture-stock.mjs et la porter au message par \`CLIQUET:\`.`])
  assert.deepEqual(ecartDuVolet({ sites, stock: [], ou: 'fixture-stock.mjs', remede }).neuves, [`${cle} — remède spécifique`])
  assert.deepEqual(appele, [[cle, entree]])
  const stock = [{ fichier: 'src/fixture.ts', ref: 'flow — fixture', occurrence: 1, nombre: 3 }]
  const accrus = [{ ...sites[0], nombre: 4 }]
  assert.deepEqual(ecartDuVolet({ sites: accrus, stock, ou: 'fixture-stock.mjs', remede }),
    ecartDuVolet({ sites: accrus, stock, ou: 'fixture-stock.mjs' }))
  assert.match(ecartDuVolet({ sites: accrus, stock, remede }).neuves[0], /nombre 4 > 3/)
  assert.deepEqual(ecartDuVolet({ sites: [], stock, ou: 'fixture-stock.mjs', remede }).perimees,
    ecartDuVolet({ sites: [], stock, ou: 'fixture-stock.mjs' }).perimees)
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

// BARRIÈRE de croissance des politiques `DECROISSANT` et `SOUS_LOT` (`stockDeSites.mjs`). La fixture est SYNTHÉTIQUE : le contrat doit
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
  assert.match(refus, /^REFUS : X_RATCHET porte 1 entrée\(s\) NEUVE\(S\) ou ACCRUE\(S\) au regard du stock en place \(2 entrée\(s\)\) :\n/)
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
// même — une seule lecture de « croître » (`estNeuveOuAccrue`).
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
// toute régénération le lit (`entreesRegenerees`, `stockDeSites.mjs`), sous toute politique.
const MESUREES = () => sitesEnEntrees([
  { famille: 'f', file: 'Source/L/01 - A.md', ref: 'r1' },
  { famille: 'f', file: 'Source/L/02 - B.md', ref: 'r2' },
])

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
    sitesEnEntrees([{ famille: 'f', file: 'Source/L/01 - A.md', ref: 'AUTRE' }]),
    { lot: '#1384 B2', date: '2026-09-14' },
  ).map((e) => ({ ...e, preuve: 'PDF p.7 : lu.' }))
  const rendu = survieDeLecheance(MESUREES().slice(0, 1), { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, [
    { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'r1', occurrence: 1, lot: '#9999 Z', date: '2030-01-01' },
  ])
})

test('estNeuveOuAccrue : sans entrée en place, ou un `nombre` mesuré plus grand, elle est neuve ; sinon non', () => {
  const tenue = { fichier: 'src/a.ts', ref: 'r', occurrence: 1, nombre: 3 }
  assert.equal(estNeuveOuAccrue({ ...tenue }, undefined), true, 'sans entrée en place')
  assert.equal(estNeuveOuAccrue({ ...tenue, nombre: 4 }, tenue), true, 'nombre plus grand')
  assert.equal(estNeuveOuAccrue({ ...tenue, nombre: 3 }, tenue), false, 'nombre égal')
  assert.equal(estNeuveOuAccrue({ ...tenue, nombre: 2 }, tenue), false, 'nombre plus petit')
  assert.equal(estNeuveOuAccrue({ fichier: 'src/a.ts', ref: 'r', occurrence: 1 }, tenue), false, 'nombre absent de la mesure')
  assert.equal(estNeuveOuAccrue({ ...tenue, nombre: 4 }, { fichier: 'src/a.ts', ref: 'r', occurrence: 1 }), false, 'nombre absent du stock')
})

test('estEntreeDeSite : vrai sur chaque entrée que rend `sitesEnEntrees`, avec ou sans famille', () => {
  const sites = [{ file: 'src/a.ts', ref: 'r' }, { file: 'src/a.ts', ref: 'r', line: 3 }]
  for (const e of [...sitesEnEntrees(sites), ...sitesEnEntrees(sites.map((s) => ({ famille: 'f', ...s })))]) assert.equal(estEntreeDeSite(e), true, JSON.stringify(e))
  assert.equal(estEntreeDeSite({ fichier: 'src/a.ts', ref: 'r', occurrence: 0 }), false, 'occurrence ≥ 1')
  assert.equal(estEntreeDeSite({ fichier: 'src/a.ts', ref: 'r', occurrence: 1, famille: 2 }), false, 'famille : chaîne ou absente')
})
