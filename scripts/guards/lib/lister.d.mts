import type { PasseDesProjets } from './serrureDesProjets.mjs';
export { parUnitesDeCode, parLibelle } from '../../../src/lib/ordre.mjs';
export function cheminAbsent(erreur: unknown): boolean;
/** Ce chemin est-il visé par ce motif ? Séparateurs POSIX. */
export function correspondGlob(chemin: string, motif: string): boolean;
export type ListingType = { nature: 'directory' | 'absent' | 'other'; entrees: { nom: string; nature: 'file' | 'directory' | 'link' | 'other' }[] };
export function listerDossier(dir: string, options?: { absent?: 'lever' | 'vide'; porte?: PasseDesProjets }): string[];
export function listerEntrees(dir: string, options?: { absent?: 'lever' | 'vide'; porte?: PasseDesProjets }): ListingType;
export function listerArbre(
  dir: string,
  options?: { filtre?: (rel: string) => boolean; descendre?: (rel: string) => boolean; absent?: 'lever' | 'vide'; porte?: PasseDesProjets },
): string[];
/** Les documents d'un corpus en descripteur, en chemins relatifs à `racine` (le dépôt par défaut). */
export function cheminsDuCorpus(
  corpus: { readonly dossier: string; readonly suffixe: string; readonly recursif: boolean },
  racine?: string,
  options?: { porte?: PasseDesProjets },
): string[];
