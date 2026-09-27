// Test de la garde `check-source-tables` (node --test, joué par `npm run test:raw`). Les quatre
// familles MORDENT sur des chapitres synthétiques (le détecteur est PUR au grain du chapitre), la
// clé de site ne porte aucune position, la `preuve` d'une entrée est un fait daté (jamais une
// dispense), et le stock COMMITTÉ est exactement le rendu des sites mesurés sur l'arbre — dans les
// deux sens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sitesDuChapitre, scanAllBooks, scanBookDir, refDeTable, cleDeLigne, entreesDe, ecartDuStock,
  comptesParFamille, verdictDesPreuves, comptesDeTri, preuvesHorsPlage, lireLigne1Du,
  FAMILLES, STOCK_PATH, stockDe,
} from './check-source-tables.mjs'
import { naissanceEnPlace, readStock } from './stockNominatif.mjs'
import { cleDeSite, naissanceDu } from '../guards/lib/stock.mjs'
import { BOOKS } from './_lib.mjs'
import { parseChapitre, tablesOf } from '../../src/data/source/decoupe.ts'

const FICHIER = 'Source/Livre/01 - Fixture.md'
const familles = (texte) => sitesDuChapitre(texte, FICHIER).map((s) => s.famille).sort()

test('br-litteral : un `<br>` dans une CELLULE est un site ; sans lui, rien', () => {
  const avec = [
    '## Tables',
    '',
    '| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Gagnez 3 États<br>Assourdi |',
  ].join('\n')
  assert.deepEqual(familles(avec), ['br-litteral'])
  assert.deepEqual(familles(avec.replace('<br>', ' ')), [])
})

test('un marqueur de folio COLLÉ à une ligne de table n’est PAS un site : la lib l’absorbe', () => {
  // Contrat POSITIF de l'absorption (#1384 B2) : `toBlocks` applique `stripSpans` AVANT `parseTable`,
  // la ligne ouvre donc bien par `|` et la table se lit ENTIÈREMENT. Rien à réparer dans `Source/` :
  // l'ancre reste où la page coupe.
  const texte = [
    '## Tables',
    '',
    '<span id="page-9-0" data-folio="7"></span>| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Rien |',
  ].join('\n')
  assert.deepEqual(familles(texte), [])
  const section = parseChapitre(texte).sections.find((s) => s.slug === 'tables')
  const [{ table }] = tablesOf(section)
  assert.deepEqual(table.headers, ['Lancer', 'Effet'])
  assert.deepEqual(table.rows, [['01-10', 'Rien']])
})

test('donnee-en-tete : une continuation de table dont les « en-têtes » sont une fourchette est un site', () => {
  const texte = ['## Tables', '', '| 81-85 | Bouche explosée |', '| --- | --- |', '| 86-90 | Pire |'].join('\n')
  assert.deepEqual(familles(texte), ['donnee-en-tete'])
})

test('banniere-suspecte : la bannière que le parseur REFUSE est un site ; celle qu’il absorbe, non', () => {
  const suspecte = ['## Tables', '', '| Effet |  |', '| --- | --- |', '| Le personnage tombe. |  |'].join('\n')
  assert.deepEqual(familles(suspecte), ['banniere-suspecte'])

  const absorbee = [
    '## Tables',
    '',
    '|  | TABLEAU DES MOUVEMENTS |  |',
    '|--|--|--|',
    '| Mouvement | Marche | Course |',
    '| 1 | 2 | 4 |',
  ].join('\n')
  assert.deepEqual(familles(absorbee), [])

  // Bandeau MAJUSCULE devant une table SANS en-têtes : refusé par le parseur, donc `banniere-suspecte`
  // — et JAMAIS `donnee-en-tete`, qui serait un site FABRIQUÉ par une absorption de trop.
  const sansEnTetes = [
    '## Tables',
    '',
    '|  | TABLEAU DES INCANTATIONS |  |',
    '|--|--|--|',
    '| 01-05 | Signe de Sorcière |  |',
    '| 06-10 | Lait caillé |  |',
  ].join('\n')
  assert.deepEqual(familles(sansEnTetes), ['banniere-suspecte'])
})

