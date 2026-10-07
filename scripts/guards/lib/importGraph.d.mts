import type { Diagnostic } from 'typescript/unstable/sync';
import type { Node, SourceFile } from 'typescript/unstable/ast';

export type NatureDeModule = 'statique' | 'dynamique' | 'type' | 'require';
export type GenreDeModule = 'import' | 'export' | 'importEquals' | 'importType' | 'appel' | 'fournisseur';
export interface PositionDeModule {
  readonly noeud: Node;
  debut: number;
  fin: number;
  ligne: number;
}
export interface NomDeModule {
  nom: string;
  position: PositionDeModule | null;
}
export interface LiaisonDeModule {
  forme: 'nommee' | 'defaut' | 'espace' | 'etoile' | 'equals';
  typeSeul: boolean;
  local: NomDeModule | null;
  importe: NomDeModule | null;
  exporte: NomDeModule | null;
}
export interface SiteDeModule extends PositionDeModule {
  genre: GenreDeModule;
  nature: NatureDeModule;
  acquisition: boolean;
  spec: string | null;
  clause: boolean;
  niveauModule: boolean;
  texte: string;
  liaisons: LiaisonDeModule[];
}
export type LiaisonSituee = Omit<SiteDeModule, 'liaisons'> & LiaisonDeModule;
/** Une chaîne est analysée et validée ; un SourceFile est réutilisé sans reparsage,
 * avec contrôle des seuls diagnostics fournis. Sans diagnostics, sa syntaxe n'est pas validée ici. */
export function sitesDeModule(fichier: string, source: string | SourceFile, diagnostics?: readonly Diagnostic[]): SiteDeModule[];
export function liaisonsDe(fichier: string, source: string | SourceFile, diagnostics?: readonly Diagnostic[]): LiaisonSituee[];
export function chargementsDe(fichier: string, source: string | SourceFile, diagnostics?: readonly Diagnostic[]): SiteDeModule[];

/** Un spécificateur qu'un module écrit, et la nature de l'acquisition. */
export interface Specificateur {
  spec: string;
  nature: NatureDeModule;
  ligne: number;
  debut: number;
  fin: number;
  texte: string;
}
export function specificateursDe(fichier: string, source: string | SourceFile, diagnostics?: readonly Diagnostic[]): Specificateur[];
/** Un arc résolu : le spécificateur écrit, sa nature, et le fichier absolu POSIX qu'il désigne. */
export interface Arc extends Omit<Specificateur, 'nature'> {
  nature: NatureDeModule | 'glob';
  motifs?: string[];
  cible: string;
}
export function arcsDe(
  abs: string,
  texte: string | SourceFile,
  options?: { diagnostics?: readonly Diagnostic[]; existe?: (abs: string) => boolean; alias?: readonly Alias[] },
): Arc[];
export function estModule(chemin: string): boolean;
export function pathspecsDeModules(dossier: string): string[];
export function sourceALExecution(fichier: string, texte: string, options?: { racine?: string }): string;
/** Un alias de chemin : préfixe du spécificateur → dossier cible absolu. */
export interface Alias {
  prefixe: string;
  vers: string;
}
export function resolveImport(
  fromFile: string,
  spec: string,
  existe?: (abs: string) => boolean,
  alias?: readonly Alias[],
): string | null;
export function clotureDImports(
  roots: string[],
  options?: {
    racine?: string;
    retenir?: (abs: string) => boolean;
    cache?: Map<string, Arc[] | null>;
    typesEffaces?: boolean;
    dynamiques?: boolean;
    arbre?: EnsembleDeFichiers;
    specificateurs?: MemoDeSpecificateurs;
  },
): Set<string>;
/** L'ensemble de fichiers contre lequel une marche résout et lit (chemins absolus POSIX). */
export interface EnsembleDeFichiers {
  existe: (abs: string) => boolean;
  lire: (abss: string[]) => Map<string, string | null>;
  fichiers?: readonly string[];
}
/** Un spécificateur, ou un motif d'`import.meta.glob`, avant résolution. */
export type SiteNonResolu = Omit<Specificateur, 'nature' | 'debut' | 'fin' | 'texte'> & Partial<Pick<Specificateur, 'debut' | 'fin' | 'texte'>> & { nature: NatureDeModule | 'glob'; motifs?: string[] };
export interface MemoDeSpecificateurs {
  lire: (abs: string, texte: string) => SiteNonResolu[] | undefined;
  ecrire: (abs: string, texte: string, sites: SiteNonResolu[]) => void;
}
/** Les motifs littéraux des `import.meta.glob(…)` d'un arbre. */
export function globsDe(arbre: SourceFile): { motifs: string[]; ligne: number }[];
/** Chaque cible d'un cache de marche ↦ les arcs qui l'atteignent. */
export function grapheInverse(cache: Map<string, Arc[] | null>): Map<string, (Arc & { importeur: string })[]>;
export function closureOf(roots: string[], options?: { racine?: string; cache?: Map<string, Arc[] | null> }): Set<string>;
export function directImportsOf(
  fromFile: string,
  contenu: string | SourceFile,
  options?: { racine?: string; existe?: (abs: string) => boolean; alias?: readonly Alias[]; diagnostics?: readonly Diagnostic[] },
): string[];
export const CHEMIN_TSCONFIG: string;
/** Les alias que déclare le texte d'un `tsconfig.json`, cibles posées sous `racine`. */
export function aliasDe(texte: string | null, racine: string): Alias[];
/** Les alias du `tsconfig.json` que porte le disque sous `racine` (répertoire courant par défaut). */
export function aliasDuDepot(racine?: string): Alias[];
