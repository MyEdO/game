/**
 * Schéma de `books.json` — SOURCE UNIQUE des acronymes de livres (ref #585) :
 * `abbr` est l'UNIQUE champ d'acronyme (affichage Compendium ET Atlas RAW), sans doublon `abr`.
 * `id` = relation id-pure vers `source.book` (migration `21aa4881`). `dir` = chemin d'extraction
 * `Source/…` des livres couverts par l'Atlas RAW ; absent des autres. `BOOKS` de
 * `scripts/raw/_lib.mjs` DÉRIVE de `books.json` (filtre les entrées `dir`, ORDRE DU FICHIER), sans
 * liste en dur à synchroniser. `language`/`folder` sont typés nullable par l'interface mais
 * toujours renseignés (string) sur toutes les entrées observées ; `desc` est le seul champ
 * réellement null.
 *
 * `desc` (clé d'ENVELOPPE) porte ici un HTML de présentation (bibliographie) — hors du périmètre
 * `<Prose>` : ce n'est pas un texte de règle copié/collé verbatim d'un livre, mais une notice
 * éditoriale du dataset lui-même.
 *
 * SANS PROVENANCE : `books` est inscrit à `SANS_LIVRE` — un livre ne se cite pas lui-même.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme } from '../grammaire/valeurs';

/**
 * TENEUR d'un livre : ce que ses chapitres NON couverts par une fiche contiennent réellement.
 * Absente = livre de RÈGLES (tout chapitre non couvert est un candidat trou). Lue par
 * `scripts/raw/_lib.mjs#teneurDe` — `coverage.mjs` en dérive sa ventilation sans nommer un livre.
 */
export const teneurSchema = enumNomme(
  { scenario: 'Campagne pure', mixte: 'Compagnon mixte' },
  {
    scenario: 'Aucune règle propre : une section vide y est du bruit de campagne',
    mixte: 'Chapitres de scénario ET de règles : une section vide peut cacher une règle',
  },
);

export const file = 'books.json';
export const famille = 'entite';

const doc = document(
  'books',
  famille,
  {
    abbr: z.string().min(1),
    /** Chemin d'extraction `Source/…` — présent sur les livres couverts par l'Atlas RAW. */
    dir: z.string().nullable().optional(),
    /** Nom du fichier PDF officiel du livre sous `Source/` — résolu dans l'arbre principal par
     *  `scripts/raw/_lib.mjs#pdfDe`, seule construction d'un chemin de PDF de livre (#1739). */
    pdf: z.string().endsWith('.pdf').nullable().optional(),
    /** Chemin d'extraction `Source/…` d'un livre HORS Atlas RAW (`scripts/raw/_lib.mjs#BOOKS`
     *  ne le porte pas, donc pas de pont folio ni de fiche RAW) dont les chapitres sont néanmoins
     *  sur disque et citables — `frenchy-bzh`. Lu par `scripts/raw/_lib.mjs#sourceDirOf`. */
    extractionDir: z.string().nullable().optional(),
    language: z.string().nullable(),
    /** Corps de règles dont ce livre est le CŒUR — absent d'un supplément. Graphie NORMALISÉE
     *  (sans espace de bord, en minuscules) : un cœur = une valeur, `scripts/raw/_lib.mjs#coeurDe`
     *  la lit par `abbr` et `reconcile.mjs` en dérive son régime sans une ligne par livre.
     *  `nullable` comme ses voisins éditables de ce def (`dir`, `extractionDir`) : l'atelier du
     *  Compendium émet `null` quand on VIDE un champ, et retirer un cœur est un geste d'auteur. */
    coeur: z
      .string()
      .min(1)
      .refine((v) => v === v.trim().toLowerCase(), 'graphie normalisée attendue : sans espace de bord, en minuscules')
      .nullable()
      .optional(),
    /** Teneur des chapitres non couverts par une fiche — absente = livre de RÈGLES. */
    teneur: teneurSchema.nullable().optional(),
    /** Niveau de heading qui porte les SUJETS de ce livre ; absent = 2 (`niveauDeSectionDe`). */
    niveauDeSection: z.number().int().min(2).max(6).nullable().optional(),
    folder: z.string().nullable(),
  },
  {
    abbr: { label: 'Acronyme', hint: 'Acronyme d’affichage du livre (Compendium et Atlas RAW)' },
    dir: { label: 'Dossier d’extraction (Atlas)', hint: 'Chemin `Source/…` du livre, pour les livres couverts par l’Atlas RAW' },
    pdf: { label: 'PDF du livre', hint: 'Nom du fichier PDF officiel sous `Source/`, extension comprise ; vide = aucun PDF déclaré' },
    extractionDir: { label: 'Dossier d’extraction (hors Atlas)', hint: 'Chemin `Source/…` d’un livre hors Atlas RAW mais citable' },
    language: { label: 'Langue', hint: 'Langue de l’édition (VF/VO)' },
    coeur: { label: 'Cœur de règles', hint: 'Corps de règles dont ce livre est le cœur ; vide pour un supplément' },
    teneur: { label: 'Teneur', hint: 'Ce que contiennent les chapitres non couverts par une fiche ; vide = livre de règles' },
    niveauDeSection: { label: 'Niveau de section', hint: 'Niveau de heading qui porte les sujets de ce livre (2 à 6) ; vide = 2' },
    folder: { label: 'Rayon de classement', hint: 'Catégorie de rangement du livre (Livre de Règle, Cadre de campagne…) — le RAYON de bibliothèque, jamais la teneur' },
  },
  {
    codex: { keys: ['books'] },
    edit: { dataset: 'books' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
