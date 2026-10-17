// Banc de la garde `check-source-puces` (node --test, joué par `npm run test:raw`). Le détecteur est
// PUR au grain du chapitre : il MORD sur des chapitres SYNTHÉTIQUES, et la CONTRE-ÉPREUVE — une
// liste réellement numérotée `0`, `1`, `2` — ne mord pas. La clé de site ne porte aucune position, et
// le stock COMMITTÉ est le point fixe de sa régénération sur les sites mesurés sur l'arbre, dans les
// deux sens.
// Aucun livre n'est nommé ici : le corpus se prend au REGISTRE (`BOOKS`), jamais par un dossier écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sitesDuChapitre, scanAllBooks, scanBookDir, jetonDeLigne, refDeSuite,
  comptesParLivre, regenerations, STOCK_PATH,
} from './check-source-puces.mjs'
import { ecartDeRegeneration, entreesRegenerees, lireEntreesDeSite, texteEnPlace } from '../guards/lib/stockDeSites.mjs'
import { CHAMPS_DE_CLE, cleDeSite, champsAveugles, ecartDuVolet } from '../guards/lib/stock.mjs'
import { BOOKS } from './_lib.mjs'

const FICHIER = 'Source/Livre/01 - Fixture.md'
const refs = (lignes) => sitesDuChapitre(lignes.join('\n'), FICHIER).map((s) => s.ref)

test('MORSURE : deux items consécutifs ouverts par le MÊME jeton sont UN site', () => {
  assert.deepEqual(refs(['- 0 Act with honour.', '- 0 Obey all orders.']), ['« 0 » :: act with honour.'])
})

test('MORSURE : le marqueur `- ` est facultatif — l’extraction le perd aussi', () => {
  assert.deepEqual(refs(['0 Act with honour.', '0 Obey all orders.']), ['« 0 » :: act with honour.'])
  // Marqué et non marqué dans la MÊME suite : c'est le jeton qui fait la suite, pas le marqueur.
  assert.deepEqual(refs(['- 0 Act with honour.', '', '0 Obey all orders.']), ['« 0 » :: act with honour.'])
})

test('MORSURE : le jeton n’est écrit nulle part — une puce lue `O`, `Q` ou `•` entre par la même porte', () => {
  for (const jeton of ['O', 'Q', '•', 'h', '0']) {
    assert.deepEqual(
      refs([`- ${jeton} Act with honour.`, `- ${jeton} Obey all orders.`]),
      [`« ${jeton} » :: act with honour.`],
      jeton,
    )
  }
})

test('CONTRE-ÉPREUVE : une liste réellement NUMÉROTÉE `0`, `1`, `2` ne mord pas', () => {
  assert.deepEqual(refs(['- 0 Act with honour.', '- 1 Obey all orders.', '- 2 Preserve the weak.']), [])
})

test('CONTRE-ÉPREUVE : un item ISOLÉ ne mord pas — la RÉPÉTITION est le signal', () => {
  assert.deepEqual(refs(['- 0 Act with honour.', 'Un paragraphe.', '- 0 Obey all orders.']), [])
})

test('CONTRE-ÉPREUVE : une liste Markdown NORMALE et une TABLE ne mordent pas', () => {
  assert.deepEqual(refs(['- Act with honour.', '- Obey all orders.']), [])
  assert.deepEqual(refs(['| 0 | Acid |', '| 0 | Cold |']), [])
  assert.deepEqual(refs(['# Titre', '# Titre']), [])
  assert.deepEqual(refs(['> Citation une', '> Citation deux']), [])
})

test('CONTRE-ÉPREUVE : la PROSE dont le premier mot fait une lettre ne mord pas', () => {
  // `A travelling tutor…` / `A caravan of dwarfs…` : le jeton serait `A`, mais ce qui suit est la
  // suite de la PHRASE, pas l'ouverture d'un item.
  assert.deepEqual(refs(['A travelling tutor sets up shop.', 'A caravan of dwarfs stops off.']), [])
  assert.deepEqual(refs(['- A dry river begins to flow.', '- A polluted well becomes clean.']), [])
})

test('BORNE : un jeton de PONCTUATION OUVRANTE (`Pi`/`Ps`) ouvre une CITATION, pas un item', () => {
  // La page IMPRIME ce signe : le dialogue français en est plein, et il ne se soldera jamais.
  for (const ouvrant of ['«', '“', '‹', '(', '[', '{']) {
    assert.deepEqual(
      refs([`- ${ouvrant} Où vas-tu ? , demandai-je doucement.`, `- ${ouvrant} Ah , dit-il, voilà qui est mieux.`]),
      [],
      ouvrant,
    )
    assert.equal(jetonDeLigne(`- ${ouvrant} Où vas-tu ?`), null, ouvrant)
  }
})

test('CONTRE-ÉPREUVE de la borne : seule la ponctuation OUVRANTE sort, et seulement en position de JETON', () => {
  // La ponctuation FERMANTE n'ouvre rien : elle reste un jeton comme un autre.
  assert.deepEqual(refs(['- » Act with honour.', '- » Obey all orders.']), ['« » » :: act with honour.'])
  // `OUVRE_UN_ITEM` admet `[` en position de CONTENU : les deux positions ne se confondent pas.
  assert.deepEqual(jetonDeLigne('- 0 [Ablaze]'), { jeton: '0', contenu: '[Ablaze]' })
})

