// Garde des TABLES CASSÉES du `Source/` (#1384, épique #1388). L'extraction Marker rend les tables
// imprimées avec des défauts de FORME qui les laissent inadressables (`descRef` de cellule) : un
// `<br>` littéral dans une cellule, une continuation de table après saut de page dont les
// « en-têtes » sont une fourchette de données, un bandeau de titre non absorbable, et des clés de
// ligne partagées entre deux tables d'une même section (qui rendent `ligne-ambigue` à la résolution).
//
// CE QUI N'EST PAS UN DÉFAUT ICI : un marqueur de folio (`<span data-folio>`) collé à la première
// ligne d'une table. La LIB l'absorbe (`toBlocks` applique `stripSpans` AVANT `parseTable`) — mesuré
// le 2026-09-14 : 25 lignes sur 25 ouvrent bien par `|` une fois les `<span>` retirés, et aucun
// lecteur ne lit ces lignes à l'état brut. Il ne bloque donc AUCUNE adresse, et l'ancre reste où la
// page coupe : `Source/` ne se réécrit pas pour un défaut que la lib absorbe déjà.
//
// QUI POSSÈDE QUOI : le PARSEUR (`src/data/source/decoupe.ts`) définit la table — ce script importe
// `parseChapitre`, `tablesOf`, `normText` et `estCleDePlage` (et lit, par `tablesOf`, ce que
// `parseTable` a décidé : `titre` absorbé, `banniereRefusee`), il n'en redéfinit AUCUN ; il CONSOMME
// et NOMME. La réparation, elle, vit dans `Source/` (geste `docs/ajouter-un-livre-source.md` §7) —
// jamais dans un remède au parsing.
//
// STOCK NOMINATIF (`scripts/raw/source-tables-stock.json`, régime #1711) : une ENTRÉE par SITE,
// clé `famille :: fichier :: ref :: occurrence` (`guards/lib/stock.mjs`, `cleDeSite` — seule définition, #1727). La clé ne porte
// JAMAIS une position : ni la ligne du `.md` (elle dérive à chaque correction), ni l'ordinal de la
// table dans sa section (26 % des tables bougeraient à la moindre insertion). Elle porte le
// CONTENU : la section et les en-têtes normalisés, l'`occurrence` départageant deux tables de mêmes
// en-têtes (les continuations de page). Les deux sens sont rouges : un site MESURÉ hors du stock
// (corriger, ou déclarer par `CLIQUET:`), une entrée SANS site mesuré (défaut réparé : la retirer).
//
// Re-run    : node scripts/raw/check-source-tables.mjs
// Régénérer : node scripts/raw/check-source-tables.mjs --ecrire-stock [--lot <#N …>] — le lot est REQUIS dès qu'une entrée NEUVE naît (`ecrireStockSousLot`, scripts/guards/lib/stock.mjs)
import { writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, readText } from './_lib.mjs'
import { estNomDExtraction } from '../../src/data/source/decoupe.ts'
import { ecartDuVolet, sitesEnEntrees, cleDeSite, ecrireStockSousLot, phraseDeNaissance, survieDeLecheance } from '../guards/lib/stock.mjs'
import { naissanceEnPlace, parCleDeSite, readStock } from './stockNominatif.mjs'
import { parseChapitre, tablesOf, normText, estCleDePlage, plageDeLigne1, lignesDesignees } from '../../src/data/source/decoupe.ts'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-tables-stock.json')

/** Les familles de défaut, dans l'ordre du rapport. Chacune est un GESTE de réparation distinct
 *  (cf. le tableau « défaut de table → geste » de `docs/ajouter-un-livre-source.md` §7). */
export const FAMILLES = [
  'br-litteral',
  'donnee-en-tete',
  'banniere-suspecte',
  'cle-de-ligne-ambigue',
  'table-avalee-par-titre',
]

/** Nombre d'ATOMES (suites de non-espaces) d'une ligne de titre à partir duquel elle porte une
 *  TABLE : un bandeau, sa rangée de labels et ses valeurs ne tiennent pas en moins. */
const ATOMES_DE_TABLE = 10
/** Nombre d'atomes PORTEURS DE CHIFFRE qu'il faut pour que la série soit des VALEURS et non une
 *  date, un horaire ou un renvoi de page glissés dans un intitulé. */
