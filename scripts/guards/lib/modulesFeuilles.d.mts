/** Racine du dépôt, chemin absolu (en-tête de `modulesFeuilles.mjs`). */
export const RACINE: string;

/** Modules FEUILLES : chacun avec ses bancs et l'invariant qu'il sert. */
export const FEUILLES: ReadonlyArray<{ module: string; bancs: readonly string[]; pourquoi: string }>;

/** Sources SUIVIES par git susceptibles de porter un import, chemins POSIX relatifs, triés. */
export function sourcesSuivies(racine?: string): string[];

/** Imports d'un fichier, résolus. */
export function importsResolus(fichierAbsolu: string, texte: string): { specificateur: string; resolu: string }[];

/** Manquements à l'invariant des feuilles. */
export function manquementsDeFeuilles(p?: {
  racine?: string;
  sources?: string[];
  feuilles?: typeof FEUILLES;
}): { manquements: string[]; sourcesLues: number };
