// Garde du FORMAT CANONIQUE des extractions de `Source/` (#1739, épique #1388). Toutes les
// extractions n'ont pas la même FORME : six livres portent un en-tête `*Folio N+*` et des ancres
// seules sur leur ligne (chaîne de 2026-07-07), un livre n'a aucun folio, quatre dossiers sont
// antérieurs au pipeline. Le format canonique — celui que `docs/ajouter-un-livre-source.md` décrit,
// que le découpeur produit — est UN, et cette garde MESURE l'écart de chaque dossier à ce format.
//
// QUI POSSÈDE QUOI : `docs/ajouter-un-livre-source.md` § « Format canonique » DÉFINIT la forme ;
// ce script la MESURE et NOMME les dossiers hors format ; `src/data/books.json` reste la source
// unique des livres à `dir`. Les dossiers FR encore hors registre (les quatre pré-pipeline) sont
// atteints par BALAYAGE de `Source/` sur les préfixes de `PREFIXES_FR` — sans quoi un dossier
// suivi mais non enregistré échapperait à toute garde.
//
// LE GESTE, UN SEUL : REJOUER la chaîne canonique sur le livre — re-découpe depuis la sortie
// Marker conservée sous `Source/_marker/`, ou ré-extraction quand cette sortie manque. Jamais un
// remède local de chapitre. Arbitrage utilisateur du 2026-09-14, verbatim : « Il faut un format
// unifié pour toutes les extractions, donc s'il faut rééxtraire, on rééxtrait » — fiche
// `.claude/memory/user-doctrine-format-unifie-reextraction-permise.md`.
//
// DEUX RÉGIMES, UNE DONNÉE. Le GRAIN d'un livre est sa LISTE DE DÉCOUPE
// (`scripts/raw/decoupes/<id>.json`), et elle s'applique par DEUX voies : le découpeur, quand le
// livre est (ré-)extrait ; `scripts/raw/recouper-source.mjs`, quand le `.md` en service porte des
// réparations de contenu qu'un rejeu de la sortie Marker écraserait (§ 7 de
// `docs/ajouter-un-livre-source.md`). D'où :
//  — livre AVEC liste : le dossier se CONFRONTE à la liste (`ecartsAuGrain`) — noms, ligne 1,
//    ouverture, index. Tout écart est un ROUGE NOMMÉ, sans stock : le geste tient en une commande.
//  — livre SANS liste : son grain n'est déclaré nulle part. Une entrée de stock par chapitre
//    (famille `sans-decoupe`), qui sort quand le livre est mis au grain.
//
// STOCK NOMINATIF (`scripts/raw/source-format-stock.json`, régime #1711) : une ENTRÉE par
// (famille, FICHIER, détail), clé `famille :: fichier :: ref :: occurrence`
// (`guards/lib/stock.mjs`, `cleDeSite` — seule définition, #1727). Le `fichier` est le chapitre
// fautif lui-même, la `ref` son détail : aucune clé ne porte le compte d'un DOSSIER, qu'un livre
// qui entre ou sort de la chaîne déplacerait tout entier (#1739, pose des folios du CRB). Un
// chemin de DOSSIER nu ne tombe sous aucun motif de `scripts/guards/lib/stocksNominatifs.mjs`
// (`CHEMIN_SOURCE` exige `.md`). Les deux sens sont rouges : un écart MESURÉ hors du stock
// (ré-extraire le livre, ou déclarer par `CLIQUET:`), une entrée SANS écart mesuré (la retirer).
//
// MOBILIER DE PAGE (famille `mobilier`, #1739) : pour tout livre dont la liste de découpe porte des
// `onglets`, un chiffre d'onglet ou un folio mêlé au flux est un ROUGE NOMMÉ, sans stock — le geste
// est `node scripts/raw/reparer-mobilier.mjs <id>`. Le prédicat est celui de la sonde
// (`lib/mobilier.mjs`), importé, jamais redit ; un mot du livre qui y tombe s'exempte AU SITE
// (`scripts/guards/lib/mobilierExemptions.mjs`) pour ses `jetons` sites exactement : au-delà, le site
// est rouge ; en deçà, l'exemption l'est.
//
// TITRES SOUDÉS (famille `titre-soude`, #1739) : pour tout livre dont la liste de découpe porte un
// `gabaritTitre`, une ligne ouverte par un gras que suit autre chose que sa prose (P5) ou une ligne de
// titre à deux groupes gras est un ROUGE NOMMÉ, sans stock — le geste est
// `node scripts/raw/reparer-titres.mjs <id>`. Le prédicat est celui de la réparation
// (`lib/titres-soudes.mjs`), importé, jamais redit.
//
// Re-run    : node scripts/raw/check-source-format.mjs
// Régénérer : node scripts/raw/check-source-format.mjs --ecrire-stock [--lot <#N …>] — le lot est REQUIS dès qu'une entrée NEUVE naît (`ecrireStockSousLot`, scripts/guards/lib/stock.mjs)
import { existsSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier, parUnitesDeCode } from '../guards/lib/lister.mjs'
import { BOOKS, readText } from './_lib.mjs'
import { ecartDuVolet, ecrireStockSousLot, phraseDeNaissance, sitesEnEntrees, survieDeLecheance } from '../guards/lib/stock.mjs'
import { naissanceEnPlace, readStock } from './stockNominatif.mjs'
import { estSeparateur, graphieDeChapitre, graphieDuFichier, largeurDeChapitre, ligne1DePlage, numeroDuFichier, plageDeLigne1, titreDuFichier } from '../../src/data/source/decoupe.ts'
import { estLigneDeTitre, ouvreSur } from './lib/titres.mjs'
import { decoupeDe, gabaritTitreDe, livreDuDossier, livresDecoupes, nomsDeLaListe, ongletsDe, REGISTRE_LIVRES } from './_lib.mjs'
import { exemptionsFausses, mobilierDuDossier } from './lib/mobilier.mjs'
import { sitesDeTitresSoudes } from './lib/titres-soudes.mjs'
import { EXEMPTIONS_MOBILIER } from '../guards/lib/mobilierExemptions.mjs'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-format-stock.json')

