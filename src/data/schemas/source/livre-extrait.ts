// LIVRE EXTRAIT (#1389, #1739) — définition UNIQUE, pour l'app (`schemas/grammaire/livres-extraits.ts`)
// comme pour l'outillage (`scripts/raw/_lib.mjs`, qui la ré-exporte).
//
// Module PUR, sans aucun import : chargé tel quel par Node nu (retrait de types natif) comme par
// vitest et le navigateur. Le prédicat porte sur l'ENTRÉE du registre `src/data/books.json`, jamais sur
// un ensemble dérivé : chaque lecteur l'applique au registre qu'il tient, vivant ou injecté.

/** Les champs d'une entrée de registre de livre que lisent le prédicat et l'outillage `scripts/raw/`
 *  (`_lib.mjs`, `check-renvois.mjs`, `releve.mjs`, `workflow-args.mjs`). `BookData` les compose. */
export interface EntreeDeLivre {
  abbr?: string | null;
  dir?: string | null;
  /** Nom du PDF officiel sous `Source/` — résolu par `scripts/raw/_lib.mjs#pdfDe`. */
  pdf?: string | null;
  language?: string | null;
  /** Corps de règles dont ce livre est le CŒUR (`4e`, `5e`) — absent (ou vidé à l'atelier) d'un supplément. */
  coeur?: string | null;
  /** Teneur des chapitres non couverts par une fiche d'Atlas — absente = livre de RÈGLES. */
  teneur?: 'scenario' | 'mixte' | null;
  /** Niveau de heading qui porte les SUJETS de ce livre (`sectionsOf`) — absent = 2. */
  niveauDeSection?: number | null;
}

/** Ce livre a-t-il une extraction sur disque : `abbr` ET `dir` non vides. */
export function estLivreExtrait(b: EntreeDeLivre | null | undefined): boolean {
  return Boolean(b && b.abbr && b.dir);
}
