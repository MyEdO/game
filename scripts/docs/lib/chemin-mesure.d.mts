export function ancetreExistant(abs: string, options?: { strict?: boolean }): string | null;
export function canoniser(chemin: string, options?: { strict?: boolean }): string;
export function canoniseurParDossier(): (chemin: string) => string;
export function relatifSousRacine(
  racineCanonique: string,
  chemin: string,
  canoniserChemin?: (chemin: string) => string,
): string | null;
export function dansLaMesure(rel: string, ignores: Set<string>, derivees?: Set<string>, motifsDeclares?: string[]): boolean;
export function projeterListingMesure(rel: string, snapshot: import('../../guards/lib/lister.mjs').ListingType, ignores: Set<string>, derivees?: Set<string>, propres?: string[], motifsDeclares?: string[]): import('../../guards/lib/lister.mjs').ListingType;