const ATOMES_CHIFFRES_DE_TABLE = 3
const SPANS_DE_LIGNE = /<\/?span[^>]*>/g
const TITRE = /^#{1,6}\s+(\S.*)$/
const RUN_GRAS = /\*\*[^*]*\*\*/g
const decouper = (s) => s.split(/\s+/).filter(Boolean)

/** Le premier SEGMENT d'un titre : le texte NU qui précède son premier run gras s'il y en a un,
 *  sinon ce premier run gras, sinon (aucun gras) le titre entier. C'est le BANDEAU tel que la page
 *  l'imprime, quelle que soit la façon dont l'extraction a réparti l'emphase. */
function segmentDeTete(corps) {
  const i = corps.indexOf('**')
  if (i < 0) return corps
  const nu = corps.slice(0, i).trim()
  if (nu) return nu
  const gras = /\*\*(.+?)\*\*/.exec(corps)
  return gras ? gras[1] : corps
}

/**
 * Un TITRE qui porte une TABLE : l'extraction a effondré le bandeau, la rangée de labels et les
 * valeurs sur la ligne du heading, et la table n'existe plus (aucune autre famille ne la voit —
 * elles ne mesurent que des tables). Ce que la classe a de propre, c'est ce qu'une table EST : une
 * SÉRIE DE VALEURS CHIFFRÉES (`ATOMES_CHIFFRES_DE_TABLE`) dans une ligne longue comme une table
 * (`ATOMES_DE_TABLE`), dont une part reste HORS des runs gras — l'extraction met le bandeau et les
 * labels en gras, les valeurs en clair, et un titre dont RIEN ne déborde de son gras est un
 * intitulé, si long soit-il. Le bandeau peut donc être gras ou nu, la garde ne s'en soucie pas.
 * COUVERTURE DITE : ce détecteur ne voit pas une table avalée trop courte, ni une table SANS
 * chiffres (un index de noms, une rangée de labels seule), ni une table dont l'extraction a mis
 * jusqu'aux valeurs à l'intérieur du run gras. Il nomme en revanche tout ce qui a la FORME d'une
 * série de valeurs, y compris des légendes numérotées qui n'ont jamais été une table : celles-là se
 * tranchent au PDF, une par une, par la `preuve` de leur entrée — jamais par une liste de titres.
 * L'ornement de gouttière collé à un titre (`# **MANTICORE** XII`), le titre courant fusionné
 * (`#### **PROSTHETICS** XI **MAGICAL ITEMS**`) et l'intitulé qui porte son horaire sont écartés
 * par CONSTRUCTION : trop courts, ou sans série chiffrée (mobilier de page, #1739).
 * @param {string} ligne la ligne BRUTE du `.md` @returns {string|null} la RÉF du site, ou `null`
 */
export function titreAvalantUneTable(ligne) {
  const m = TITRE.exec(String(ligne).replace(SPANS_DE_LIGNE, '').trim())
  if (!m) return null
  const atomes = decouper(m[1].replace(/\*\*/g, ' '))
  if (atomes.length < ATOMES_DE_TABLE) return null
  if (atomes.filter((a) => /\d/.test(a)).length < ATOMES_CHIFFRES_DE_TABLE) return null
  if (decouper(m[1].replace(RUN_GRAS, ' ')).length === 0) return null
  return normText(segmentDeTete(m[1]))
}

/** RÉF d'une table : sa section et ses en-têtes NORMALISÉS — du contenu, jamais une position.
 *  Le `<br>` littéral y compte pour une ESPACE sans aucun traitement local : `normText` compose
 *  `sansBr` (`src/data/source/normalize.ts`, définition UNIQUE de la forme), donc une clé ne bouge
 *  pas le jour où le site se corrige à la main dans `Source/`. */
export const refDeTable = (sec, occ, headers) =>
  `${sec}#${occ} :: ${headers.map((h) => normText(h)).join('|')}`

/** Clé de LIGNE d'une rangée : sa première cellule non vide, normalisée (`''` si la rangée est vide,
 *  `<br>` absorbé par `normText` comme dans la réf ci-dessus). */
export const cleDeLigne = (row) => normText(row.find((c) => c.trim()) ?? '')

/**
 * Sites de défaut d'UN chapitre (PUR : aucun accès disque). `file` est le chemin du chapitre tel que
 * le stock le nomme ; `texte` son markdown (déjà passé par `readText`).
 * @param {string} texte @param {string} file @returns {{ famille: string, file: string, ref: string }[]}
 */