// `table-avalee-par-titre` : toutes les lignes ci-dessous sont des FIXTURES — recopiées à la main,
// jamais lues au disque. Les deux constantes du détecteur (longueur, série chiffrée) sont encadrées
// par leurs DEUX bornes : la ligne de n−1 ne sort pas, celle de n sort, et rien d'autre ne les
// sépare.
const AVALEE = 'table-avalee-par-titre'
const chapitreDe = (ligne) => ['## Section', '', ligne].join('\n')
const estAvalee = (ligne) => familles(chapitreDe(ligne)).includes(AVALEE)
const refsAvalees = (texte) =>
  sitesDuChapitre(texte, FICHIER).filter((s) => s.famille === AVALEE).map((s) => s.ref)

test('table-avalee-par-titre : la BORNE de longueur — 9 atomes ne portent pas une table, 10 oui', () => {
  assert.equal(estAvalee('#### GRAND CERF **M CC** 7 45 40 30 32'), false, '9 atomes')
  assert.equal(estAvalee('#### GRAND CERF **M CC CT** 7 45 40 30 32'), true, '10 atomes')
})

test('table-avalee-par-titre : la BORNE de la série chiffrée — 2 valeurs ne font pas une table, 3 oui', () => {
  assert.equal(estAvalee('#### GRAND CERF **M CC CT F E** 7 45 - -'), false, '11 atomes, 2 chiffrés')
  assert.equal(estAvalee('#### GRAND CERF **M CC CT F E** 7 45 40 -'), true, '11 atomes, 3 chiffrés')
})

test('table-avalee-par-titre : le bandeau peut être NU devant sa rangée de labels grasse', () => {
  const nu = '#### GRAND CERF **M CC CT F E I Ag Dex Int FM Soc B** 7 45 - 45 40 30 30 - 20 40 - 32'
  assert.deepEqual(familles(chapitreDe(nu)), [AVALEE])
  // La RÉF est le premier SEGMENT : le texte NU l'emporte sur le run gras qui le suit.
  assert.deepEqual(refsAvalees(chapitreDe(nu)), ['grand cerf'])
})

test('table-avalee-par-titre : le bandeau peut aussi être GRAS — la RÉF est alors son premier run', () => {
  const gras = '### **DEMIGRYPH M WS BS S T I Ag Dex Int WP Fel W** 7 45 – 55 50 40 45 – 25 35 20 30'
  assert.deepEqual(familles(chapitreDe(gras)), [AVALEE])
  assert.deepEqual(refsAvalees(chapitreDe(gras)), ['demigryph m ws bs s t i ag dex int wp fel w'])
})

test('table-avalee-par-titre : un titre SANS aucun gras est vu, et sa RÉF est le titre entier', () => {
  const sansGras = '#### LUDOLF KÖHLER - SEIGNEUR DES MERS IMPÉRIAL (OR 3) M CC CT F E I Ag Dex Int FM Soc B 4 59 34 37 40 49 48 54 44 32 51 14'
  assert.deepEqual(familles(chapitreDe(sansGras)), [AVALEE])
  assert.deepEqual(refsAvalees(chapitreDe(sansGras)), [
    'ludolf köhler - seigneur des mers impérial (or 3) m cc ct f e i ag dex int fm soc b 4 59 34 37 40 49 48 54 44 32 51 14',
  ])
})

test('table-avalee-par-titre : la RÉF ne porte aucune position — un paragraphe inséré ne la bouge pas', () => {
  const avale = ['## Magie', '', '#### **OVERCAST TABLE SL Targets Damage Range AoE Duration** 1 +1 +1 Damage x 2 - - 2 +2 Damage'].join('\n')
  assert.deepEqual(refsAvalees(avale), ['overcast table sl targets damage range aoe duration'])
  assert.deepEqual(refsAvalees(avale.replace('####', 'Un paragraphe de plus.\n\n####')), refsAvalees(avale))

  const restitue = [
    '## Magie', '', '#### **OVERCAST TABLE**', '',
    '| SL | Targets | Damage |', '| --- | --- | --- |', '| 1 | +1 | +1 Damage |',
  ].join('\n')
  assert.deepEqual(familles(restitue), [])
})

