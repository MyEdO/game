import type { EntreeManifeste, ImageCss, ventiler } from './cssCouches.mjs';
import type { EntreeNominative } from './stock.mjs';
import type { Depot } from './gitPorte.mjs';

/** Un arbre lisible : ses fichiers d'un dossier, le texte d'un chemin ou d'un lot, les modules de `src/` qui portent un motif. */
export interface SourceCss {
  lister: (dossier: string) => readonly string[];
  lire: (rel: string) => string | null;
  lireTout: (rels: readonly string[]) => Map<string, string | null>;
  citants: (motif: string) => readonly string[];
}
export interface CoteCss {
  manifeste: EntreeManifeste[];
  partagees: string[];
  reutilises: Set<string>;
  lire: (rel: string) => string | null;
}
export const RACINE_DES_SOURCES: string;
export function nomsDImportDe(chemin: string): string[];
export function nomsDImport(manifeste: readonly EntreeManifeste[]): Set<string>;
export function motifDeCitation(manifeste: readonly EntreeManifeste[]): string | null;
export function importsDansLArbre(source: SourceCss, rels: readonly string[], options?: { racine?: string }): [string, string[]][];
export function lireDuTravail(cwd: string, rel: string): string | null;
export function coteCss(source: SourceCss, options?: { racine?: string }): CoteCss;
export function imageCss(source: SourceCss, options?: { racine?: string }): ImageCss;
export function sourceGit(p: {
  cwd?: string;
  arbre: string;
  depot?: Depot;
}): SourceCss & { existe: () => boolean };
export function sourceMelee(p: { dans: (rel: string) => boolean; dedans: SourceCss; dehors: SourceCss }): SourceCss;
export const CHEMIN_STOCK_CSS: string;
export function ventilationDeGit(p: {
  cwd?: string;
  base: string;
  tete?: string;
  depot?: Depot;
}): ReturnType<typeof ventiler> & { stockAvant: Record<'identite' | 'espacement', EntreeNominative[]> };
