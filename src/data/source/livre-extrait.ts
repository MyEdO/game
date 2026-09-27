// LIVRE EXTRAIT (#1389, #1739) — définition UNIQUE, pour l'app (`schemas/grammaire/livres-extraits.ts`)
// comme pour l'outillage (`scripts/raw/_lib.mjs`, qui la ré-exporte).
//
// Module PUR, sans aucun import : chargé tel quel par Node nu (retrait de types natif) comme par
// vitest et le navigateur. Le prédicat porte sur l'ENTRÉE du registre `src/data/books.json`, jamais sur
// un ensemble dérivé : chaque lecteur l'applique au registre qu'il tient, vivant ou injecté.

/** Les champs d'une entrée de registre de livre que le prédicat lit. */
export interface EntreeDeLivre {
  abbr?: string | null;
  dir?: string | null;
}

/** Ce livre a-t-il une extraction sur disque : `abbr` ET `dir` non vides. */
export function estLivreExtrait(b: EntreeDeLivre | null | undefined): boolean {
  return Boolean(b && b.abbr && b.dir);
}