/** Racine des extractions. */
export const RACINE_SOURCE = 'Source'

/** Préfixes des dossiers FRANÇAIS suivis de `Source/`. La garde couvre en plus tout livre à `dir`
 *  de `books.json`, quel que soit son préfixe (`dossiersFR`). Le reste de `Source/` est la VO du
 *  dépôt parent MJ, hors de cette garde ; son unique livre citable est nommé au CLAUDE.md
 *  § Sources VF. */
export const PREFIXES_FR = [
  'Warhammer v4 - ',
  'WH - V4 - ',
  'WH4_FR_',
  "Boite d'Initiation",
  'Warhammer - Habitants',
]

/** Les familles d'écart, dans l'ordre du rapport. Chacune est un défaut de FORME distinct. */
export const FAMILLES = [
  'ligne1-hors-format',
  'sans-folio',
  'ancre-seule',
  'nom-de-signet',
  'html-residuel',
  'index-mort',
  'table-sans-separateur',
  'largeur-de-numero',
  'sans-decoupe',
]

export const INDEX = '00 - Index.md'

/** Ancre de page telle que la chaîne canonique la pose (INLINE, préfixe du texte de sa ligne). */
const ANCRE_PAGE = /<span [^>]*id="page-[^"]*"[^>]*>\s*<\/span>/g
const ANCRE_SEULE = /^<span [^>]*id="page-[^"]*"[^>]*>\s*<\/span>$/

/**
 * FORME de la ligne 1 d'un chapitre, ou `null` si elle est canonique. La forme est ce que le stock
 * NOMME : c'est elle qui dit de quelle chaîne d'extraction le livre est sorti.
 * @param {string} ligne @returns {string | null}
 */
export function formeDeLigne1(ligne) {
  const t = ligne.trim()
  if (plageDeLigne1(t) != null) return null
  if (/^\*Folio -?\d+\+?\*$/.test(t)) return '*Folio N+*'
  if (t.startsWith('#')) return '# Titre'
  if (t === '') return '(ligne vide)'
  return 'autre'
}

/** Le titre d'un chapitre est-il un SIGNET Word (`_GoBack`, `_gjdgxs`, `Sans titre`) plutôt que le
 *  titre imprimé ? Ces noms polluent l'index et rendent la réf de chapitre illisible. */
