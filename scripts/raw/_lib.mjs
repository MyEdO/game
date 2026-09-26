// Helpers partagés des gardes Atlas RAW (coverage / reconcile / reanchor).
// Source UNIQUE de : map des livres (BOOKS), résolveur de fichier-chapitre, graphie de réf — UNE
// pour TOUS les livres de BOOKS, par ligne (refRe) et par folio (refFolioRe), sur l'alternation
// dérivée `allAbbrAlternation` —, dépliage de plage, échappement regex, et normalisation de texte
// pour le match exact des citations. reanchor.mjs dérive sa PROPRE alternation de BOOKS (#434
// défaut 10, périmètre non couvert par ce fichier).
// INVARIANT #1825 : le code ne nomme AUCUN livre — un livre de plus, c'est de la DONNÉE. Ce qu'on
// sait du LIVRE vit dans son entrée de `src/data/books.json` (sigle, dossier, langue, cœur, teneur,
// niveau de section) ; ce qu'on sait de ses CHAPITRES vit dans `scripts/raw/chapitres.json`
// (hors-règle, catalogues), sa LISTE DE DÉCOUPE dans `scripts/raw/decoupes/<id>.json`, et ce qu'on
// sait des DOMAINES d'un cœur dans `scripts/raw/domaines.json` : registres d'OUTILLAGE dont ce
// fichier est le LECTEUR UNIQUE. Zéro ligne de code pour aucun d'eux.
import { existsSync, readFileSync } from 'node:fs'
import { arbrePrincipal } from '../guards/lib/gitPorte.mjs'
import { listerArbre, listerDossier } from '../guards/lib/lister.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import booksData from '../../src/data/books.json' with { type: 'json' }
import chapitresData from './chapitres.json' with { type: 'json' }
import domainesData from './domaines.json' with { type: 'json' }
// Normalisation de citation : SOURCE UNIQUE dans `src/data/source/normalize.ts` (module feuille en
// syntaxe effaçable, chargé tel quel par Node nu comme par vitest). Importée ICI parce que ce
// fichier s'en sert lui-même (`findAnchor`, `sectionsOf`), et RÉ-EXPORTÉE plus bas pour ses 15
// consommateurs.
import { normalize, ELLIPSIS_SENTINEL } from '../../src/data/source/normalize.ts'
// Le NUMÉRO DE CHAPITRE (prédicat, motif de nom, résolution) vit dans sa maison unique
// `src/data/source/decoupe.ts` — module PUR, chargé tel quel par Node nu comme par vitest.
import { fichierDuChapitre, graphieDeChapitre, largeurDeChapitre, numeroDuFichier } from '../../src/data/source/decoupe.ts'
import { nomAscii } from '../source/nom-ascii.mjs'
// « Livre EXTRAIT » : définition UNIQUE app/outillage, `src/data/source/livre-extrait.ts` (#1739).
import { estLivreExtrait } from '../../src/data/source/livre-extrait.ts'

// Lecture CRLF-robuste (#604) -- SOURCE UNIQUE de lecture texte pour tout fichier Source/**/docs/raw/** :
// une reecriture Windows du 2026-07-07 a mutile 202 fichiers en CRLF/mixte (contenu identique, index git
// reste LF). sectionsOf (coverage.mjs) decoupe les headings avec une regex de fin de ligne ancree sans
// flag m -- or le '.' de regex exclut TOUT LineTerminator (dont \r, ECMA-262), donc le heading pattern
// echoue net des qu'une ligne se termine par \r (repro mesure : sectionsOf('# A\r\n## B\r\ntexte', 2)
// -> un seul '(integral)', la boundary H2 jamais vue). readText normalise \r\n/\r isole -> \n AU POINT
// DE LECTURE -- jamais dans les parseurs eux-memes (une seule couture, pas un remede par regex disperse).
// N'affecte pas JSON.parse (deja tolerant aux fins de ligne) ni les fichiers deja en LF (no-op).
export const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n|\r/g, '\n')

// Un livre est-il EXTRAIT (donc adressable par l'outillage Atlas) ? Définition UNIQUE, partagée avec
// l'app (import en tête). Tout `scripts/` en juge par elle (`booksDe`,
// `livreExtraitDe`, `livreDuSigle`, `sigleDe`…), ré-exportée ICI.
export { estLivreExtrait }

// ABRÉV → dossier Source, DÉRIVÉ de `books.json` (SOURCE UNIQUE des acronymes ET de l'ordre,
// ref #585, #1825) : les entrées porteuses d'un `dir` (les livres couverts par l'Atlas RAW), dans
// l'ORDRE DU FICHIER — le même que l'app sert au joueur (`src/data/index.ts` `books`,
// `src/ui/compendium/DescRefField.tsx` par `estExtrait`, qui applique le même `estLivreExtrait`). C'est aussi l'ordre d'affichage des
// rapports : un livre de plus est UNE entrée de `books.json`, zéro ligne ici.
export const booksDe = (registre) => registre.filter(estLivreExtrait).map((b) => [b.abbr, b.dir])
// Registre BRUT des livres, tel que `books.json` le porte — la lecture du fichier vit ICI et nulle
// part ailleurs, pour que tout consommateur puisse recevoir un registre FIXTURE par injection.
export const REGISTRE_LIVRES = booksData
export const BOOKS = booksDe(booksData)
/** L'entrée du registre d'un livre EXTRAIT (porteur d'un `dir`), par son id STABLE — ou `null`.
 *  SEULE résolution id → livre de l'outillage : un outil reçoit un id, il ne compare rien lui-même. */
export const livreExtraitDe = (id, registre = REGISTRE_LIVRES) =>
  registre.find((b) => b.id === id && estLivreExtrait(b)) ?? null
/** L'entrée du registre d'un livre EXTRAIT par son SIGLE — ou `null`. SEULE résolution sigle → livre
 *  de l'outillage, pour les outils qui reçoivent un sigle (ligne de commande, réf `<ABRÉV> <ch>`). */
export const livreDuSigle = (abbr, registre = REGISTRE_LIVRES) =>
  registre.find((b) => b.abbr === abbr && estLivreExtrait(b)) ?? null
