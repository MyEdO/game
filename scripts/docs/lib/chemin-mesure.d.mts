export function ancetreExistant(abs: string): string | null;
export function canoniser(chemin: string): string;
export function relatifSousRacine(
  racineCanonique: string,
  chemin: string,
  canoniserChemin?: (chemin: string) => string,
): string | null;
export function ignoresGit(racine: string): Set<string>;
export function dansLaMesure(rel: string, ignores: Set<string>): boolean;