export const estNomDeSignet = (titre) => titre.startsWith('_') || /^sans titre$/i.test(titre.trim())

/** La ligne DÉBARRASSÉE de ses ancres de page (une table ouverte par une ancre reste une table). */
const sansAncres = (ligne) => ligne.replace(ANCRE_PAGE, '')

/**
 * Blocs de TABLE d'un texte : suites maximales de lignes ouvrant par `|`.
 * @returns {{ total: number, sansSeparateur: number }}
 */
export function comptesDeTables(texte) {
  const lignes = texte.split('\n')
  let total = 0
  let sansSeparateur = 0
  let bloc = []
  const clore = () => {
    if (!bloc.length) return
    total += 1
    if (bloc.length < 2 || !estSeparateur(bloc[1])) sansSeparateur += 1
    bloc = []
  }
  for (const l of lignes) {
    if (sansAncres(l).trim().startsWith('|')) bloc.push(sansAncres(l))
    else clore()
  }
  clore()
  return { total, sansSeparateur }
}

/**
 * Balises HTML RÉSIDUELLES d'un texte, par nom de balise. Hors périmètre : `<br>` (le RAW imprimé
 * porte de vraies césures) et les ancres de page, qui SONT le format canonique. Une ancre sans
 * `data-folio` n'est donc pas comptée ici : la famille `sans-folio` la nomme déjà, au grain du
 * chapitre — la compter deux fois dirait deux réparations là où il n'y en a qu'une.
 * @returns {Map<string, number>}
 */
export function balisesResiduelles(texte) {
  const out = new Map()
  // Balise OUVRANTE seule : compter aussi `</sup>` doublerait chaque ÉLÉMENT (mesuré le
  // 2026-09-14 : 392 balises pour 196 `<sup>` imprimés).
  for (const m of texte.replace(ANCRE_PAGE, '').matchAll(/<([a-zA-Z][\w-]*)\b[^>]*>/g)) {
    const tag = m[1].toLowerCase()
    if (tag === 'br') continue
    out.set(tag, (out.get(tag) ?? 0) + 1)
  }
  return out
}

/**
 * PREMIÈRE ligne de TITRE d'un chapitre, ou `null` s'il n'en porte aucune — un fichier sans titre
 * (couverture, planche) n'a pas d'ouverture à juger. La ligne est rendue TELLE QUELLE : c'est le
 * prédicat d'ouverture (`lib/titres.mjs`) qui la lit, et lui seul.
 * @param {string} texte @returns {string | null}
 */
export function ligneDOuverture(texte) {
  return texte.split('\n').find((l) => estLigneDeTitre(l)) ?? null
}