test('table-avalee-par-titre : un titre ENTIÈREMENT gras est un intitulé, si long et chiffré soit-il', () => {
  // Ce qui distingue une table, c'est que ses VALEURS débordent du bandeau. Rien hors du gras : rien
  // à recoller. Écarté par CONSTRUCTION, jamais par une liste de titres.
  assert.equal(estAvalee('#### **Le tournoi de Middenball (Backertag & Bezahltag, de 15h à 20h, Konigstag, de 14h à 19h, Angestag, de 14h à 16h)**'), false)
  assert.equal(estAvalee('#### **Ennio Mordini (2369 CI à 2411 CI puis 2416 CI à ce jour)**'), false)
  assert.equal(estAvalee('#### **AVAILABILITY Village Town City Common Scarce Rare Exotic Village Town City**'), false)
})

test('table-avalee-par-titre : le MOBILIER de page et les intitulés ne sont PAS de la classe (#1739)', () => {
  // Trop courts, ou sans série chiffrée : aucun n'est nommé par une liste.
  for (const ligne of [
    '# **MANTICORE** XII',
    '#### **PROSTHETICS** XI **MAGICAL ITEMS**',
    '#### **Toughness Bonus:** 3',
    '### **Art (Dex)** *basic, grouped*',
    '# **Purple Pall of** *Shyish*',
    '#### **SOLDIER ADVANCE SCHEME** 2',
    "# **La Pièce de Théâtre** *Songe d'une nuit d'épée* **(Wellentag, de 19h à 21h)**",
  ]) assert.equal(estAvalee(ligne), false, ligne)
})

test('cle-de-ligne-ambigue : une clé partagée par DEUX tables SANS titre de la même section est un site, une par clé — une position ne départage rien (#1739)', () => {
  const texte = [
    '## Traumatisme',
    '',
    '| Lancer | Effet tête |',
    '| --- | --- |',
    '| 01-10 | Écorchure |',
    '| 11-20 | Coupure |',
    '',
    '| Lancer | Effet bras |',
    '| --- | --- |',
    '| 01-10 | Contusion |',
    '| 21-30 | Fracture |',
  ].join('\n')
  const ambigues = (x) => sitesDuChapitre(x, FICHIER).filter((s) => s.famille === 'cle-de-ligne-ambigue').map((s) => s.ref)
  assert.deepEqual(ambigues(texte), ['traumatisme#1 :: 01-10'])
  // Une seule table dans la section : aucune ambiguïté INTER-tables à nommer.
  assert.deepEqual(familles(texte.split('\n').slice(0, 6).join('\n')), [])
})

test('cle-de-ligne-ambigue (#1739) : l’adresse `table` (`titre#occ`, titre NON VIDE) sépare les tables titrées, même de titre répété ; une table sans titre, ou une clé répétée DANS une table, reste un site', () => {
  const tables = (a, b) => [
    '## Traumatisme', '',
    ...(a ? [a, ''] : []), '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Écorchure |', '',
    ...(b ? [b, ''] : []), '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Contusion |',
  ].join('\n')
  const ambigues = (texte) => sitesDuChapitre(texte, FICHIER).filter((s) => s.famille === 'cle-de-ligne-ambigue').map((s) => s.ref)
  assert.deepEqual(ambigues(tables('**TÊTE**', '**BRAS**')), [])
  assert.deepEqual(ambigues(tables(null, '**BRAS**')), ['traumatisme#1 :: 01-10'])
  assert.deepEqual(ambigues(tables('**TÊTE**', '**TÊTE**')), [])
  assert.deepEqual(ambigues(`${tables('**TÊTE**', '**BRAS**')}\n| 01-10 | Fracture |`), ['traumatisme#1 :: 01-10'])
})

test('stock (#1739) : les comptes « à la naissance » du `quoi` en place se gardent — l’historique ne se réécrit pas', () => {
  const quoi = JSON.parse(stockDe([], { lot: '', date: '', naissance: naissanceDu('Compte par famille à la naissance : br-litteral 403, donnee-en-tete 14, banniere-suspecte 114, cle-de-ligne-ambigue 148, table-avalee-par-titre 36. suite', FAMILLES) })).quoi
  assert.match(quoi, /cle-de-ligne-ambigue 148/)
  assert.match(JSON.parse(stockDe([], { lot: '', date: '' })).quoi, /cle-de-ligne-ambigue 0/)
  assert.equal(naissanceDu('pas de comptes', FAMILLES), null)
  assert.ok(naissanceEnPlace(STOCK_PATH, FAMILLES), 'le stock en place porte ses comptes à la naissance')
})

