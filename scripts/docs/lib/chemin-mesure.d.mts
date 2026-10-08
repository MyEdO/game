export function ancetreExistant(abs: string, options?: { strict?: boolean }): string | null;
export function canoniser(chemin: string, options?: { strict?: boolean }): string;
export function relatifSousRacine(
  racineCanonique: string,
  chemin: string,
  canoniserChemin?: (chemin: string) => string,
): string | null;
export function ignoresGit(racine: string): Set<string>;
export function perimetreDeMesure(racine: string): { nature: 'git' | 'physique'; ignores: Set<string>; signature: object };
export function dansLaMesure(rel: string, ignores: Set<string>, derivees?: Set<string>): boolean;