/** Cibles des liens RELATIFS d'un index (`[x](<01 - Y.md>)` ou `[x](01%20-%20Y.md)`). */
export function liensDIndex(texte) {
  const out = []
  for (const m of texte.matchAll(/\]\((?:<([^>]+)>|([^)\s]+))\)/g)) {
    const cible = m[1] ?? m[2]
    if (/^(?:https?:|mailto:|#)/.test(cible)) continue
    let decode = cible
    try { decode = decodeURIComponent(cible) } catch { /* cible non décodable : jugée telle quelle */ }
    out.push(decode)
  }
  return out
}

/**
 * Sites d'écart d'UN dossier (PUR : aucun accès disque). `dir` est le chemin POSIX du dossier ;
 * `fichiers` la liste `{ nom, texte }` de ses `.md`. UN SITE PAR FICHIER fautif et par famille (et
 * par balise pour `html-residuel`) : le `fichier` du stock est CE fichier, la `ref` porte son détail
 * SANS cardinal ; le compte d'occurrences du défaut dans CE fichier est le `nombre`, hors clé — une
 * réparation partielle ne change pas l'identité du site.
 *
 * COUVERTURE DITE : les familles (1) à (4), (8) et (9) ne jugent que les fichiers au motif
 * `NN - X.md` (`CHAPITRE_RE`), `00 - Index.md` exclu — un `.md` hors motif leur est INVISIBLE
 * (mesuré le 2026-09-14 : 0 fichier hors motif sur les 20 dossiers FR). Les familles (5)
 * `html-residuel` et (7) `table-sans-separateur` balaient TOUS les `.md` du dossier, index compris ;
 * (6) `index-mort` ne lit que `00 - Index.md`.
 * @param {string} dir @param {{ nom: string, texte: string }[]} fichiers
 * @returns {{ famille: string, file: string, ref: string, nombre?: number }[]}
 */
export function sitesDuDossier(dir, fichiers, liste = null) {
  const out = []
  const noms = new Set(fichiers.map((f) => f.nom))
  const chapitres = fichiers.filter((f) => numeroDuFichier(f.nom) != null)
  const chemin = (nom) => `${dir}/${nom}`
  const site = (famille, nom, ref, nombre = null) => out.push({ famille, file: chemin(nom), ref, ...(nombre == null ? {} : { nombre }) })

  // (1) ligne 1 hors format — sa FORME.
  for (const { nom, texte } of chapitres) {
    const forme = formeDeLigne1(texte.split('\n')[0] ?? '')
    if (forme) site('ligne1-hors-format', nom, forme)
  }

  // (2) chapitre SANS aucune ancre `data-folio` : rien n'y est adressable au folio imprimé.
  for (const { nom, texte } of chapitres) if (!/data-folio/.test(texte)) site('sans-folio', nom, 'aucune ancre data-folio')

  // (3) ancres SEULES sur leur ligne : la forme « scan/folio », qui casse l'adressage au texte
  // (l'ancre ne préfixe plus le paragraphe qu'elle ouvre).
  for (const { nom, texte } of chapitres) {
    const seules = texte.split('\n').filter((l) => /data-folio/.test(l) && ANCRE_SEULE.test(l.trim())).length
    if (seules) site('ancre-seule', nom, 'ancre(s) seule(s)', seules)
  }

  // (4) nom de SIGNET Word à la place du titre imprimé.
  for (const { nom } of chapitres) if (estNomDeSignet(titreDuFichier(nom))) site('nom-de-signet', nom, titreDuFichier(nom))

  // (5) HTML résiduel — par BALISE (chacune se retire d'un geste distinct).
  for (const { nom, texte } of fichiers) {
    const balises = balisesResiduelles(texte)
    for (const tag of [...balises.keys()].sort(parUnitesDeCode)) site('html-residuel', nom, `<${tag}>`, balises.get(tag))
  }

  // (6) index MORT : un lien relatif vers un fichier absent du dossier.
  const index = fichiers.find((f) => f.nom === INDEX)
  if (index) {
    const morts = liensDIndex(index.texte).filter((c) => !noms.has(c))
    if (morts.length) site('index-mort', INDEX, 'lien(s) mort(s)', morts.length)
  }

  // (7) tables sans ligne de SÉPARATEUR : le bloc n'est pas une table pour un parseur Markdown.
  for (const { nom, texte } of fichiers) {
    const { sansSeparateur } = comptesDeTables(texte)
    if (sansSeparateur) site('table-sans-separateur', nom, 'table(s) sans séparateur', sansSeparateur)
  }

  // (8) LARGEUR de numéro hétérogène : dans un dossier, TOUT préfixe a la largeur du plus grand
  // numéro du dossier (`largeurDeChapitre`, `src/data/source/decoupe.ts`). Mêlées (`07` et `100`
  // côte à côte), le tri lexicographique de n'importe quel listeur ment sur l'ordre des chapitres.
  const numeros = chapitres.map((f) => numeroDuFichier(f.nom))
  if (numeros.length) {
    const largeur = largeurDeChapitre(Math.max(...numeros))
    for (const f of chapitres) {
      if (graphieDuFichier(f.nom) !== graphieDeChapitre(numeroDuFichier(f.nom), largeur)) site('largeur-de-numero', f.nom, `hors largeur ${largeur}`)
    }
  }

  // (9) SANS DÉCOUPE : le livre n'a pas de LISTE DE DÉCOUPE (`scripts/raw/decoupes/<id>.json`), donc
  // le GRAIN de ses chapitres n'est déclaré nulle part et rien ne peut le confronter.
  if (liste == null) for (const { nom } of chapitres) site('sans-decoupe', nom, 'grain non déclaré')

  return out
}

/**
 * ÉCART AU GRAIN d'un livre QUI A UNE LISTE : ce que la liste déclare, confronté à ce que le dossier
 * porte — les NOMS, la LIGNE 1, le titre d'OUVERTURE et l'INDEX. La liste est la DÉCLARATION, le
 * dossier est le FAIT : tout écart est un ROUGE NOMMÉ, jamais une entrée de stock. Un stock dirait
 * « toléré » là où le geste tient en une commande (`node scripts/raw/recouper-source.mjs <id>`).
 * PUR : la liste est DONNÉE.
 * @param {string} dir @param {{ nom: string, texte: string }[]} fichiers
 * @param {{ titre: string, ouverture?: string, page: number, pageFin: number }[]} liste
 * @returns {{ file: string, ref: string }[]}
 */
export function ecartsAuGrain(dir, fichiers, liste) {
  const out = []
  const chemin = (nom) => `${dir}/${nom}`
  const parNom = new Map(fichiers.map((f) => [f.nom, f.texte]))
  const attendus = nomsDeLaListe(liste)

  const servis = fichiers.filter((f) => numeroDuFichier(f.nom) != null).map((f) => f.nom)
  const enTrop = servis.filter((n) => !attendus.includes(n))
  const manquants = attendus.filter((n) => !parNom.has(n))
  for (const n of manquants) out.push({ file: chemin(n), ref: 'déclaré par la liste de découpe, ABSENT du dossier' })
  for (const n of enTrop) out.push({ file: chemin(n), ref: 'servi, ABSENT de la liste de découpe' })

  liste.forEach((e, i) => {
    const nom = attendus[i]
    const texte = parNom.get(nom)
    if (texte == null) return
    const attendue = ligne1DePlage(e.page, e.pageFin)
    const l1 = (texte.split('\n')[0] ?? '').trim()
    if (l1 !== attendue) out.push({ file: chemin(nom), ref: `ligne 1 « ${l1.slice(0, 40)} » pour ${attendue}` })
    if (e.ouverture == null) return
    const ligne = ligneDOuverture(texte)
    if (ligne == null || !ouvreSur(ligne, e.ouverture)) {
      const vue = ligne == null ? null : ligne.replace(/<\/?span[^>]*>/g, '').trim()
      out.push({ file: chemin(nom), ref: `n'ouvre pas sur « ${e.ouverture} » (${vue == null ? 'aucune ligne de titre' : `l.1 de titre « ${vue.slice(0, 48)} »`})` })
    }
  })

  const index = parNom.get(INDEX)
  if (index == null) out.push({ file: chemin(INDEX), ref: 'index ABSENT d’un livre à liste de découpe' })
  else {
    const cibles = liensDIndex(index).filter((c) => c.endsWith('.md'))
    if (cibles.join('\u0000') !== attendus.join('\u0000')) {
      out.push({ file: chemin(INDEX), ref: `${cibles.length} lien(s) pour ${attendus.length} fichier(s) déclaré(s), ou hors ordre` })
    }
  }
  return out
}

/** Chemin POSIX d'un dossier depuis la racine du dépôt. */
const cheminDe = (dir) => String(dir).split('\\').join('/').replace(/\/$/, '')

/** Les `.md` d'un dossier, lus (CRLF normalisé par `readText`). */
export function lireDossier(dir) {
  return listerDossier(dir, { absent: 'vide' })
    .filter((n) => n.endsWith('.md'))
    .map((nom) => ({ nom, texte: readText(join(dir, nom)) }))
}

/**
 * LISTE DE DÉCOUPE du livre servi par ce dossier, ou `null` s'il n'en a pas — la résolution passe
 * par le registre (`src/data/books.json` → `id`), jamais par le nom du dossier : aucun livre n'est
 * nommé dans ce code.
 * @param {string} dir @returns {object[] | null}
 */
export function listeDuDossier(dir, registre = REGISTRE_LIVRES, avecListe = livresDecoupes()) {
  const livre = livreDuDossier(dir, registre)
  return livre && avecListe.includes(livre.id) ? decoupeDe(livre.id) : null
}

/** Balaie UN dossier de livre → ses sites d'écart de FORME (les familles à stock). */
export const scanDossier = (dir) => sitesDuDossier(cheminDe(dir), lireDossier(dir), listeDuDossier(dir))

/** Balaie UN dossier au GRAIN — rien pour un livre sans liste de découpe. */
export const grainDuDossier = (dir) => {
  const liste = listeDuDossier(dir)
  return liste ? ecartsAuGrain(cheminDe(dir), lireDossier(dir), liste) : []
}

/** Écarts au grain de TOUS les dossiers FR, dans l'ordre du corpus. */
export const grainAll = (dossiers = dossiersFR()) => dossiers.flatMap((d) => grainDuDossier(d))

/**
 * Les ROUGES de la famille `mobilier` pour des sites mesurés (`lib/mobilier.mjs#mobilierDuDossier`) :
 * chaque site NON exempté, puis chaque exemption qui ne couvre pas exactement ses `jetons` sites —
 * `{ file, ref }`. PURE.
 */
export const rougesDuMobilier = (sites, exemptions = EXEMPTIONS_MOBILIER) => [
  ...sites.filter((s) => !s.exemption).map((s) => ({ file: s.fichier, ref: `l.${s.ligne} ${s.classe} « ${s.jeton} » : ${s.texte.trim().slice(0, 60)}` })),
  ...exemptionsFausses(sites, exemptions).map(({ exemption: e, couverts }) => ({ file: e.fichier, ref: `exemption qui couvre ${couverts} site(s) pour ${e.jetons} déclaré(s) : ${e.motif}` })),
]

/**
 * MOBILIER DE PAGE de tous les dossiers FR dont le livre a des `onglets` (`rougesDuMobilier`).
 * @param {string[]} [dossiers] @param {object[]} [exemptions]
 */
export function mobilierAll(dossiers = dossiersFR(), exemptions = EXEMPTIONS_MOBILIER, avecListe = livresDecoupes()) {
  const sites = dossiers.flatMap((d) => {
    const livre = livreDuDossier(d)
    if (!livre || !avecListe.includes(livre.id)) return []
    const textes = new Map(lireDossier(d).map((f) => [f.nom, f.texte]))
    return mobilierDuDossier(cheminDe(d), (nom) => textes.get(nom) ?? '', decoupeDe(livre.id), ongletsDe(livre.id), { exemptions })
  })
  return rougesDuMobilier(sites, exemptions)
}

/** Les ROUGES de la famille `titre-soude` d'UN dossier de livre, fichier par fichier dans l'ordre de sa
 *  liste de découpe — PUR : `texteDe(nom)` rend le texte d'un fichier. `{ file, ref }`. */
export const titresSoudesDuDossier = (dir, texteDe, liste) =>
  nomsDeLaListe(liste).flatMap((nom) => sitesDeTitresSoudes(texteDe(nom)).map((s) => ({ file: `${dir}/${nom}`, ref: `l.${s.ligne} ${s.classe} : ${s.texte.trim().slice(0, 60)}` })))

/** TITRES SOUDÉS de tous les dossiers FR dont le livre déclare un `gabaritTitre`. */
export function titresSoudesAll(dossiers = dossiersFR(), avecListe = livresDecoupes()) {
  return dossiers.flatMap((d) => {
    const livre = livreDuDossier(d)
    if (!livre || !avecListe.includes(livre.id) || !gabaritTitreDe(livre.id)) return []
    const textes = new Map(lireDossier(d).map((f) => [f.nom, f.texte]))
    return titresSoudesDuDossier(cheminDe(d), (nom) => textes.get(nom) ?? '', decoupeDe(livre.id))
  })
}

/**
 * Les DOSSIERS FR suivis, dans l'ordre POSIX : l'union des livres à `dir` de `books.json` et du
 * balayage de `Source/` sur `PREFIXES_FR`. Un livre enregistré dont le dossier manque sur le disque
 * LÈVE — un corpus amputé rendrait un vert muet (`sourceCorpus.mjs`, refus du vide).
 * @returns {string[]}
 */
export function dossiersFR(racine = RACINE_SOURCE, books = BOOKS) {
  const vus = new Set()
  for (const [abbr, dir] of books) {
    const p = cheminDe(dir)
    if (!existsSync(p)) throw new Error(`check-source-format : livre "${abbr}" de books.json sans dossier sur le disque (${p})`)
    vus.add(p)
  }
  for (const nom of listerDossier(racine, { absent: 'lever' })) {
    if (!PREFIXES_FR.some((p) => nom.startsWith(p))) continue
    const p = `${racine}/${nom}`
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) vus.add(p)
  }
  const out = [...vus].sort(parUnitesDeCode)
  if (!out.length) throw new Error(`check-source-format : aucun dossier FR sous ${racine}/ — balayage amputé`)
  return out
}

