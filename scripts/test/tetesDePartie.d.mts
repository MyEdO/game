/** Seuil d'entrée d'une clé dans une tête, en ms — documenté dans `tetesDePartie.mjs`. */
export const SEUIL_DE_TETE_MS: number;
/** Têtes pondérées des parties de CI, par gate — documentées dans `tetesDePartie.mjs` (#5037). */
export const TETES_DE_PARTIE: Record<'test' | 'test:hooks' | 'godot:rendus', { mesure: { date: string; course: number }; durees: Record<string, number> }>;
