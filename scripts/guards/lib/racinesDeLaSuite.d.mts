/** Racines de la suite Vitest : dossier, extensions de ses suites, motif de `test.include`. */
export const RACINES_DE_LA_SUITE: readonly {
  readonly dir: string;
  readonly exts: readonly string[];
  readonly motif: string;
}[];
/** Le motif des tests hors store, `include` de la suite du noyau. */
export const MOTIF_HORS_STORE: string;
/** Les suites Vitest jouées par un step de CI hors de la suite principale : config lancée, motif d'include. */
export const SUITES_VITEST_DE_CI: Readonly<Record<string, { readonly config: string; readonly motif: string }>>;
/** Les motifs de `test.exclude`. */
export const EXCLUSIONS_DE_LA_SUITE: readonly string[];
/** Le chemin POSIX relatif est-il une suite que Vitest joue ? */
export const estDeLaSuiteVitest: (rel: string) => boolean;
/** Le chemin POSIX relatif est-il une suite que joue la suite du noyau ? */
export const estDeLaSuiteDuNoyau: (rel: string) => boolean;