test('deux SECTIONS distinctes ne partagent pas leurs clés (l’ambiguïté est bornée à la section)', () => {
  const texte = [
    '## Tête', '', '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Écorchure |', '',
    '## Bras', '', '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Contusion |',
  ].join('\n')
  assert.deepEqual(familles(texte), [])
})

test('la CLÉ de site porte du CONTENU, jamais une position — deux tables de mêmes en-têtes se départagent par l’OCCURRENCE', () => {
  const table = ['| Lancer | Effet |', '| --- | --- |', '| 01-10 | Gagnez 1 État<br>Sonné |'].join('\n')
  const texte = ['## Tables', '', table, '', table].join('\n')
  const sites = sitesDuChapitre(texte, FICHIER).filter((s) => s.famille === 'br-litteral')
  assert.equal(sites.length, 2)
  assert.equal(sites[0].ref, sites[1].ref, 'même contenu → même réf ; c’est l’occurrence qui les sépare')
  assert.equal(sites[0].ref, refDeTable('tables', 1, ['Lancer', 'Effet']))
  assert.deepEqual(entreesDe(sites, { lot: 'x', date: 'y' }).map((e) => e.occurrence), [1, 2])
  // Un paragraphe INSÉRÉ avant les tables ne change aucune réf : la clé ne compte ni les lignes ni
  // les tables qui précèdent.
  const decale = ['## Tables', '', 'Un paragraphe de plus.', '', table, '', table].join('\n')
  assert.deepEqual(
    sitesDuChapitre(decale, FICHIER).filter((s) => s.famille === 'br-litteral').map((s) => s.ref),
    sites.map((s) => s.ref),
  )
})

test('la réf d’une table NEUTRALISE le `<br>` : la clé survit à la réparation qui soldera son site (lot B2)', () => {
  assert.equal(refDeTable('s', 1, ['Nombre de sorts<br>connus']), refDeTable('s', 1, ['Nombre de sorts connus']))
})

test('cleDeLigne NEUTRALISE le `<br>` de la même façon : une clé imprimée sur deux lignes est UNE clé', () => {
  assert.equal(cleDeLigne(['Batterie tonnerre<br>de feu']), cleDeLigne(['Batterie tonnerre de feu']))
})

test('cleDeLigne : la première cellule NON VIDE, normalisée', () => {
  // `normText` replie la casse et les espaces, jamais les ACCENTS (le match français doit être exact).
  assert.equal(cleDeLigne(['', '  Bouche Explosée ', 'x']), 'bouche explosée')
  assert.equal(cleDeLigne(['', '']), '')
})

test('scanBookDir : le `fichier` d’un site est le chapitre extrait, en POSIX depuis la racine du dépôt', () => {
  // Le corpus RENVOIE le livre : le premier scan non vide fait foi — aucun sigle ni rang écrit ici.
  let sites = []
  for (const [, dir] of BOOKS) { sites = scanBookDir(dir); if (sites.length) break }
  assert.ok(sites.length > 0, 'le corpus `Source/` porte au moins un site de table mesuré')
  for (const s of sites.slice(0, 20)) assert.match(s.file, /^Source\/[^\\]+\/[^\\]+\.md$/)
})