/** L'entrée du registre d'un livre EXTRAIT par son DOSSIER `Source/…` (séparateurs `\` ou `/`, barre
 *  finale indifférente) — ou `null`. SEULE résolution dossier → livre de l'outillage. */
export function livreDuDossier(dir, registre = REGISTRE_LIVRES) {
  const posix = (d) => String(d).split('\\').join('/').replace(/\/$/, '')
  const cible = posix(dir)
  return registre.find((b) => estLivreExtrait(b) && posix(b.dir) === cible) ?? null
}
/** Le SIGLE d'un livre EXTRAIT par son id STABLE — ou `null`. SEULE traduction id → sigle de
 *  l'outillage : le sigle est de l'affichage (dossiers, réfs `<ABRÉV> <ch>`). */
export const sigleDe = (id, registre = REGISTRE_LIVRES) => livreExtraitDe(id, registre)?.abbr ?? null

// CŒUR de règles d'un livre (`books.json`, champ `coeur`) : le corps de règles dont ce livre est le
// livre de base, ou `null` pour un supplément. C'est LUI qui porte le régime de réconciliation
// (refus de stock en Sens A, calcul du Sens B2) — JAMAIS la graphie d'une réf, qui est UNE pour tous
// les livres (`refRe`), ni une identité de livre écrite dans le code : un cœur de plus est UNE clé
// de `books.json`. Lu par `abbr`, l'unité que les rapports et les clés de stock nomment déjà.
export const coeursDe = (registre) => new Map(registre.filter((b) => b.abbr && b.coeur).map((b) => [b.abbr, b.coeur]))
const COEURS = coeursDe(booksData)
export const coeurDe = (abbr, coeurs = COEURS) => coeurs.get(abbr) ?? null

// Les livres de CŒUR du registre, `[[abbr, dir], …]`, dans l'ORDRE DU FICHIER — la population que
// le régime R2 parcourt (`reconcile.mjs`), et celle où un banc prend un sigle RÉEL par son RÉGIME.
export const livresDeCoeur = (books = BOOKS, coeurs = COEURS) => books.filter(([a]) => coeurDe(a, coeurs))

// Sigles des livres de CŒUR du registre — ce qu'un banc parcourt quand il lui faut des sigles réels
// sans recopier l'identité d'un livre. TOUS les cœurs, jamais le premier seul : un banc qui ne
// jugerait qu'un cœur laisserait le cœur N+1 hors de sa couverture. LÈVE en NOMMANT la cause — un
// tableau vide rendrait un banc VERT À VIDE. Vit ici parce qu'ici vit la lecture du registre.
export function siglesDeCoeur(books = BOOKS, coeurs = COEURS) {
  const sigles = livresDeCoeur(books, coeurs).map(([abbr]) => abbr)
  if (!sigles.length) throw new Error('_lib: le registre `src/data/books.json` ne porte aucun livre de cœur (champ `coeur`)')
  return sigles
}

// Les CŒURS de règles que le registre déclare, dans l'ORDRE DU FICHIER, sans doublon : la population
// des dossiers de `docs/raw/` (`pagesDeLAtlas`) et celle des périmètres d'extraction
// (`perimetreDeCoeur`, `workflow-args.mjs`). Registre INJECTABLE (fixture).
export const coeursDuRegistre = (registre = REGISTRE_LIVRES) =>
  [...new Set(registre.filter((b) => estLivreExtrait(b) && b.coeur).map((b) => b.coeur))]

// TENEUR d'un livre (`books.json`, champ `teneur`) : ce que contiennent ses chapitres NON couverts
// par une fiche — `scenario` (campagne pure, aucune règle propre), `mixte` (scénario ET règles), ou
// `null` pour un livre de RÈGLES. C'est elle qui ventile les sections 0-réf de `coverage.mjs` ; un
// livre de plus est UNE entrée de `books.json`, zéro ligne ici. Registre INJECTABLE (fixture).
export const teneursDe = (registre) => new Map(registre.filter((b) => b.abbr && b.teneur).map((b) => [b.abbr, b.teneur]))
const TENEURS = teneursDe(booksData)
export const teneurDe = (abbr, teneurs = TENEURS) => teneurs.get(abbr) ?? null

// NIVEAU DE SECTION d'un livre (`books.json`, champ `niveauDeSection`) : le niveau de heading qui
// porte ses SUJETS (#604 — un argmax brut se fait piéger par les listes imbriquées). ABSENT = 2.
export const niveauxDeSectionDe = (registre) =>
  new Map(registre.filter((b) => b.abbr && b.niveauDeSection).map((b) => [b.abbr, b.niveauDeSection]))
const NIVEAUX_DE_SECTION = niveauxDeSectionDe(booksData)
export const niveauDeSectionDe = (abbr, niveaux = NIVEAUX_DE_SECTION) => niveaux.get(abbr) ?? 2

// Ce qu'on sait des CHAPITRES d'un livre vit dans le registre d'OUTILLAGE `scripts/raw/chapitres.json`,
// là où son entrée de `books.json` dit ce qu'on sait du LIVRE : ils ne servent qu'à la chaîne Atlas
// et personne ne les édite en jeu. Ses entrées désignent leur livre par son `id`
// STABLE ; la traduction id → sigle se fait par `sigleDe`, UNE fois — le sigle est de l'affichage.
export const REGISTRE_CHAPITRES = chapitresData

// Chapitres HORS-RÈGLE (`chapitres.json`, `horsRegle`) : sigle → (numéro de chapitre → MOTIF de son
// exclusion du dénominateur de couverture). Le motif est de la DONNÉE — c'est lui que
// `chapitres.test.mjs` exige non vide et sans réf citable.
export const horsRegleDe = (chapitres, registre = booksData) => {
  const parSigle = new Map()
  for (const { book, ch, motif } of chapitres.horsRegle ?? []) {
    const ab = sigleDe(book, registre)
    if (!ab) continue
    if (!parSigle.has(ab)) parSigle.set(ab, new Map())
    parSigle.get(ab).set(ch, motif)
  }
  return parSigle
}
const HORS_REGLE = horsRegleDe(chapitresData)
export const motifHorsRegle = (abbr, ch, table = HORS_REGLE) => table.get(abbr)?.get(Number(ch)) ?? null
export const estHorsRegle = (abbr, ch, table = HORS_REGLE) => motifHorsRegle(abbr, ch, table) != null