/** Balaie tous les dossiers FR → sites agrégés, dans l'ordre du corpus. */
export function scanAll(dossiers = dossiersFR()) {
  const out = []
  for (const dir of dossiers) out.push(...scanDossier(dir))
  return out
}

/** Compte par famille (toutes les familles présentes, même à zéro). */
export const comptesParFamille = (sites) =>
  Object.fromEntries(FAMILLES.map((f) => [f, sites.filter((s) => s.famille === f).length]))

/** Compte par DOSSIER de livre — le `file` d'un site nomme un CHAPITRE, le dossier en est le
 *  préfixe. C'est le grain du rapport : l'unité de réparation est le livre. */
export const comptesParDossier = (sites) => {
  const out = new Map()
  for (const s of sites) {
    const dossier = s.file.slice(0, s.file.lastIndexOf('/'))
    out.set(dossier, (out.get(dossier) ?? 0) + 1)
  }
  return out
}

/**
 * Les ENTRÉES du stock, dans l'ordre du balayage — c'est CE rendu que le fichier de stock porte.
 * `ancien` (les entrées déjà committées) porte la SURVIE : `survieDeLecheance`
 * (`scripts/guards/lib/stock.mjs`), seule définition du dépôt.
 * @param {{famille: string, file: string, ref: string}[]} sites
 * @param {{ lot: string, date: string, ancien?: Iterable<object> }} p
 */