test('stock COMMITTÉ : chaque site mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuStock(scanAllBooks(), readStock(STOCK_PATH))
  assert.deepEqual(neuves, [], `site(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

// AUCUN GÉNÉRATEUR SÉPARÉ : le fichier de stock EST le rendu de `entreesDe(scanAllBooks())`, écrit
// par `node scripts/raw/check-source-tables.mjs --ecrire-stock`. Ce test le vérifie à la clé ET à
// l'ORDRE, là où l'écart ci-dessus ne juge que les ensembles — un stock réordonné à la main rougit.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  const attendu = entreesDe(scanAllBooks(), { lot: '', date: '' })
  assert.deepEqual(readStock(STOCK_PATH).map(cleDeSite), attendu.map(cleDeSite))
})

// #1825 : même contrat que `check-folio-continuity.test.mjs` — l'ordre des livres vit dans
// `src/data/books.json`, et aucun artefact commité ne s'y asservit : insérer un livre AU MILIEU du
// registre ne doit réécrire aucun stock. Registre INJECTÉ (`scanAllBooks(books)`), jamais le fichier.
test('#1825 le rendu du stock est INDIFFÉRENT à l’ordre du registre (registre inversé)', () => {
  const sitesDe = (books) => scanAllBooks(books).map((s) => `${s.famille} :: ${s.file} :: ${s.ref}`)
  const rendu = (books) => entreesDe(scanAllBooks(books), { lot: '', date: '' }).map(cleDeSite)
  const inverse = [...BOOKS].reverse()
  assert.notDeepEqual(sitesDe(inverse), sitesDe(BOOKS), 'le balayage rend le même ordre : sonde inerte')
  assert.deepEqual(rendu(inverse), rendu(BOOKS))
})

// PLAFOND de la dette (jamais dans la lib de stock : il vit ICI, cf. `scripts/guards/lib/stock.mjs`).
// Il ne monte QUE par une édition de cette ligne, sous `CLIQUET:` — il n'est pas le compte du jour,
// il est la borne que le jour ne doit pas franchir.
const PLAFOND = 680

// PLAFOND de la DETTE, distinct du précédent : le fichier de stock est un INVENTAIRE des sites
// mesurés (il ne décroît qu'en corrigeant `Source/`), la dette est ce qui reste À TRIER — les entrées
// sans `preuve`. Celle-là descend à CHAQUE preuve lue au PDF, et ne monte que sous `CLIQUET:`.
const PLAFOND_A_TRIER = 667

test('stock COMMITTÉ : PLAFOND de la DETTE — « à trier » (entrées sans preuve) ne remonte jamais', () => {
  const { aTrier, verifies } = comptesDeTri(readStock(STOCK_PATH))
  assert.ok(
    aTrier <= PLAFOND_A_TRIER,
    `${aTrier} entrée(s) à trier pour un plafond de ${PLAFOND_A_TRIER} : une dette ne grossit pas`,
  )
  assert.equal(aTrier + verifies, readStock(STOCK_PATH).length, 'toute entrée est soit à trier, soit vérifiée')
})

test('stock COMMITTÉ : PLAFOND de l’INVENTAIRE — le relever exige de changer CE test', () => {
  const entrees = readStock(STOCK_PATH)
  assert.ok(
    entrees.length <= PLAFOND,
    `${entrees.length} entrée(s) pour un plafond de ${PLAFOND} : une dette de forme ne grossit pas`,
  )
  for (const e of entrees) {
    assert.ok(FAMILLES.includes(e.famille), `famille inconnue : ${JSON.stringify(e)}`)
    assert.match(e.fichier, /^Source\/.+\.md$/, `entrée sans chapitre extrait : ${JSON.stringify(e)}`)
    assert.ok(e.ref && e.occurrence >= 1, `entrée sans réf ni occurrence : ${JSON.stringify(e)}`)
  }
})

test('stock TRUQUÉ : une entrée retirée rend son site NEUF, une entrée sans site est SOLDÉE', () => {
  const sites = scanAllBooks()
  const stock = readStock(STOCK_PATH)
  const ampute = ecartDuStock(sites, stock.slice(1))
  assert.equal(ampute.neuves.length, 1)
  assert.match(ampute.neuves[0], /site NEUF/)
  assert.ok(ampute.neuves[0].includes(stock[0].ref), `le rouge NOMME le site : ${ampute.neuves[0]}`)
  assert.deepEqual(ampute.perimees, [])

  const fantome = { ...stock[0], ref: `${stock[0].ref} (fantôme)` }
  const gonfle = ecartDuStock(sites, [...stock, fantome])
  assert.deepEqual(gonfle.neuves, [])
  assert.equal(gonfle.perimees.length, 1)
  assert.match(gonfle.perimees[0], /entrée SOLDÉE/)
})

test('l’écart est jugé FAMILLE PAR FAMILLE : le stock d’une famille ne solde pas les sites d’une autre', () => {
  const sites = sitesDuChapitre(
    ['## Tables', '', '| 81-85 | Effet<br>long |', '| --- | --- |', '| 86-90 | Pire |'].join('\n'),
    FICHIER,
  )
  assert.deepEqual(comptesParFamille(sites)['br-litteral'], 1)
  assert.deepEqual(comptesParFamille(sites)['donnee-en-tete'], 1)
  const stockPartiel = entreesDe(sites, { lot: 'x', date: 'y' }).filter((e) => e.famille === 'br-litteral')
  const { neuves, perimees } = ecartDuStock(sites, stockPartiel)
  assert.equal(neuves.length, 1, 'la famille NON couverte reste neuve')
  assert.match(neuves[0], /^donnee-en-tete ::/)
  assert.deepEqual(perimees, [], 'la famille couverte n’est pas déclarée soldée pour autant')
})

// La PREUVE (« PDF p.N : … » + `date`) vit sur l'entrée EXISTANTE : exempter, c'est ÉDITER sa ligne,
// jamais ajouter un fichier d'exemptions. Trois cas, tous mesurés sur un chapitre synthétique.
const SITE_FIXTURE = ['## Tables', '', '| Lancer | Effet |', '| --- | --- |', '| 01-10 | Gagnez 3 États<br>Assourdi |'].join('\n')

test('preuve VALIDE : l’entrée est comptée « vérifiée », et aucun verdict ne la rougit', () => {
  const sites = sitesDuChapitre(SITE_FIXTURE, FICHIER)
  const stock = entreesDe(sites, { lot: 'x', date: '2026-09-14' })
    .map((e) => ({ ...e, preuve: 'PDF p.42 : les deux États sont imprimés en colonne, pas de césure.' }))
  assert.deepEqual(comptesDeTri(stock), { aTrier: 0, verifies: 1 })
  assert.deepEqual(verdictDesPreuves(sites, stock), { vides: [], perimees: [] })
  // Une entrée prouvée reste un SITE du stock : elle n'est ni neuve ni soldée.
  assert.deepEqual(ecartDuStock(sites, stock), { neuves: [], perimees: [] })
})

test('preuve VIDE : une exemption sans fait est ROUGE (et ne compte pas comme vérifiée)', () => {
  const sites = sitesDuChapitre(SITE_FIXTURE, FICHIER)
  const stock = entreesDe(sites, { lot: 'x', date: '2026-09-14' }).map((e) => ({ ...e, preuve: '   ' }))
  assert.deepEqual(comptesDeTri(stock), { aTrier: 1, verifies: 0 })
  const { vides, perimees } = verdictDesPreuves(sites, stock)
  assert.equal(vides.length, 1)
  assert.match(vides[0], /preuve` VIDE/)
  assert.deepEqual(perimees, [])
})