// Appartenance des chapitres aux CATALOGUES de l'Atlas (`chapitres.json`, `enCatalogue` : UNE entrée
// par chapitre ET par catalogue) : id de catalogue → `[[abbr, [{ ch, from, to, title }, …]], …]`, dans
// l'ORDRE DU FICHIER (registre des livres puis numéro de chapitre, tenu par `chapitres.test.mjs` —
// aucun tri à la lecture). `build-catalogs.mjs` ne garde que ce qui appartient au CATALOGUE (fichier,
// titre, fiche de règles), jamais une liste de livres.
export const cataloguesDe = (chapitres, registre = booksData) => {
  const parCatalogue = new Map()
  for (const { book, catalogue, ...spec } of chapitres.enCatalogue ?? []) {
    const ab = sigleDe(book, registre)
    if (!ab) continue
    if (!parCatalogue.has(catalogue)) parCatalogue.set(catalogue, new Map())
    const parLivre = parCatalogue.get(catalogue)
    if (!parLivre.has(ab)) parLivre.set(ab, [])
    parLivre.get(ab).push(spec)
  }
  return new Map([...parCatalogue].map(([id, parLivre]) => [id, [...parLivre]]))
}
const CATALOGUES = cataloguesDe(chapitresData)
export const livresDeCatalogue = (id, catalogues = CATALOGUES) => catalogues.get(id) ?? []

// Ce qu'on sait des DOMAINES d'un cœur vit dans le registre d'OUTILLAGE `scripts/raw/domaines.json`,
// à côté de celui des chapitres : un domaine de plus, un cœur de plus, c'est UNE entrée — zéro
// ligne de code, ni ici, ni au workflow d'extraction, ni à l'index du cœur (bloc GÉNÉRÉ).
// Une clé de domaine est une AIRE DOCUMENTAIRE — le nom de la fiche qui la porte —, JAMAIS une
// affirmation d'identité mécanique : deux cœurs peuvent porter la même clé sans que rien ne les
// rapproche, et la comparaison de deux cœurs se fait à la granularité du TOPIC, pas du domaine.
// PORTÉE : ce fichier est le LECTEUR UNIQUE du registre et n'expose la table complète à personne —
// `domainesDe` rend les domaines d'UN cœur, `coeursDeDomaines` ne rend que des noms de cœur.
// Ce que `domaines.test.mjs` MESURE, et rien de plus : aucun autre source de `scripts/` ou `src/` ne
// NOMME le fichier du registre hors commentaire, et aucun export d'ici ne rend une table keyée par
// cœur. Un chemin ASSEMBLÉ à l'exécution passerait sous la garde (limite dite au banc).
const REGISTRE_DOMAINES = domainesData

/** Les cœurs pour lesquels des domaines sont déclarés, dans l'ORDRE DU FICHIER. */
export const coeursDeDomaines = (registre = REGISTRE_DOMAINES) => Object.keys(registre)

/**
 * Les domaines d'UN cœur, `[{ cle, titre }]`, dans l'ORDRE DU FICHIER — celui du rendu.
 * LÈVE en NOMMANT la cause : un cœur sans domaine rendrait un lot vide, un index sans bloc et un
 * workflow qui survole, sans qu'aucun rapport ne le dise.
 */
export function domainesDe(coeur, registre = REGISTRE_DOMAINES) {
  const dits = Object.keys(registre).join(', ') || '(aucun)'
  const liste = typeof coeur === 'string' && Object.hasOwn(registre, coeur) ? registre[coeur] : null
  if (!liste || !liste.length)
    throw new Error(`_lib: aucun domaine déclaré pour le cœur « ${coeur} » dans scripts/raw/domaines.json — cœurs porteurs de domaines : ${dits}`)
  return liste
}

// La LISTE DE DÉCOUPE d'un livre — UNE entrée par FICHIER de son dossier `Source/`, dans l'ordre du
// livre — vit dans `scripts/raw/decoupes/<id du livre>.json`, UN fichier par livre keyé par son id
// STABLE (`books.json`). C'est la donnée du DÉCOUPAGE, là où `chapitres.json` porte ce qu'on sait des
// chapitres une fois découpés : un livre mis au grain des sections coûte UN fichier de ce dossier et
// zéro ligne de code (#1739). Ce fichier en est le LECTEUR UNIQUE ; le dossier est INJECTABLE
// (fixture) pour que les bancs forgent un livre sans en déposer un dans le dépôt.
const ICI_RAW = dirname(fileURLToPath(import.meta.url))
export const DECOUPES_DIR = join(ICI_RAW, 'decoupes')

/** Les ids de livre pour lesquels une liste de découpe existe, dans l'ordre POSIX du dossier. */
export const livresDecoupes = (dir = DECOUPES_DIR) =>
  listerDossier(dir, { absent: 'vide' }).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))

/**
 * La liste de découpe d'UN livre, `[{ titre, ouverture?, page, pageFin, chapitre? }]`, dans l'ORDRE DU FICHIER — celui
 * des fichiers à écrire. LÈVE en NOMMANT la cause : une liste absente ou vide ferait écrire un livre
 * à zéro fichier, ou découper à l'aveugle.
 * @param {string} bookId id STABLE du livre @param {string} [dir]
 * @returns {{ titre: string, ouverture?: string, page: number, pageFin: number, chapitre?: string }[]}
 */
export function decoupeDe(bookId, dir = DECOUPES_DIR) {
  const dits = livresDecoupes(dir).join(', ') || '(aucun)'
  const chemin = join(dir, `${bookId}.json`)
  let brut
  try { brut = JSON.parse(readText(chemin)) } catch {
    throw new Error(`_lib: aucune liste de découpe pour le livre « ${bookId} » (${chemin}) — livres découpés : ${dits}`)
  }
  if (!Array.isArray(brut.fichiers) || !brut.fichiers.length)
    throw new Error(`_lib: la liste de découpe de « ${bookId} » (${chemin}) ne porte aucun fichier`)
  return brut.fichiers
}

