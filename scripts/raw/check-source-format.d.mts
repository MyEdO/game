/** Déclarations consommées depuis TypeScript (`scripts/guards/lib/corpusDesComptes.mts`). */
export const SOURCE_FORMAT: {
  readonly nom: string;
  readonly site: (e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => string;
  readonly cible: (cle: string, e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => string;
  readonly nombre: (e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => number;
};
export function scanAll(dossiers?: readonly string[]): (import('../guards/lib/stock.mjs').Site & { famille: string; nombre?: number })[];
