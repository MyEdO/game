// Découpe l'extraction Marker d'un livre en fichiers `NNN - Titre.md` sous `Source/`, AU GRAIN DE
// SES SECTIONS : les frontières sont les LIGNES des titres d'ouverture que sa LISTE DE DÉCOUPE
// déclare (`scripts/raw/decoupes/<id du livre>.json`), cherchés DANS la page que la liste donne —
// une page peut porter deux sections. L'en-tête `*Pages PDF X-Y*` est COPIÉ de la liste
// (`spanDe`), retire les séparateurs `{N}----` et déballe le HTML `<sup>` (lib partagée
// `lib/marker-pages.mjs`, CONSIGNE de `deballerSup`).
//
// Le livre qu'il découpe est celui de `LIVRE` ci-dessous, avec le chemin de son extraction Marker :
// le seul reste propre à ce découpeur (#1739 : la fusion des quatre découpeurs en un leur fera lire
// leur livre en argument). Tout le reste est de la DONNÉE — liste de découpe, dossier et titre du
// livre (`src/data/books.json`).
//
// La sortie Marker ne porte PAS les réparations de contenu faites aux `.md` en service : rejouer ce
// découpeur les ÉCRASE (§ 7 de `docs/ajouter-un-livre-source.md`). Re-couper un livre DÉJÀ servi se
// fait par `scripts/raw/recouper-source.mjs`, qui prend les `.md` pour flux.
// Usage : node scripts/raw/split-wfrp5.mjs [--dry]  (`--dry` : aucune écriture, imprime le plan)
import { writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  mdsDeMarker, mdsDeRestitutions, pagesDeMarker, verifierExtraction, commandeRestitution,
  couperAuxTitres,
} from './lib/marker-pages.mjs'
import { deballerSup } from './lib/titres.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { copieMarkerDe, decoupeDe, livreExtraitDe, pdfRequisDe, sortieMarkerDe } from './_lib.mjs'
import { indexDe, spanDe } from './recouper-source.mjs'
import { graphieDeChapitre, largeurDeChapitre, ligne1DePlage } from '../../src/data/schemas/source/decoupe.ts'
import { exigerRacineAtlas } from './lib/entree-atlas.mjs'

if (import.meta.main) exigerRacineAtlas()

const DRY = process.argv.slice(2).includes('--dry')

/** Id du livre que ce découpeur sert (`src/data/books.json`). */
const LIVRE = 'core-rulebook-5e'
// Extraction par TRANCHES de pages (`--page_range a-b`, une sous-arborescence `slices/<a>-<b>/` par
// tranche) : l'extraction d'un tenant est tuée par le harnais faute de mémoire. `Source/_marker/` et
// les PDF vivent dans l'arbre PRINCIPAL, résolus par la couture de `_lib.mjs` (#1739).
const livre = livreExtraitDe(LIVRE)
if (!livre) { console.error(`LIVRE INCONNU AU REGISTRE : ${LIVRE}`); process.exit(1) }
let MARKER_DIR
try { MARKER_DIR = join(sortieMarkerDe(LIVRE), 'slices') } catch (e) { console.error(e.message); process.exit(1) }
// PDF de référence des VÉRIFICATIONS (`verifierExtraction` : couche texte pypdf des pages que Marker
// a rendues vides).
let PDF
try { PDF = pdfRequisDe(LIVRE) } catch (e) { console.error(e.message); process.exit(1) }
// Tout nom ÉCRIT sous `Source/` passe par `nomAscii` (#1699) : un chemin non ASCII ne naît pas ici.
const OUT = nomAscii(String(livre.dir).split('\\').join('/'))
const LISTE = decoupeDe(LIVRE)

// Marker paginé → texte PAR PAGE PDF, par la lib partagée `lib/marker-pages.mjs` (parseur UNIQUE,
// aussi consommé par `marker-split.mjs`).
let pageText
try {
  const mds = mdsDeMarker(MARKER_DIR)
  if (!mds.length) { console.error('EXTRACTION MARKER INTROUVABLE sous', MARKER_DIR); process.exit(1) }
  pageText = pagesDeMarker(mds)
} catch (e) { console.error(e.message); process.exit(1) }
if (!pageText.size) { console.error('AUCUNE PAGE PAGINÉE sous', MARKER_DIR); process.exit(1) }