export const entreesDe = (sites, { lot, date, ancien = [] }) =>
  FAMILLES.flatMap((famille) =>
    survieDeLecheance(sitesEnEntrees(sites.filter((s) => s.famille === famille), { famille }), { lot, date, ancien }),
  )

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
      ou: 'source-format-stock.json',
    })
    neuves.push(...r.neuves)
    perimees.push(...r.perimees)
  }
  return { neuves, perimees }
}

const QUOI = ({ comptes, dossiers, entrees }) =>
  'Écart de FORME des extractions de `Source/` au format canonique (#1739, épique #1388) : une ' +
  'ENTRÉE par (famille, fichier, détail), clé `famille :: fichier :: ref :: occurrence` (régime ' +
  `#1711). Format DÉFINI par \`docs/ajouter-un-livre-source.md\` § « Format canonique ». ` +
  `${dossiers} dossier(s) FR balayé(s). ` +
  `${phraseDeNaissance(comptes, FAMILLES)} ` +
  'LE GESTE, UN SEUL — REJOUER la chaîne canonique sur le livre : re-découpe depuis la sortie ' +
  'Marker conservée sous `Source/_marker/`, ou ré-extraction quand cette sortie manque. Jamais un ' +
  'remède de chapitre (arbitrage utilisateur 2026-09-14 : « Il faut un format unifié pour toutes ' +
  'les extractions, donc s’il faut rééxtraire, on rééxtrait »). ' +
  'DÉCROISSANCE : un livre repassé par la chaîne sort du stock dans le train qui l’intègre — ses ' +
  'entrées se retirent dans le MÊME commit que le dossier remplacé, et la garde refuse alors toute ' +
  'entrée sans écart mesuré. L’ORDRE de ré-extraction vit sur #1739. ' +
  'CE QUE LE `fichier` NOMME — le chapitre fautif lui-même : la `ref` porte le détail de CE ' +
  'fichier, sans cardinal ; le `nombre`, hors clé, compte ses occurrences dans CE fichier, jamais dans un dossier. ' +
  `${entrees} entrée(s). ` +
  'COUVERTURE DITE — les familles `ligne1-hors-format`, `sans-folio`, `ancre-seule`, ' +
  '`nom-de-signet`, `largeur-de-numero` et `sans-decoupe` ne jugent que les fichiers au motif `NN - X.md`, ' +
  '`00 - Index.md` exclu ; un `.md` ' +
  'hors motif leur est INVISIBLE (mesuré le 2026-09-14 : 0 fichier hors motif sur les 20 dossiers). ' +
  '`html-residuel` et `table-sans-separateur` balaient, eux, TOUS les `.md` du dossier. ' +
  'COUVERTURE DITE — `html-residuel` ne compte PAS les ancres de page : une ancre sans ' +
  '`data-folio` est déjà nommée par `sans-folio`, et la compter deux fois dirait deux réparations ' +
  'là où il n’y en a qu’une.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). Les comptes
 *  à la naissance sont ceux du stock en place (`naissance`), sinon ceux du jour. */
