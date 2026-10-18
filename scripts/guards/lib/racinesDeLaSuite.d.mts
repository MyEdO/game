/** Racines de la suite Vitest : dossier, extensions de ses suites, motif de `test.include`. */
export const RACINES_DE_LA_SUITE: readonly {
  readonly dir: string;
  readonly exts: readonly string[];
  readonly motif: string;
}[];
/** Les motifs de `test.exclude`. */
export const EXCLUSIONS_DE_LA_SUITE: readonly string[];
/** Le chemin POSIX relatif est-il une suite que Vitest joue ? */
export const estDeLaSuiteVitest: (rel: string) => boolean;