// VÉRIFICATIONS de l'extraction (bloc partagé avec `marker-split.mjs`) : les restitutions ciblées
// sont fusionnées, les pages manquantes averties, et une page PERDUE (vide chez Marker, pleine chez
// pypdf) ARRÊTE le découpage — une planche muette ne se découvre pas après coup dans `Source/`.
let verif
try {
  verif = verifierExtraction(pageText, { pdfPath: PDF, restitutions: pagesDeMarker(mdsDeRestitutions(MARKER_DIR)) })
} catch (e) { console.error(e.message); process.exit(1) }
pageText = verif.pages
const lastPage = Math.max(...pageText.keys())
for (const pg of verif.manquantes) console.warn(`page ${pg} absente de l'extraction (page sans texte ?)`)
if (verif.perdues.length) {
  console.error(`PAGES PERDUES : ${verif.perdues.length} page(s) vide(s) chez Marker alors que le PDF en porte du texte — ré-extraire CHACUNE avant de découper :`)
  // Marker lit la COPIE DE TRAVAIL (`copieMarkerDe`), posée par la CLI de la couture.
  const copie = copieMarkerDe(LIVRE)
  console.error(`  (copie de travail : node scripts/raw/pdf-de.mjs --copie-marker ${LIVRE})`)
  for (const { page, pypdf } of verif.perdues) {
    console.error(`  page ${page} (pypdf : ${pypdf} caractères)`)
    console.error(`    ${commandeRestitution(copie, MARKER_DIR, page)}`)
  }
  process.exit(1)
}

// Vérification : les pages de la liste sont croissantes (deux entrées peuvent PARTAGER une page) et
// dans l'extraction.
for (let c = 1; c < LISTE.length; c++) {
  if (LISTE[c].page < LISTE[c - 1].page) { console.error('LISTE DE DÉCOUPE NON CROISSANTE :', LISTE[c].titre); process.exit(1) }
}
if (LISTE[LISTE.length - 1].page > lastPage) { console.error(`DERNIÈRE ENTRÉE HORS EXTRACTION (${lastPage} pages)`); process.exit(1) }

// FLUX du livre : toutes les pages, dans l'ordre, et les BORNES de lignes de chacune — c'est DANS la
// page déclarée, et seulement là, que se cherche le titre d'ouverture d'un fichier.
const lignes = []
const bornes = new Map()
for (const pg of [...pageText.keys()].sort((a, b) => a - b)) {
  const debut = lignes.length
  for (const l of pageText.get(pg).split('\n')) lignes.push(l)
  bornes.set(pg, [debut, lignes.length])
}

const { coupes, introuvables } = couperAuxTitres(lignes, LISTE.map((e) => ({
  cle: e.titre,
  ouverture: e.ouverture ?? null,
  depuis: bornes.get(e.page)?.[0] ?? 0,
  avant: bornes.get(e.page)?.[1] ?? lignes.length,
})))
if (introuvables.length) {
  console.error(`TITRES D'OUVERTURE INTROUVABLES dans la sortie Marker : ${introuvables.length} / ${LISTE.length}`)
  for (const i of introuvables) {
    const e = LISTE.find((x) => x.titre === i.cle)
    console.error(`  p.${e.page} « ${i.ouverture} » → fichier « ${i.cle} »`)
  }
  if (!DRY) process.exit(1)
  console.error('--dry : le plan ci-dessous OMET ces fichiers ; un découpage réel refuse.')
}

if (!DRY) mkdirSync(OUT, { recursive: true })
// LARGEUR du dossier, arrêtée AVANT le premier fichier : tous les préfixes d'un livre la partagent.
const LARGEUR = largeurDeChapitre(LISTE.length)
const plan = []
const parTitre = new Map(LISTE.map((e) => [e.titre, e]))
for (let c = 0; c < coupes.length; c++) {
  const de = coupes[c].ligne
  const a = c + 1 < coupes.length ? coupes[c + 1].ligne : lignes.length
  const brut = lignes.slice(de, a).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const body = deballerSup(brut)
  const sups = (brut.match(/<sup>/g) || []).length
  // PLAGE DE PAGES : COPIÉE de la liste, comme pour le re-coupeur — aucun outil ne la calcule.
  const entree = parTitre.get(coupes[c].cle)
  const span = spanDe(entree)
  const nom = nomAscii(`${graphieDeChapitre(plan.length + 1, LARGEUR)} - ${coupes[c].cle}.md`)
  if (!DRY) writeFileSync(join(OUT, nom), `${ligne1DePlage(entree.page, entree.pageFin)}\n\n${body}\n`)
  plan.push({ nom, span })
  const premier = body.split('\n').find((l) => /^#{1,6}\s/.test(l)) || '(aucun en-tête)'
  console.log(`${nom}  (p.${span}, ${body.split('\n').length} lignes, ${Math.round(body.length / 1024)} Ko, ${sups} <sup> déballés) — 1er en-tête : ${premier.slice(0, 80)}`)
}
if (!DRY) writeFileSync(join(OUT, '00 - Index.md'), indexDe(basename(OUT), plan))
console.log(DRY
  ? `\n--dry : ${plan.length} fichier(s) + index PLANIFIÉS pour ${OUT} (${lastPage} pages extraites, ${introuvables.length} titre(s) introuvable(s)) — rien écrit`
  : `\n${plan.length} fichier(s) + index écrits dans ${OUT} (${lastPage} pages extraites)`)