export const stockDe = (sites, { lot, date, dossiers, ancien = [], naissance = null }) => {
  const entrees = entreesDe(sites, { lot, date, ancien })
  const quoi = QUOI({ comptes: naissance ?? comptesParFamille(sites), dossiers, entrees: entrees.length })
  return `${JSON.stringify({ quoi, entrees }, null, 2)}\n`
}

function main() {
  const args = process.argv.slice(2)
  const dossiers = dossiersFR()
  const sites = scanAll(dossiers)
  const comptes = comptesParFamille(sites)
  const stock = readStock(STOCK_PATH)

  if (args.includes('--ecrire-stock')) {
    const r = ecrireStockSousLot(
      args,
      (lot, date) => ({ entrees: entreesDe(sites, { lot, date, ancien: stock }), texte: stockDe(sites, { lot, date, dossiers: dossiers.length, ancien: stock, naissance: naissanceEnPlace(STOCK_PATH, FAMILLES) }) }),
      (texte) => writeFileSync(STOCK_PATH, texte),
      STOCK_PATH,
    )
    ;(r.code ? console.error : console.log)(r.message)
    process.exitCode = r.code
    return
  }

  const parDossier = comptesParDossier(sites)
  console.log(
    `format des extractions : ${sites.length} écart(s) sur ${parDossier.size} dossier(s) hors format, ` +
      `${dossiers.length} dossier(s) FR balayé(s) — ${FAMILLES.map((f) => `${f} ${comptes[f]}`).join(', ')}`,
  )
  for (const dir of dossiers) {
    if (parDossier.has(dir)) console.log(`  ${dir} — ${parDossier.get(dir)} écart(s)`)
  }

  // GRAIN : la confrontation à la liste de découpe est ROUGE, jamais stockée — son geste est
  // `node scripts/raw/recouper-source.mjs <id du livre>`.
  const grain = grainAll(dossiers)
  if (grain.length) {
    console.log(`GRAIN — ${grain.length} écart(s) à la liste de découpe (geste : node scripts/raw/recouper-source.mjs <id>) :`)
    for (const g of grain) console.log(`  ${g.file} — ${g.ref}`)
  }

  // MOBILIER : rouge nommé, jamais stocké — son geste est `node scripts/raw/reparer-mobilier.mjs <id>`.
  const mobilier = mobilierAll(dossiers)
  if (mobilier.length) {
    console.log(`MOBILIER — ${mobilier.length} site(s) de mobilier de page (geste : node scripts/raw/reparer-mobilier.mjs <id>) :`)
    for (const m of mobilier) console.log(`  ${m.file} — ${m.ref}`)
  }

  // TITRES SOUDÉS : rouge nommé, jamais stocké — son geste est `node scripts/raw/reparer-titres.mjs <id>`.
  const soudes = titresSoudesAll(dossiers)
  if (soudes.length) {
    console.log(`TITRES SOUDÉS — ${soudes.length} ligne(s) (geste : node scripts/raw/reparer-titres.mjs <id>) :`)
    for (const t of soudes) console.log(`  ${t.file} — ${t.ref}`)
  }

  const { neuves, perimees } = ecartDuStock(sites, stock)
  if (neuves.length) {
    console.log('RÉGRESSION — écart(s) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (livre ré-extrait) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length && !grain.length && !mobilier.length && !soudes.length) {
    console.log('OK — cliquet aligné, aucune régression, aucun écart au grain, aucun mobilier de page, aucun titre soudé.')
    return
  }
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
