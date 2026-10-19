/** Racine du dépôt, chemin absolu (en-tête de `sourcesSuivies.mjs`). */
export const RACINE: string;

/** Sources SUIVIES par git susceptibles de porter un import, chemins POSIX relatifs, triés. */
export function sourcesSuivies(racine?: string): string[];
