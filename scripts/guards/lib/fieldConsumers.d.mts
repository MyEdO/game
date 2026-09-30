import type { Program } from 'typescript';

export interface FieldReadHit {
  field: string;
  file: string;
  line: number;
  /** Déclaration NOMMÉE qui englobe la lecture (`'(module)'` à défaut) : l'ancre STABLE d'un site —
   *  une ligne insérée en amont déplace `line`, jamais le symbole qui LIT le champ. */
  symbole: string;
  /** Le site est DANS la déclaration qui déclare la propriété (le `superRefine` du schéma qui valide
   *  son propre champ) — identité par nœud, jamais par nom. */
  auDeclarant: boolean;
}

export function listProdFiles(dir: string): string[];

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
  programme?: Program | null
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
  programme?: Program | null
): Map<string, FieldOwnership>;
export function groupByField(fields: string[], hits: FieldReadHit[]): Map<string, FieldReadHit[]>;