/** Les NOMS de fichier que la liste de découpe déclare, dans son ordre. PURE. */
export const nomsDeLaListe = (liste) => {
  const largeur = largeurDeChapitre(Math.max(1, liste.length))
  return liste.map((e, i) => nomAscii(`${graphieDeChapitre(i + 1, largeur)} - ${e.titre}.md`))
}

/** Les ONGLETS DE CHAPITRE d'un livre, `[{ chiffre, pages: [a, b] }]`, ou `null` déclaré pour un livre
 *  qui n'en imprime aucun — champ `onglets` de sa liste de découpe, lu ICI et nulle part ailleurs.
 *  @param {string} bookId @param {string} [dir] @returns {{ chiffre: string, pages: [number, number] }[] | null} */
export const ongletsDe = (bookId, dir = DECOUPES_DIR) => JSON.parse(readText(join(dir, `${bookId}.json`))).onglets

/** Le GABARIT des titres d'entrée d'un livre, `{ titre, accompagnement, encadre, capitales, exclusions }` (typographies
 *  `{ police, taille? }`), ou `null` déclaré — champ `gabaritTitre` de sa liste de découpe, lu ICI et
 *  nulle part ailleurs. @param {string} bookId @param {string} [dir] */
export const gabaritTitreDe = (bookId, dir = DECOUPES_DIR) => JSON.parse(readText(join(dir, `${bookId}.json`))).gabaritTitre

// PDF d'un livre et sorties Marker — #1739 (2026-09-19, bloquant 3). Les PDF et `Source/_marker/` sont
// gitignorés (`.gitignore`) : ils n'existent que dans l'ARBRE PRINCIPAL, jamais dans un worktree
// lié. `Source/` s'y résout par `arbrePrincipal` (`scripts/guards/lib/gitPorte.mjs`) : l'IMPORT de
// `gitPorte` est statique et sans effet de bord, l'APPEL est paresseux — au premier besoin d'un
// chemin, jamais au chargement, car ce module est importé par des gardes CI qui n'ont aucun PDF —
// et part du dossier de ce fichier, jamais de `process.cwd()`. SEULE construction d'un chemin de PDF
// de livre de l'outillage : la garde `scripts/guards/lib/pdfHorsCouture.mjs` refuse toute autre ;
// Python et shell l'obtiennent par la CLI `scripts/raw/pdf-de.mjs`.
let sourcePrincipale = null
/** `Source/` de l'arbre principal, chemin absolu. LÈVE en nommant la cause si git ne le résout pas. */
function sourceDeLArbrePrincipal() {
  if (sourcePrincipale) return sourcePrincipale
  const vu = arbrePrincipal(ICI_RAW)
  if (!vu.disponible) throw new Error(`_lib: Source/ de l'arbre principal non résolu — ${vu.raison}`)
  sourcePrincipale = join(vu.valeur, 'Source')
  return sourcePrincipale
}

/**
 * Chemin ABSOLU du PDF officiel d'un livre extrait : `Source/<pdf>` de l'arbre principal, `pdf` étant
 * le champ du registre (`src/data/books.json`). `null` si le livre n'en déclare aucun.
 * LÈVE, nommée, sur un id inconnu du registre et sur un `pdf` déclaré dont le fichier manque.
 * @param {string} id id STABLE du livre
 * @param {{ registre?: object[], source?: () => string }} [options] injectables (fixture)
 * @returns {string | null}
 */
export function pdfDe(id, { registre = REGISTRE_LIVRES, source = sourceDeLArbrePrincipal } = {}) {
  const livre = livreExtraitDe(id, registre)
  if (!livre) throw new Error(`_lib: aucun livre extrait d'id « ${id} » au registre src/data/books.json`)
  if (!livre.pdf) return null
  const racine = source()
  const chemin = join(racine, livre.pdf)
  if (!existsSync(chemin)) {
    throw new Error(`_lib: PDF du livre « ${id} » introuvable — chemin tenté : ${chemin} (Source/ de l'arbre principal : ${racine})`)
  }
  return chemin
}

/** Le PDF REQUIS d'un outil : `pdfDe`, qui LÈVE en outre, nommée, sur un livre qui ne déclare aucun
 *  PDF. @param {string} id @param {{ registre?: object[], source?: () => string }} [options]
 *  @returns {string} */
export function pdfRequisDe(id, options = {}) {
  const chemin = pdfDe(id, options)
  if (!chemin) throw new Error(`_lib: le livre « ${id} » ne déclare aucun PDF (src/data/books.json, champ \`pdf\`)`)
  return chemin
}

/** `pdfRequisDe` pour un outil qui reçoit un SIGLE en ligne de commande (`anchor-fill`,
 *  `folio-bootstrap`, `lib/empty-folios-stock`) ; LÈVE, nommée, sur un sigle sans livre extrait. */
export function pdfDuSigle(abbr, options = {}) {
  const livre = livreDuSigle(abbr, options.registre)
  if (!livre) throw new Error(`_lib: aucun livre extrait de sigle « ${abbr} » au registre src/data/books.json`)
  return pdfRequisDe(livre.id, options)
}

/** Chemin ABSOLU sous `Source/_marker/` de l'arbre principal (sorties et copies de travail Marker).
 *  @param {string} relatif @param {{ source?: () => string }} [options] */
export const markerDe = (relatif, { source = sourceDeLArbrePrincipal } = {}) => join(source(), '_marker', relatif)

/**
 * Dossier de SORTIE Marker d'un livre, `Source/_marker/full/<id>` de l'arbre principal — SEUL nom de
 * sortie de l'outillage. `exiger` (défaut) : un LECTEUR lève, nommé, si le dossier manque, en citant
 * les dossiers de `full/` qui ne portent l'id d'aucun livre (sorties historiques à renommer).
 * @param {string} id @param {{ exiger?: boolean, registre?: object[], source?: () => string }} [options]
 * @returns {string}
 */
