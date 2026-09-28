export const IMPORT_RE: RegExp;
export function estModule(chemin: string): boolean;
export function pathspecsDeModules(dossier: string): string[];
export function sourceALExecution(fichier: string, texte: string): string;
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
  options?: { retenir?: (abs: string) => boolean; cache?: Map<string, string[] | null>; typesEffaces?: boolean },
): Set<string>;
export function closureOf(roots: string[], cache?: Map<string, string[] | null>): Set<string>;
export function directImportsOf(
  fromFile: string,
  contenu: string,
  options?: { racine?: string; existe?: (abs: string) => boolean; alias?: readonly Alias[] },
): string[];
export const CHEMIN_TSCONFIG: string;
/** Les alias que déclare le texte d'un `tsconfig.json`, cibles posées sous `racine`. */
export function aliasDe(texte: string | null, racine: string): Alias[];
/** Les alias du `tsconfig.json` que porte le disque sous `racine` (répertoire courant par défaut). */
export function aliasDuDepot(racine?: string): Alias[];