export function sitesDuChapitre(texte, file) {
  const out = []
  const chapitre = parseChapitre(texte)
  // Ligne BRUTE du heading (`section.line`) : le run gras y est encore lisible, là où `title` l'a
  // déjà effacé (`cleanTitle`, `src/data/source/decoupe.ts`).
  const lignes = texte.replace(/\r\n?/g, '\n').split('\n')
  for (const section of chapitre.sections) {
    const avalee = section.level > 0 ? titreAvalantUneTable(lignes[section.line - 1] ?? '') : null
    if (avalee) out.push({ famille: 'table-avalee-par-titre', file, ref: avalee })
    const tables = tablesOf(section)
    for (const { table } of tables) {
      const ref = refDeTable(section.slug, section.occ, table.headers)
      const cellules = [...table.headers, ...table.rows.flat()]
      if (cellules.some((c) => /<br\s*\/?>/i.test(c))) out.push({ famille: 'br-litteral', file, ref })
      if (estCleDePlage(table.headers[0] ?? '')) out.push({ famille: 'donnee-en-tete', file, ref })
      if (table.banniereRefusee != null) out.push({ famille: 'banniere-suspecte', file, ref })
    }
    // Clés de ligne PARTAGÉES : une clé présente dans DEUX tables de la même section rend
    // `ligne-ambigue` à la résolution (`celluleBrute` cherche dans toute la section), sauf si l'adresse
    // la sépare dans CHAQUE table (`FragmentCellule.table` = `TableDeSection.cle`, titre non vide,
    // `lignesDesignees`, #1739). Une entrée par
    // CLÉ, jamais par section : au grain section, réparer 19 clés sur 20 ne se verrait pas (#1727).
    // COUVERTURE DITE — cette famille ne nomme QUE les clés partagées ENTRE tables, parce que c'est
    // le périmètre exact d'UN geste : restituer les titres imprimés qui séparent les tables — heading
    // de section, ou légende de table. Le
    // prédicat réel de `rowsMatching` est bien plus large, et mesuré le 2026-09-14 sur les 16 livres :
    // 145 clés partagées entre tables (ce qui suit), 220 si l'on compte aussi les clés DUPLIQUÉES
    // dans une même table, 2 289 si l'on compte toute VALEUR de cellule répétée dans la section.
    // Les 2 144 de l'écart ne sont pas niés : ils ne se réparent pas par un heading, et la famille
    // qui les porterait n'aurait aucun geste à offrir.
    if (tables.length >= 2) {
      const parCle = new Map()
      tables.forEach(({ table }, i) => {
        for (const cle of new Set(table.rows.map(cleDeLigne).filter(Boolean))) {
          if (!parCle.has(cle)) parCle.set(cle, new Set())
          parCle.get(cle).add(i)
        }
      })
      for (const [cle, dansTables] of parCle) {
        if (dansTables.size < 2) continue
        if ([...dansTables].every((i) => lignesDesignees(section, cle, tables[i].cle) === 1)) continue
        out.push({ famille: 'cle-de-ligne-ambigue', file, ref: `${section.slug}#${section.occ} :: ${cle}` })
      }
    }
  }
  return out
}

/** Chemin POSIX d'un chapitre depuis la racine du dépôt (`Source/<livre>/<NN - X>.md`). */
const cheminDe = (dir, file) => `${String(dir).split('\\').join('/').replace(/\/$/, '')}/${file}`