export function sortieMarkerDe(id, { exiger = true, registre = REGISTRE_LIVRES, source } = {}) {
  if (!livreExtraitDe(id, registre)) throw new Error(`_lib: aucun livre extrait d'id « ${id} » au registre src/data/books.json`)
  const sortie = markerDe(join('full', id), { source })
  if (!exiger || existsSync(sortie)) return sortie
  const ids = new Set(registre.map((b) => b.id))
  const historiques = listerDossier(dirname(sortie), { absent: 'vide' }).filter((d) => !ids.has(d))
  throw new Error(`_lib: sortie Marker du livre « ${id} » introuvable : ${sortie}` +
    (historiques.length ? ` — dossiers de sortie hors registre à renommer en « ${id} » si l'un est la sienne : ${historiques.join(', ')}` : ' — aucune sortie Marker de ce livre'))
}

/**
 * COPIE DE TRAVAIL du PDF d'un livre pour Marker, `Source/_marker/<id>` + extension : le nom officiel dépasse
 * MAX_PATH dans l'arborescence de sortie de Marker (docs/ajouter-un-livre-source.md, « Découpage en
 * tranches »). Chemin SEUL : ce module n'écrit rien ; la copie se pose par la CLI
 * `node scripts/raw/pdf-de.mjs --copie-marker <id>`.
 * @param {string} id @param {{ source?: () => string }} [options] @returns {string}
 */
export function copieMarkerDe(id, options = {}) {
  return markerDe(`${id}.pdf`, options)
}

// Échappe une chaîne pour l'insérer littéralement dans une RegExp.
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Alternation d'abréviations DÉRIVÉE de BOOKS (#434 défaut 10 : une alternation écrite à la main
// avait oublié MDG ; citation-graphy-guard écrivait la sienne, désynchronisée dès que BOOKS gagne un
// livre). Tri par longueur décroissante OBLIGATOIRE : sinon "MSR" matcherait avant "MSRC", "EDO"
// avant "EDOC". Plus de graphies tolérées (#585 lot B) : un livre, UNE abréviation canonique
// (SOURCE UNIQUE `books.json`), l'identité stricte suffit — aucune variante à couvrir.
// Calculée UNE fois : `refRe()` est une fabrique appelée par ligne scannée.
export const alternationDe = (books) => books.map(([a]) => esc(a)).sort((a, b) => b.length - a.length).join('|')
const ABBR_ALT = alternationDe(BOOKS)
export const allAbbrAlternation = () => ABBR_ALT

// MÊME fabrique (`alternationDe`), AUTRE population : TOUT livre du registre porteur d'un `abbr`,
// extrait ou non. `allAbbrAlternation` ne couvre que les livres EXTRAITS (à `dir`) parce que
// l'Atlas n'adresse que ceux-là ; mais un livre SANS extraction se CITE quand même, et la garde qui
// juge une réf RENDUE (`src/ui/book-ref-guard.test.ts`, #1826) doit voir tout le registre.
// Une SEULE alternation existe dans le dépôt : celle que rend `alternationDe`, ici paramétrée.
const ABBR_ALT_REGISTRE = alternationDe(booksData.filter((b) => b.abbr).map((b) => [b.abbr]))
export const alternationDuRegistre = () => ABBR_ALT_REGISTRE

// MARQUEUR de BLOC PRÉSERVÉ d'un livre — `<!-- <ABRÉV>-INTEGRATION -->` : un correctif MANUEL posé
// dans une fiche ou un catalogue de l'Atlas, que `build-catalogs.mjs` re-préserve à chaque
// régénération et que `merge-docs.mjs` re-fusionne. L'ÉCRIVAIN (`apply-livre.mjs`) et les LECTEURS
// passent par ICI, et le motif se DÉRIVE de l'alternation du registre : un marqueur écrit que le
// lecteur ne relit pas, c'est un correctif manuel effacé sans un mot à la régénération suivante.
export const marqueurIntegration = (abbr) => `<!-- ${abbr}-INTEGRATION -->`
export const marqueurIntegrationFin = (abbr) => `<!-- /${abbr}-INTEGRATION -->`
export const blockStartReDe = (alt) => new RegExp(`^<!-- ((?:${alt})-INTEGRATION) -->`)
export const blockStartRe = () => blockStartReDe(ABBR_ALT)

// Mention LÂCHE d'un chapitre (« <ABRÉV> 12 », « <ABRÉV> ch.7 » — sans réf de ligne), UNE pour tous
// les livres, sur l'alternation du registre : c'est elle qui dit « ce document parle de ce chapitre »
// (`reconcile.mjs` couverture, `assemble-domain.mjs` cœur d'une fiche existante).
export const looseReDe = (alt) => new RegExp(`\\b(${alt}) (?:ch\\.)?(\\d+)\\b`, 'g')
export const looseRe = () => looseReDe(ABBR_ALT)

// Regex de réfs (factories : instances FRAÎCHES — l'état /g `lastIndex` n'est pas partagé entre appelants).
// UNE graphie pour TOUS les livres de BOOKS, les livres de cœur compris : `<ABRÉV>[ [ch.]NN] l.<ligne><suffixe>`.
// Groupes, IDENTIQUES quel que soit le livre : m[1] livre · m[2] chapitre (OPTIONNEL, `undefined`
// pour une réf de livre entier) · m[3] ligne · m[4] suffixe.
// `ch.` optionnel devant le numéro de chapitre (#434 défaut 3) : le code écrit indifféremment
// `LIVRE NN l.X` et `LIVRE ch.NN l.X` — le groupe livre reste OBLIGATOIRE.
// Suffixe : `-fin` (plage) · `+n…` (points) · `/n…` (forme COMPACTE `l.298/315/369`, #1318 E3-L4 —
// jusque-là seul le PREMIER numéro était vu, les suivants échappaient à toute garde : `l.222/999`
// passait vert). Le `(?!\d)(?!\s*l\.)` (nombre ENTIER, puis pas de ` l.` derrière — sans le garde
// de chiffre la regex se rabattrait sur `/2` de `/20 l.72`) distingue `/315` (ligne du MÊME chapitre) de `/20 l.72` (réf
// MULTI-CHAPITRES `LDB 18 l.298/20 l.72`, où `20` est un CHAPITRE — jamais une ligne du 18).
export const refReDe = (alt) =>
  new RegExp(`\\b(${alt})(?: (?:ch\\.)?(\\d+))? l\\.(\\d+)((?:[-+]\\d+|/\\d+(?!\\d)(?!\\s*l\\.))*)`, 'g')
