import type { SessionProgramme } from './tsProgram.mjs';
import type { PasseDesProjets } from './serrureDesProjets.mjs';

export interface FieldReadHit {
  field: string;
  file: string;
  line: number;
  /** Symbole nommé le plus proche de la lecture, dont un nom de propriété (`'(module)'` à défaut). */
  symbole: string;
  /** Chaîne des fonctions nommées qui englobent la lecture, calculée par `englobanteDe`. */
  englobante: string;
  /** Le site est DANS la déclaration qui déclare la propriété (le `superRefine` du schéma qui valide
   *  son propre champ) — identité par nœud, jamais par nom. */
  auDeclarant: boolean;
  /** Les champs demandés que le PORTEUR du site porte, typé au site : un `Pick<T, 'a'>` ne porte que `a`. */
  champsDuPorteur: string[];
}

export function listProdFiles(dir: string): string[];
export function programmeDesChamps(root: string, fichiers: readonly string[], options?: { porte?: PasseDesProjets }): SessionProgramme;

/** La cible d'un scan : le type NOMMÉ et le module qui le DÉCLARE (l'identité est la déclaration). */
export interface FieldScanTarget {
  type: string;
  home: string;
}

export function scanFieldReads(
  cible: FieldScanTarget,
  fields: string[],
  files: string[],
  rootDir: string,
  cache?: Map<unknown, unknown>,
  programme?: SessionProgramme | null
): FieldReadHit[];

/** État d'un champ VIS-À-VIS du type : absent du type TS, hérité d'un ancêtre, ou propre à la cible. */
export type FieldOwnership =
  | { etat: 'absent' }
  | { etat: 'herite'; declarant?: string }
  | { etat: 'propre' };

export function fieldOwnership(
  cible: FieldScanTarget,
  fields: string[],
  files: string[],
  rootDir: string,
  cache?: Map<unknown, unknown>,
  programme?: SessionProgramme | null
): Map<string, FieldOwnership>;
export function groupByField(fields: string[], hits: FieldReadHit[]): Map<string, FieldReadHit[]>;

export function libererCache(cache: Map<unknown, unknown>, erreursInitiales?: readonly unknown[]): void;
