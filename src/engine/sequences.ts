/**
 * LES SÉQUENCES DE MODULE (#2898 lot D) : un compteur qui numérote ce qu'un module fabrique (uid d'objet, id de héros,
 * nonce de refus, génération d'un pilote). Une partie neuve (`creerPartie`, `src/noyau/partie.ts`) les remet toutes à zéro : deux rejeux
 * d'un même fichier dans un même processus fabriquent les mêmes ids. Un compteur de module se déclare ici, jamais en
 * `let` nu (garde : `src/engine/sequences.test.ts`).
 */
const SEQUENCES = new Set<{ n: number }>();

/** Une séquence neuve : `suivant` rend l'entier suivant, depuis 1 ; `courant`, le dernier rendu (0 avant le premier). */
export function sequence(): { suivant: () => number; courant: () => number } {
  const s = { n: 0 };
  SEQUENCES.add(s);
  return { suivant: () => ++s.n, courant: () => s.n };
}

/** Remet toutes les séquences à zéro. */
export function remettreLesSequencesAZero(): void {
  for (const s of SEQUENCES) s.n = 0;
}