/** Balaie un dossier de livre → sites de défaut de tous ses chapitres. */
export function scanBookDir(dir) {
  const out = []
  // Toute la FORME servie est jugée, l'index compris : il porte des tables comme un chapitre.
  for (const file of listerDossier(dir, { absent: 'vide' }).filter(estNomDExtraction)) {
    out.push(...sitesDuChapitre(readText(join(dir, file)), cheminDe(dir, file)))
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → sites agrégés, dans l'ordre du corpus. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [, dir] of books) out.push(...scanBookDir(dir))
  return out
}

/** Compte par famille (toutes les familles présentes, même à zéro). */
export const comptesParFamille = (sites) =>
  Object.fromEntries(FAMILLES.map((f) => [f, sites.filter((s) => s.famille === f).length]))

/**
 * Les ENTRÉES du stock, en ORDRE CANONIQUE (`parCleDeSite`) — c'est CE rendu que le fichier de stock
 * porte. L'ordre du BALAYAGE n'y entre pas : réordonner `src/data/books.json` ne réécrit pas ce
 * fichier (#1825).
 * `ancien` (les entrées déjà committées) porte la SURVIE : `survieDeLecheance`
 * (`scripts/guards/lib/stock.mjs`), seule définition du dépôt.
 * @param {{famille: string, file: string, ref: string}[]} sites
 * @param {{ lot: string, date: string, ancien?: Iterable<object> }} p
 */
export const entreesDe = (sites, { lot, date, ancien = [] }) =>
  FAMILLES.flatMap((famille) =>
    survieDeLecheance(sitesEnEntrees(sites.filter((s) => s.famille === famille), { famille }), { lot, date, ancien }),
  ).sort(parCleDeSite)

/** Les clés des sites MESURÉS (même occurrence que le stock : le calcul d'occurrence est celui de
 *  `sitesEnEntrees`, jamais un second comptage). */
export const clesMesurees = (sites) =>
  new Set(entreesDe(sites, { lot: '', date: '' }).map(cleDeSite))

/**
 * VERDICT des `preuve` du stock — une preuve est un FAIT daté (« PDF p.N : … »), pas une dispense :
 *   - `vides` : une entrée qui porte le champ `preuve` sans rien prouver (chaîne vide ou non-chaîne) ;
 *     exempter par un champ vide serait un cliquet percé ;
 *   - `perimees` : une entrée PROUVÉE dont le site n'est plus mesuré — la preuve parle d'un site qui
 *     n'existe plus (`Source/` a bougé), elle se re-lit au PDF ou l'entrée se retire.
 * @returns {{ vides: string[], perimees: string[] }}
 */
export function verdictDesPreuves(sites, stock) {
  const mesurees = clesMesurees(sites)
  const vides = []
  const perimees = []
  for (const e of stock) {
    if (!('preuve' in e)) continue
    if (typeof e.preuve !== 'string' || !e.preuve.trim()) {
      vides.push(`${cleDeSite(e)} — \`preuve\` VIDE : une preuve est un fait lu au PDF (« PDF p.N : … »), ou rien.`)
      continue
    }
    if (!mesurees.has(cleDeSite(e))) {
      perimees.push(`${cleDeSite(e)} — preuve PÉRIMÉE : ce site n'est plus mesuré, la preuve ne parle plus de rien.`)
    }
  }
  return { vides, perimees }
}

/** Ligne 1 d'un `.md` du dépôt, ou `null` s'il est introuvable — le seul accès DISQUE de la
 *  contre-épreuve, isolé pour que son cœur reste pur. */
export const lireLigne1Du = (fichier) => {
  try {
    return readText(fichier).split('\n')[0] ?? ''
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/** Page citée par une preuve (`PDF p.364 : …`, `PDF p.2 : …`). Une preuve qui n'en cite aucune ne
 *  parle pas d'une page et ne se confronte à rien. */
const PAGE_CITEE = /\bp\.\s*(\d+)/

/**
 * CONTRE-ÉPREUVE des preuves : une preuve qui cite `p.N` doit keyer un fichier dont la PLAGE
 * contient N. C'est la seule mesure INDÉPENDANTE de la liste de découpe — elle tombe aussi bien sur
 * un `pageFin` faux DANS la liste que sur un re-keyage (`recouper-source.mjs#recalerStock`) qui
 * aurait posé la preuve sur le fichier voisin. La plage se lit par `plageDeLigne1`
 * (`src/data/source/decoupe.ts`, SEULE définition) : aucun motif `*Pages PDF*` ne vit ici.
 *
 * PUR : le lecteur de ligne 1 est INJECTÉ. GÉNÉRAL : aucun livre n'est nommé, toute entrée à preuve
 * est jugée. Une preuve sans `p.N` n'est pas jugée ; un fichier dont la ligne 1 ne se lit pas ALORS
 * QUE sa preuve cite une page est un rouge NOMMÉ — jamais un silence.
 * @param {{ fichier: string, preuve?: string }[]} stock
 * @param {(fichier: string) => string | null} lireLigne1 ligne 1 du fichier, ou `null` s'il est absent
 * @returns {string[]} un message par preuve hors plage, nommant fichier, plage et page citée
 */
export function preuvesHorsPlage(stock, lireLigne1) {
  const out = []
  for (const e of stock) {
    if (typeof e.preuve !== 'string') continue
    const m = PAGE_CITEE.exec(e.preuve)
    if (!m) continue
    const page = Number(m[1])
    const ligne1 = lireLigne1(e.fichier)
    if (ligne1 == null) {
      out.push(`${cleDeSite(e)} — preuve à la page ${page}, mais le fichier « ${e.fichier} » est INTROUVABLE.`)
      continue
    }
    const plage = plageDeLigne1(ligne1)
    if (!plage) {
      out.push(`${cleDeSite(e)} — preuve à la page ${page}, mais « ${e.fichier} » n'a pas de ligne 1 lisible (« ${String(ligne1).trim().slice(0, 40)} »).`)
      continue
    }
    if (page < plage.page || page > plage.pageFin) {
      out.push(`${cleDeSite(e)} — preuve à la page ${page}, HORS de la plage ${plage.page}-${plage.pageFin} de « ${e.fichier} ».`)
    }
  }
  return out
}

/** Comptes de la dette : ce qui reste À TRIER (aucune preuve) et ce qui est VÉRIFIÉ (preuve lue au PDF). */
export const comptesDeTri = (stock) => {
  const verifies = [...stock].filter((e) => typeof e.preuve === 'string' && e.preuve.trim()).length
  return { aTrier: [...stock].length - verifies, verifies }
}

/**
 * ÉCART au stock, famille par famille (le stock d'une famille ne juge que ses sites : mêlés, tous
 * les sites des autres familles paraîtraient périmés).
 * @returns {{ neuves: string[], perimees: string[] }}
 */
export function ecartDuStock(sites, stock) {
  const neuves = []
  const perimees = []
  for (const famille of FAMILLES) {
    const r = ecartDuVolet({
      sites: sites.filter((s) => s.famille === famille),
      stock: stock.filter((e) => e.famille === famille),
      famille,
      ou: 'source-tables-stock.json',
    })
    neuves.push(...r.neuves)
    perimees.push(...r.perimees)
  }
  return { neuves, perimees }
}

const QUOI = (comptes) =>
  'Tables du `Source/` que leur FORME rend inadressables (#1384, épique #1388) : une ENTRÉE par SITE, ' +
  `clé \`famille :: fichier :: ref :: occurrence\` (régime #1711). ${phraseDeNaissance(comptes, FAMILLES)} ` +
  'CE FICHIER EST UN INVENTAIRE des sites mesurés, PLAFONNÉ en nombre d\'entrées : il ne décroît que ' +
  'quand un site disparaît du `Source/`. La DETTE, elle, est le compte « à trier » — les entrées SANS ' +
  '`preuve` — et celle-là décroît vers zéro, sous son propre plafond (`PLAFOND_A_TRIER`, ' +
  '`check-source-tables.test.mjs`) : une entrée reçoit sa `preuve` (« PDF p.N : … ») + sa `date` le jour ' +
  'où sa forme est lue au PDF et jugée conforme au livre, et elle RESTE (le site existe, il est jugé). ' +
  'PLAN de résorption — B2 : AUCUNE migration de `Source/`. Un `<br>` de cellule est un saut de ' +
  'ligne IMPRIMÉ (GFM n\'a pas d\'autre forme) : la lib l\'absorbe pour l\'ADRESSAGE (`sansBr`) et le ' +
  'rend en `\\n` pour une cellule (`brEnSaut`), donc il ne bloque plus une adresse. Son SENS, lui, se ' +
  'lit AU PDF, site par site : une CÉSURE typographique se corrige en espace dans `Source/`, une ' +
  'liste d\'items imprimée en colonne se garde telle quelle et se solde par une `preuve` sur son ' +
  'entrée (« PDF p.N : … » + `date`). B3 et suivants : une ZONE par train, ' +
  'corrigée à la main au PDF (geste `docs/ajouter-un-livre-source.md` §7) — `18 - Traumatisme`, ' +
  '`10 - Talents`, `61 - Encombrement`, `62 - Les armes`, `85 - Traits`, `08 - Statut`, ' +
  '`14 - _GoBack`, `40 - Les prières`, `46 - Les règles magiques`, `05 - _gjdgxs` du Livre de base ; ' +
  'zones portées par tickets existants : #1707 (table de Talents dupliquée), #1519 ' +
  '(`51 - Magie du Chaos` mal titré), #678 (EDOC `09 - _GoBack.md`, en-têtes orphelins). Le résidu de ' +
  'SCÉNARIO (hors donnée de règle) est porté par #1731. ' +
  'COUVERTURE DITE de `cle-de-ligne-ambigue` : elle nomme les clés partagées ENTRE tables d\'une ' +
  'section — le périmètre d\'UN geste (restituer les headings imprimés). Les clés dupliquées DANS ' +
  'une même table et les valeurs non-clés répétées rendent aussi `ligne-ambigue` et restent HORS de ' +
  'cette famille : mesuré le 2026-09-14, 145 ici, 220 au grain « clé dupliquée dans la section », ' +
  '2 289 au prédicat réel de `rowsMatching` (toute valeur de cellule répétée). ' +
  'LIMITE DITE : `banniere-suspecte` est le résidu que la garde du parseur n\'absorbe PAS. Il se ' +
  'ventile (mesure du 2026-09-14) en texte NON majuscule 51, bandeau MAJUSCULE sans rangée de ' +
  'donnée 49 (pour l\'essentiel des titres de statbloc de PNJ et leurs rubriques : ' +
  '« ISABELLA — PROPHÈTE (BRONZE 4) », « COMPÉTENCES DE BASE »), une seule lettre 11, aucune ' +
  'lettre 1, et bandeau MAJUSCULE devant une table SANS en-têtes 1 (fourchette en `headers[0]`). ' +
  'Chacun se tranche au PDF, un par un, jamais par un élargissement de la garde qui sauterait un ' +
  'en-tête réel. ' +
  'COUVERTURE DITE de `table-avalee-par-titre` : elle nomme la ligne de TITRE qui porte une table ' +
  'entière — bandeau, rangée de labels et valeurs à plat. Elle la reconnaît à ce qu\'une table EST : ' +
  'une SÉRIE DE VALEURS CHIFFRÉES (`ATOMES_CHIFFRES_DE_TABLE`) dans une ligne longue comme une ' +
  'table (`ATOMES_DE_TABLE`), dont une part déborde des runs gras — le bandeau, lui, peut être gras ' +
  'ou nu. Restent invisibles : une table avalée trop courte, une table SANS chiffres (un index de ' +
  'noms, une rangée de labels seule), et celle dont l\'extraction a mis jusqu\'aux valeurs dans le ' +
  'run gras. À l\'inverse, tout ce qui a la FORME d\'une série de valeurs entre ici, y compris des ' +
  'légendes numérotées qui n\'ont jamais été une table : elles se tranchent au PDF par la `preuve` ' +
  'de leur entrée, comme tout site, jamais par une liste de titres dans la garde.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). Les comptes
 *  à la naissance sont ceux du stock en place (`naissance`), sinon ceux du jour. */
export const stockDe = (sites, { lot, date, ancien = [], naissance = null }) =>
  `${JSON.stringify({ quoi: QUOI(naissance ?? comptesParFamille(sites)), entrees: entreesDe(sites, { lot, date, ancien }) }, null, 2)}\n`

function main() {
  const args = process.argv.slice(2)
  const sites = scanAllBooks()
  const comptes = comptesParFamille(sites)
  const stock = readStock(STOCK_PATH)

  if (args.includes('--ecrire-stock')) {
    const r = ecrireStockSousLot(
      args,
      (lot, date) => ({ entrees: entreesDe(sites, { lot, date, ancien: stock }), texte: stockDe(sites, { lot, date, ancien: stock, naissance: naissanceEnPlace(STOCK_PATH, FAMILLES) }) }),
      (texte) => writeFileSync(STOCK_PATH, texte),
      STOCK_PATH,
    )
    ;(r.code ? console.error : console.log)(r.message)
    process.exitCode = r.code
    return
  }

  const tri = comptesDeTri(stock)
  console.log(
    `tables cassées du Source/ : ${sites.length} site(s) sur ${new Set(sites.map((s) => s.file)).size} chapitre(s), ` +
      `${BOOKS.length} livre(s) — ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}`,
  )
  console.log(`stock : ${tri.aTrier} à trier (aucune preuve), ${tri.verifies} vérifié(s) au PDF.`)

  const { neuves, perimees } = ecartDuStock(sites, stock)
  const preuves = verdictDesPreuves(sites, stock)
  if (neuves.length) {
    console.log('RÉGRESSION — site(s) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (défaut réparé) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  const horsPlage = preuvesHorsPlage(stock, lireLigne1Du)
  if (preuves.vides.length || preuves.perimees.length || horsPlage.length) {
    console.log('PREUVE(s) en défaut :')
    for (const s of [...preuves.vides, ...preuves.perimees, ...horsPlage]) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length && !preuves.vides.length && !preuves.perimees.length && !horsPlage.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