test('COUVERTURE DITE : l’item ISOLÉ et la puce INTERNE à une ligne restent INVISIBLES', () => {
  // Une liste d'UN SEUL item à jeton : aucun frère, donc aucune répétition — la garde ne la voit pas.
  assert.deepEqual(refs(['Un paragraphe.', '- 0 Act with honour.', 'Un autre paragraphe.']), [])
  assert.deepEqual(refs(['- 0 Act with honour.']), [])
  // Colonnes de la page effondrées par l'extraction : le jeton n'OUVRE pas la ligne.
  assert.deepEqual(refs(['- *Ablaze* 0 *Besmirched*', '- *Bleeding* 0 *Blinded*']), [])
})

test('une ligne VIDE ne rompt pas la suite, toute autre ligne la rompt', () => {
  assert.deepEqual(refs(['- 0 Act with honour.', '', '- 0 Obey all orders.']), ['« 0 » :: act with honour.'])
  assert.deepEqual(refs(['- 0 Act with honour.', '## Titre', '- 0 Obey all orders.']), [])
})

test('jetonDeLigne : le jeton d’UN caractère et son contenu, ou rien', () => {
  assert.deepEqual(jetonDeLigne('- 0 **Gold:** The rulers'), { jeton: '0', contenu: '**Gold:** The rulers' })
  assert.deepEqual(jetonDeLigne('  0 Act'), { jeton: '0', contenu: 'Act' })
  assert.equal(jetonDeLigne('- 0 '), null, 'un jeton sans contenu n’est pas un item')
  assert.equal(jetonDeLigne('- **Gold:** The rulers'), null)
  assert.equal(jetonDeLigne(''), null)
})

test('la RÉF porte du CONTENU, jamais une position — un paragraphe inséré ne la bouge pas', () => {
  const suite = ['- 0 **Gold:** The rulers of society.', '- 0 **Silver:** Skilled professionals.']
  assert.deepEqual(refs(suite), refs(['Un paragraphe de plus.', '', ...suite]))
  // La réf NORMALISE l'habillage : la même ligne dégrassie garde sa clé.
  assert.equal(refDeSuite('0', '**Gold:** The rulers'), refDeSuite('0', 'Gold: The rulers'))
})

test('deux suites de même ouverture dans un fichier se départagent par l’OCCURRENCE', () => {
  const suite = ['- 0 Act with honour.', '- 0 Obey all orders.']
  const sites = sitesDuChapitre([...suite, 'Un paragraphe.', ...suite].join('\n'), FICHIER)
  assert.equal(sites.length, 2)
  assert.equal(sites[0].ref, sites[1].ref)
  assert.deepEqual(entreesRegenerees(sites, { lot: 'x', date: 'y' }).map((e) => e.occurrence), [1, 2])
})

test('scanBookDir : le `fichier` d’un site est le chapitre extrait, en POSIX depuis la racine du dépôt', () => {
  // Le corpus RENVOIE le livre : le premier scan non vide fait foi — aucun sigle ni dossier écrit ici.
  let sites = []
  for (const [, dir] of BOOKS) { sites = scanBookDir(dir); if (sites.length) break }
  assert.ok(sites.length > 0, 'le corpus `Source/` porte au moins un site mesuré')
  for (const s of sites.slice(0, 20)) assert.match(s.file, /^Source\/[^\\]+\/[^\\]+\.md$/)
})

test('COUVERTURE : le balayage voit TOUT le registre — chaque livre est classé, aucun site orphelin', () => {
  const sites = scanAllBooks()
  const comptes = comptesParLivre(sites)
  assert.deepEqual([...comptes.keys()], BOOKS.map(([abbr]) => abbr))
  assert.equal([...comptes.values()].reduce((a, b) => a + b, 0), sites.length, 'tout site appartient à un livre du registre')
})

test('stock COMMITTÉ : chaque site mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuVolet({ sites: scanAllBooks(), stock: lireEntreesDeSite(STOCK_PATH), ou: 'source-puces-stock.json' })
  assert.deepEqual(neuves, [], `site(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

// AUCUN GÉNÉRATEUR SÉPARÉ : le fichier de stock EST le texte de sa régénération (`regenerations`), écrit
// par `npx tsx scripts/guards/lib/regenStock.mts scripts/raw/check-source-puces.mjs`. Ce test le
// vérifie à l'octet, ORDRE compris, là où l'écart ci-dessus ne juge que les ensembles.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  for (const r of regenerations(scanAllBooks())) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

test('la CLÉ observe tout ce qui localise une entrée — aucun champ aveugle', () => {
  assert.deepEqual(champsAveugles(lireEntreesDeSite(STOCK_PATH), cleDeSite, CHAMPS_DE_CLE), [])
})

// #1825 : l'ordre des livres vit dans `src/data/books.json`, et aucun artefact commité ne s'y
// asservit — insérer un livre AU MILIEU du registre ne doit réécrire aucun stock. Registre INJECTÉ.
test('#1825 le rendu du stock est INDIFFÉRENT à l’ordre du registre (registre inversé)', () => {
  const cles = (books) => entreesRegenerees(scanAllBooks(books)).map(cleDeSite)
  assert.deepEqual(cles([...BOOKS].reverse()), cles(BOOKS))
})
