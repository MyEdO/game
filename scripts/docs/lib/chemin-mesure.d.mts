export function estPipeNomme(chemin: string, chemins?: Pick<import('node:path').PlatformPath, 'sep'>): boolean;
export function ancetreExistant(abs: string, options?: { strict?: boolean }): string | null;
export function canoniser(chemin: string, options?: { strict?: boolean }): string;
interface MemoireDeCanonisation {
  dossiers: Map<string, string>;
  noms: Map<string, Set<string>>;
  canoniques: Map<string, string>;
}
export function memoireDeCanonisation(): MemoireDeCanonisation;
export function canoniserParDossier(chemin: string, memoire: MemoireDeCanonisation, lien?: boolean): string;
export function relatifEntreCheminsCanoniques(racineCanonique: string, cheminCanonique: string): string | null;
export function relatifSousRacine(
  racineCanonique: string,
  chemin: string,
  canoniserChemin?: (chemin: string) => string,
): string | null;
export function dansLaMesure(rel: string, ignores: Set<string>, derivees?: Set<string>, motifsDeclares?: string[]): boolean;
export function projeterListingMesure(rel: string, snapshot: import('../../guards/lib/lister.mjs').ListingType, ignores: Set<string>, derivees?: Set<string>, propres?: string[], motifsDeclares?: string[]): import('../../guards/lib/lister.mjs').ListingType;