export const refRe = () => refReDe(ABBR_ALT)

// Miroir FOLIO de `refRe` (#606) : la graphie canonique `ABBR NN p.<folio>[-fin][+pts]` (gelee par
// #585) est aussi une ref de chapitre valide -- jamais captee par la regex ` l.` ci-dessus. Memes
// groupes de capture que son pendant ` l.`, pour rester un substitut direct cote appelant.
export const refFolioReDe = (alt) =>
  new RegExp(`\\b(${alt})(?: (?:ch\\.)?(\\d+))? p\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
export const refFolioRe = () => refFolioReDe(ABBR_ALT)

// Canonicalise le texte brut matché par refRe (m[1]) vers l'abréviation BOOKS (#434 défaut 11).
// Identité stricte (#585 lot B) — une seule graphie par livre, aucune variante à résoudre.
export const bookOfDe = (books) => {
  const abbrs = new Set(books.map(([a]) => a))
  return (text) => (abbrs.has(text) ? text : null)
}
export const bookOf = bookOfDe(BOOKS)

// Un suffixe est-il une PLAGE (`-fin`) ? Les autres formes (`+pts`, `/compacte`) sont des ancres
// DISTINCTES, jamais un intervalle : un consommateur qui juge « toutes les lignes citées sont vides »
// doit les traiter une à une (sans quoi `l.202/213` se lit comme 202→213, lignes pleines comprises).
export const isRangeSuffix = (suffix) => !!suffix && /^-\d+/.test(suffix)

// Tous les numéros de ligne EXPLICITEMENT cités par une réf : `l.10` → [10] · `l.10-25` → [10,25]
// (bornes) · `l.10+17` → [10,17] · `l.298/315/369` → [298,315,369] (forme COMPACTE, #1318 E3-L4).
export function refNums(line, suffix) {
  const a = Number(line)
  if (!suffix) return [a]
  const extra = (suffix.match(/[-+/](\d+)/g) || []).map((s) => Number(s.slice(1)))
  return [a, ...extra.filter((n) => n !== a)]
}

// Déplie un suffixe "-285" (intervalle), "+217+220" (points) ou "/315/369" (compacte) → [lo, hi].
// `hi` = borne HAUTE de tout ce qui est cité : c'est elle que borne `check-code-refs`.
export function span(line, suffix) {
  const nums = refNums(line, suffix)
  return [nums[0], Math.max(...nums)]
}

// Résout (ABRÉV, NN[, range]) → { path, file, dir } du `.md` chapitre, ou null. Lookup par ENTIER
// (`fichierDuChapitre`, `src/data/source/decoupe.ts`) : ce fichier-ci n'ajoute que le DISQUE.
// `range` optionnel = { from, to? } route une SOUS-SECTION du chapitre (jamais un second mécanisme) : `from`/
// `to` sont chacun une ancre — texte de heading Markdown (n'importe quel niveau `#`, markup ignoré) OU
// `folio:NN` pour un `<span … data-folio="NN">` — bornant un extrait VERBATIM ajouté en `.text` (trim).
// `to` omis = jusqu'à la fin du fichier. Lève si une ancre est introuvable (fail-fast, jamais un extrait silencieux faux).
const _chapterCache = new Map()
export function chapterFile(abbr, nn, range) {
  const key = `${abbr}|${nn}`
  let res
  if (_chapterCache.has(key)) {
    res = _chapterCache.get(key)
  } else {
    const dir = livreDuSigle(abbr)?.dir
    res = null
    if (dir) {
      const f = fichierDuChapitre(listerDossier(dir, { absent: 'vide' }), nn)
      if (f) res = { path: join(dir, f), file: f, dir }
    }
    _chapterCache.set(key, res)
  }
  if (!res || !range) return res
  const lines = readText(res.path).split('\n')
  const startIdx = findAnchor(lines, range.from)
  if (startIdx == null) throw new Error(`chapterFile(${abbr} ${nn}) : ancre de départ "${range.from}" introuvable dans ${res.path}`)
  let endIdx = lines.length
  if (range.to) {
    endIdx = findAnchor(lines, range.to)
    if (endIdx == null) throw new Error(`chapterFile(${abbr} ${nn}) : ancre de fin "${range.to}" introuvable dans ${res.path}`)
  }
  return { ...res, text: lines.slice(startIdx, endIdx).join('\n').trim() }
}

// --- Résolution FOLIO imprimé → (chapitre, plage de lignes) (#434) ---
// Le contenu data-driven de `src/data/*.json` cite sa source en FOLIO imprimé (`source:{book,page}`),
// invisible du matcher par ligne de build-implemente. La ré-extraction Marker a posé des ancres
// `<span … data-folio="NN">` : un folio se convertit donc en (chapitre, [ligne de l'ancre → ligne de
// la prochaine ancre `data-folio`, ou fin de fichier]). Un seul scan par livre (cache).
// PUR (testable, aucun disque) : `chapters` = [{ ch, lines:[] }] → Map(folio → [{ ch, lo, hi }]).
// Plage d'un folio = [ligne de l'ancre `data-folio` → ligne de la prochaine ancre, ou fin de fichier].
export function buildFolioMap(chapters) {
  const map = new Map()
  const anchorRe = /data-folio="(-?\d+)"/
  for (const { ch, lines } of chapters) {
    const anchors = []
    lines.forEach((l, i) => {
      const m = anchorRe.exec(l)
      if (m) anchors.push({ folio: Number(m[1]), line: i + 1 })
    })
    for (let k = 0; k < anchors.length; k++) {
      const lo = anchors[k].line
      const hi = k + 1 < anchors.length ? anchors[k + 1].line : lines.length
      const arr = map.get(anchors[k].folio)
      if (arr) arr.push({ ch, lo, hi })
      else map.set(anchors[k].folio, [{ ch, lo, hi }])
    }
  }
  return map
}

// (map, folio, ch?) → { ch, lo, hi } | null (folio absent) | 'ambiguous'. Une page partagée entre
// deux chapitres (l'un s'ouvre en milieu de page, #1739) porte son folio dans les deux : la réf qui
// NOMME son chapitre `ch` se résout dans ce chapitre ; sans chapitre nommé ou hors de ses hits, un
// folio présent dans ≥2 chapitres reste 'ambiguous'.
export function folioRangeIn(map, folio, ch = null) {
  const hits = map.get(folio)
  if (!hits || !hits.length) return null
  const dansCh = ch == null ? undefined : hits.find((h) => h.ch === ch)
  if (dansCh) return dansCh
  if (new Set(hits.map((h) => h.ch)).size > 1) return 'ambiguous'
  return hits[0]
}

const _folioCache = new Map() // abbr -> Map(folio -> [{ ch, lo, hi }])
export function folioIndexOf(abbr) {
  if (_folioCache.has(abbr)) return _folioCache.get(abbr)
  const dir = livreDuSigle(abbr)?.dir
  const chapters = []
  if (dir) {
    for (const file of listerDossier(dir, { absent: 'vide' })) {
      const ch = numeroDuFichier(file)
      if (ch == null) continue
      const lines = readText(join(dir, file)).split('\n')
      chapters.push({ ch, lines })
    }
  }
  const map = buildFolioMap(chapters)
  _folioCache.set(abbr, map)
  return map
}

// (abbr, folio, ch?) → { ch, lo, hi } | null | 'ambiguous' (`folioRangeIn`).
export function folioRange(abbr, folio, ch = null) {
  return folioRangeIn(folioIndexOf(abbr), folio, ch)
}

// (abbr, nn, folioStr, suffix) -> [lo, hi] LIGNES dans le fichier-chapitre `nn`, ou `null` (#606).
// Convertit une ref folio `ABBR NN p.folio[-fin][+pts]` en plage de LIGNES du MEME chapitre via
// `folioRange` (ancres `data-folio`), résolue DANS le chapitre `nn` quand le folio y est ancré (page
// partagée comprise). Ignore proprement (`null`, jamais un throw) : ancre absente (residu #522), ou
// folio ancré hors du chapitre `nn` (frontiere de chapitre) -- on ne cherche PAS a re-ancrer, juste
// a ne pas crediter un mauvais chapitre. Un `-fin`/`+pts` dont le second folio est irresolu degrade
// sur la seule plage du premier folio (jamais un throw ni une plage bancale).
export function folioSpan(abbr, nn, folioStr, suffix) {
  const wantCh = Number(nn)
  const resolveInCh = (folio) => {
    const r = folioRange(abbr, folio, wantCh)
    if (!r || r === 'ambiguous' || r.ch !== wantCh) return null
    return r
  }
  const start = resolveInCh(Number(folioStr))
  if (!start) return null
  if (!suffix) return [start.lo, start.hi]
  const range = suffix.match(/^-(\d+)/)
  if (range) {
    const end = resolveInCh(Number(range[1]))
    return end ? [start.lo, end.hi] : [start.lo, start.hi]
  }
  let hi = start.hi
  for (const p of (suffix.match(/\+(\d+)/g) || [])) {
    const end = resolveInCh(Number(p.slice(1)))
    if (end && end.hi > hi) hi = end.hi
  }
  return [start.lo, hi]
}

// (#454 juge adversarial) Un folio SIMPLE `ABBR N p.X` cité au DERNIER folio du chapitre N, alors que
// le chapitre N+1 s'ouvre sur X ou X+1, est un CANDIDAT à contenu-en-fin-de-chapitre-qui-a-débordé
// (cas prouvé : `LDB 48 p.255` — le sujet cité vivait en réalité au tout début de `49 - Sorcellerie.md`,
// AVANT sa propre première ancre `data-folio`). Détection STRUCTURELLE PURE (aucun accès disque ici) :
// ne tranche PAS si le sujet cité vit réellement en N ou en N+1 (vérification verbatim, non triviale,
// hors scope) — seulement que la POSITION rend les deux plausibles. `map` = `folioIndexOf(abbr)`.
export function chapterBoundaryRisk(map, ch, folio) {
  let lastOfCh = null
  let firstOfNext = null
  for (const [f, hits] of map) {
    if (hits.some((h) => h.ch === ch)) { if (lastOfCh === null || f > lastOfCh) lastOfCh = f }
    if (hits.some((h) => h.ch === ch + 1)) { if (firstOfNext === null || f < firstOfNext) firstOfNext = f }
  }
  if (lastOfCh === null || firstOfNext === null || folio !== lastOfCh) return false
  return firstOfNext === folio || firstOfNext === folio + 1
}

// (abbr, ch, folio) → bool, enrobe `chapterBoundaryRisk` avec `folioIndexOf` (accès disque + cache).
export function chapterBoundaryRiskFor(abbr, ch, folio) {
  return chapterBoundaryRisk(folioIndexOf(abbr), ch, folio)
}

// Trouve la ligne d'une ancre `from`/`to` de `chapterFile` (heading Markdown normalisé, ou `folio:NN`).
function findAnchor(lines, locator) {
  const folio = /^folio:(\d+)$/.exec(locator)
  if (folio) {
    const re = new RegExp(`data-folio="${folio[1]}"`)
    const idx = lines.findIndex((l) => re.test(l))
    return idx < 0 ? null : idx
  }
  const target = normalize(locator)
  const idx = lines.findIndex((l) => {
    const m = /^#+\s*(.*)$/.exec(l)
    return m ? normalize(m[1]) === target : false
  })
  return idx < 0 ? null : idx
}

export { normalize, ELLIPSIS_SENTINEL }

// --- Exclusions PARTAGÉES de fiches docs/raw (#454 DoD, #585 lot A) ---
// Deux ensembles nommés (périmètres RÉELLEMENT différents, pas une fusion aveugle) :
// - RAWDOC_META_GENERATED : rapports RÉ-GÉNÉRÉS à chaque run (jamais des citations vivantes d'auteur)
//   — hors sujet pour TOUT scan (bornes de ligne comme prose de citation) : check-refs, check-code-refs
//   (src uniquement, sans objet), reconcile (Sens A/B), reanchor, citation-graphy-guard (a/b/c/d).
// - RAWDOC_AUTHOR_META : fiches d'auteur (index, conventions de sourcing) qui PEUVENT citer un chapitre
//   réel illustrativement (bornes de ligne restent vérifiables par check-refs) mais ne portent PAS de
//   citation verbatim vivante à ré-ancrer ni de prose d'état à juger — hors sujet pour reanchor et pour
//   citation-graphy-guard scan (d) seulement, PAS pour check-refs/check-code-refs/reconcile.
export const RAWDOC_META_GENERATED = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md'])
export const RAWDOC_AUTHOR_META = new Set(['00-index.md', 'sources.md', 'code-map.md'])
export const isRawEpreuve = (name) => /^epreuve-/.test(name)

// --- L'ÉNUMÉRATION UNIQUE des pages de l'Atlas (#1825) ---
// INVARIANT : une page de règles de l'Atlas appartient à UN cœur, et son CHEMIN le dit
// (`docs/raw/<coeur>/<page>.md`) ; aucun cœur n'est le cœur implicite. Un cœur de plus est UNE
// entrée `coeur` de `src/data/books.json` plus un dossier — zéro ligne de code, ici comme ailleurs.
// Cette couture est le SEUL site qui liste `docs/raw/` : chaque lecteur lui DÉCLARE les classes de
// page qu'il accepte, et ce qui SÉPARE ces classes reste ce qu'en disent les deux ensembles nommés
// ci-dessus et `isRawEpreuve` — la couture les CONSOMME, elle ne les redit pas.
// Elle LÈVE sur les deux formes qui nieraient l'invariant : une page de règles posée à la RACINE
// (elle n'aurait pas de cœur), un sous-dossier qui n'est pas un cœur du registre.
export const CLASSES_DE_PAGE = ['fiche', 'catalogue', 'generee', 'auteur', 'epreuve']
// Classes dont une page appartient à un CŒUR : elles ne peuvent pas vivre à la racine de l'Atlas.
const CLASSES_DE_COEUR = new Set(['fiche', 'catalogue', 'epreuve'])
const PREFIXE_CATALOGUE = 'catalogue-'

/** Classe d'une page de l'Atlas d'après son NOM de fichier — dérivation UNIQUE des six lecteurs. */
export function classeDePage(nom) {
  if (RAWDOC_META_GENERATED.has(nom)) return 'generee'
  if (RAWDOC_AUTHOR_META.has(nom)) return 'auteur'
  if (isRawEpreuve(nom)) return 'epreuve'
  if (nom.startsWith(PREFIXE_CATALOGUE)) return 'catalogue'
  return 'fiche'
}

/**
 * Les pages `.md` de l'Atlas, triées par chemin relatif (ordre total de `listerArbre`).
 * @param {string} rawDir racine de l'Atlas
 * @param {{ classes: string[], registre?: Array<object>, absent?: 'lever' | 'vide' }} options
 *   `classes` OBLIGATOIRE — l'acceptation que le lecteur DÉCLARE ; aucun défaut n'est offert, un
 *   défaut choisirait en silence le périmètre d'une garde.
 * @returns {Array<{ coeur: string|null, nom: string, relatif: string, chemin: string, classe: string }>}
 */
export function pagesDeLAtlas(rawDir, options = {}) {
  const { classes, registre = REGISTRE_LIVRES, absent = 'lever' } = options
  const dites = CLASSES_DE_PAGE.join(', ')
  if (!Array.isArray(classes) || !classes.length)
    throw new Error(`pagesDeLAtlas: \`classes\` non déclaré — un lecteur de l'Atlas DÉCLARE les classes de page qu'il accepte parmi ${dites}`)
  const inconnues = classes.filter((c) => !CLASSES_DE_PAGE.includes(c))
  if (inconnues.length)
    throw new Error(`pagesDeLAtlas: classe(s) de page inconnue(s) « ${inconnues.join(', ')} » — classes de l'Atlas : ${dites}`)
  const coeurs = coeursDuRegistre(registre)
  const connus = coeurs.length ? coeurs.join(', ') : '(aucun)'
  const relatifs = listerArbre(rawDir, {
    absent,
    descendre: (rel) => {
      if (rel.includes('/') || !coeurs.includes(rel))
        throw new Error(
          `pagesDeLAtlas: « ${rawDir}/${rel} » n'est pas un cœur du registre des livres — tout sous-dossier `
          + `de l'Atlas EST un cœur de \`src/data/books.json\` ; cœurs du registre : ${connus}`)
      return true
    },
    filtre: (rel) => rel.endsWith('.md'),
  })
  const retenues = new Set(classes)
  const pages = []
  for (const relatif of relatifs) {
    const coupe = relatif.lastIndexOf('/')
    const coeur = coupe < 0 ? null : relatif.slice(0, coupe)
    const nom = relatif.slice(coupe + 1)
    const classe = classeDePage(nom)
    if (coeur === null && CLASSES_DE_COEUR.has(classe))
      throw new Error(
        `pagesDeLAtlas: « ${rawDir}/${nom} » est une page de classe « ${classe} » posée à la RACINE de `
        + `l'Atlas — une telle page appartient à UN cœur et son chemin le dit : ${rawDir}/<coeur>/${nom} `
        + `; cœurs du registre : ${connus}`)
    if (!retenues.has(classe)) continue
    pages.push({ coeur, nom, relatif, chemin: join(rawDir, relatif), classe })
  }
  return pages
}
