/** Déclarations consommées depuis TypeScript (`scripts/guards/lib/corpusDesComptes.mts`, `scripts/guards/lib/occurrencesStock.d.mts`). */
export const SOURCE_FORMAT: {
  readonly porteur: string;
  readonly nom: string;
  readonly site: (e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => string;
  readonly cible: (cle: string, e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => string;
  readonly nombre: (e: import('../guards/lib/occurrencesStock.mjs').EntreeDeCompte) => number;
};
type SiteDeFormat = import('../guards/lib/stock.mjs').Site & { famille: string; nombre?: number };

export function scanAll(dossiers?: readonly string[]): SiteDeFormat[];
export function sitesDuDossier(
  dir: string,
  fichiers: readonly { nom: string; texte: string }[],
  liste?: readonly object[] | null,
  sansFolio?: boolean,
): SiteDeFormat[];
