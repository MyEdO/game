import type { SourceFile } from 'typescript/unstable/ast';
/** Chemin résolu d'un spécificateur depuis `depuis` (relatif ou alias `@/`), sans extension ; `null` pour un paquet. */
export function cheminDuSpecificateur(depuis: string, specificateur: string): string | null;
export interface SiteAssertionSurDonnee { ligne: number; motif: 'compte' | 'liste' | 'snapshot'; sujet: string; attendu: string; portee: 'ensemble' | 'entree' }
/** Sites d'un fichier de test où une assertion fige un littéral sur un sujet dérivé de `src/data/` (#2995).
 *  Contrat : en-tête de `assertionSurDonnee.mjs`. */
export function sitesAssertionSurDonnee(
  f: { rel: string; text: string },
  options?: { lireModule?: (chemin: string) => { rel: string; text: string; sourceFile?: SourceFile } | null; cache?: Map<string, Set<string>>; sourceFile?: SourceFile },
): SiteAssertionSurDonnee[];
