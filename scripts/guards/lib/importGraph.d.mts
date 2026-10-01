/** Un spécificateur qu'un module écrit, et la nature de l'acquisition. */
export interface Specificateur {
  spec: string;
  nature: 'statique' | 'dynamique' | 'type' | 'require';
}
export function specificateursDe(fichier: string, texte: string): Specificateur[];
/** Un arc résolu de la marche : le spécificateur écrit, et le fichier absolu POSIX qu'il désigne. */
export interface Arc {
  spec: string;
  cible: string;
}
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
  options?: {
    racine?: string;
    retenir?: (abs: string) => boolean;
    cache?: Map<string, Arc[] | null>;
    typesEffaces?: boolean;
    dynamiques?: boolean;
  },
): Set<string>;
export function closureOf(roots: string[], options?: { racine?: string; cache?: Map<string, Arc[] | null> }): Set<string>;
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