test('preuve PÉRIMÉE : une entrée prouvée dont le site n’est plus mesuré est ROUGE', () => {
  const sites = sitesDuChapitre(SITE_FIXTURE, FICHIER)
  const stock = entreesDe(sites, { lot: 'x', date: '2026-09-14' })
    .map((e) => ({ ...e, ref: `${e.ref} (fantôme)`, preuve: 'PDF p.42 : lu.' }))
  const { vides, perimees } = verdictDesPreuves(sites, stock)
  assert.deepEqual(vides, [])
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], /preuve PÉRIMÉE/)
})

test('--ecrire-stock CONSERVE la preuve et l’échéance d’une entrée existante, à clé identique', () => {
  const sites = sitesDuChapitre(SITE_FIXTURE, FICHIER)
  const ancien = entreesDe(sites, { lot: '#1384 B2', date: '2026-09-14' })
    .map((e) => ({ ...e, preuve: 'PDF p.42 : lu.' }))
  const rendu = entreesDe(sites, { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, ancien, 'une régénération ne rajeunit ni n’efface une entrée inchangée')
  // Un site NEUF (aucune entrée ancienne) prend le lot et la date du run — et AUCUNE preuve.
  const neuf = entreesDe(sites, { lot: '#9999 Z', date: '2030-01-01', ancien: [] })
  assert.deepEqual(neuf.map((e) => [e.lot, e.date, 'preuve' in e]), [['#9999 Z', '2030-01-01', false]])
})

test('comptesParFamille nomme TOUTES les familles, même à zéro (une famille muette resterait invisible)', () => {
  assert.deepEqual(Object.keys(comptesParFamille([])), FAMILLES)
  assert.deepEqual(Object.values(comptesParFamille([])), FAMILLES.map(() => 0))
})

/* ─── CONTRE-ÉPREUVE : la page CITÉE par une preuve contre la PLAGE du fichier keyé ─────────────
 * Mesure INDÉPENDANTE de la liste de découpe : elle tombe sur un `pageFin` faux DANS la liste comme
 * sur un re-keyage qui aurait posé la preuve sur le fichier voisin. C'est elle qui a nommé la classe
 * A du lot S1 (preuve p.168 contre un fichier déclaré 164-167).
 * ───────────────────────────────────────────────────────────────────────────────────────────── */

const PREUVE_FIXTURE = { famille: 'banniere-suspecte', fichier: 'Source/Livre/07 - Combat.md', ref: 'x#1 :: a|b', occurrence: 1 }
/** Un lecteur de ligne 1 FORGÉ : la contre-épreuve ne touche pas au disque. */
const ligne1Forgee = (ligne1) => (fichier) => (fichier === PREUVE_FIXTURE.fichier ? ligne1 : null)

test('preuve HORS PLAGE : une page citée au-delà de la plage du fichier keyé est ROUGE, et NOMMÉE', () => {
  const stock = [{ ...PREUVE_FIXTURE, preuve: 'PDF p.168 : la table imprime un en-tête à deux niveaux.' }]
  // MORSURE : la plage s'arrête à 167, la preuve parle de 168.
  const rouge = preuvesHorsPlage(stock, ligne1Forgee('*Pages PDF 164-167*'))
  assert.equal(rouge.length, 1)
  assert.match(rouge[0], /page 168, HORS de la plage 164-167/)
  assert.match(rouge[0], /07 - Combat\.md/)
  // La MÊME preuve contre la plage JUSTE ne dit rien.
  assert.deepEqual(preuvesHorsPlage(stock, ligne1Forgee('*Pages PDF 164-168*')), [])
  // Les deux BORNES sont dedans, et une plage d'UNE page se lit aussi.
  assert.deepEqual(preuvesHorsPlage(stock, ligne1Forgee('*Pages PDF 168-200*')), [])
  assert.deepEqual(preuvesHorsPlage([{ ...PREUVE_FIXTURE, preuve: 'PDF p.48 : lu.' }], ligne1Forgee('*Pages PDF 48*')), [])
})

test('preuve HORS PLAGE : ce qui ne se juge PAS, et ce qui ne se TAIT pas', () => {
  // Une entrée sans preuve, ou dont la preuve ne cite aucune page, ne se confronte à rien.
  assert.deepEqual(preuvesHorsPlage([PREUVE_FIXTURE], ligne1Forgee('*Pages PDF 1-2*')), [])
  assert.deepEqual(
    preuvesHorsPlage([{ ...PREUVE_FIXTURE, preuve: 'PDF : la table est imprimée sur deux colonnes.' }], ligne1Forgee('*Pages PDF 1-2*')),
    [],
  )
  // Mais une preuve qui CITE une page et dont le fichier n'a pas de ligne 1 lisible est NOMMÉE.
  const cite = [{ ...PREUVE_FIXTURE, preuve: 'PDF p.12 : lu.' }]
  assert.match(preuvesHorsPlage(cite, ligne1Forgee('# **COMBAT**'))[0], /pas de ligne 1 lisible/)
  // — et un fichier INTROUVABLE l'est aussi : un stock qui pointe dans le vide ne passe pas.
  assert.match(preuvesHorsPlage(cite, () => null)[0], /est INTROUVABLE/)
})

// L'ARBRE : toute preuve du stock committé tient à la plage de son fichier. GÉNÉRAL — aucun livre
// n'est nommé ici, et une preuve de plus sur un livre de plus entre dans la mesure sans rien changer.
test('stock COMMITTÉ : aucune preuve ne cite une page hors de la plage du fichier qu’elle keye', () => {
  const hors = preuvesHorsPlage(readStock(STOCK_PATH), lireLigne1Du)
  assert.deepEqual(hors, [], `preuve(s) hors plage :\n${hors.join('\n')}`)
})
