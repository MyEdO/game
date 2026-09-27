import type { SourceFile } from 'typescript';

export type RegistryIdBranchRule = 'id-equality' | 'id-switch' | 'id-membership' | 'id-record';

export interface Finding {
  line: number;
  detail: string;
  rule: RegistryIdBranchRule;
}

export const SCAN_DIRS: string[];
/** Mots RÉSERVÉS du vocabulaire `GameOp` — un littéral de cette liste ne désigne aucune entrée. */
export const OP_VOCABULARY: ReadonlySet<string>;
/** Types de vocabulaire FERMÉ → module canonique dont ils doivent être importés pour exempter. */
export const VOCABULARY_TYPES: ReadonlyMap<string, string>;
export const SCAN_EXTS: string[];
export function isRegistryIdBranchExcluded(rel: string): boolean;
/** Arbre syntaxique de `contenu`, bâti à chaque appel. */
export function arbreDe(relPath: string, contenu: string): SourceFile;
export function scanRegistryIdBranch(relPath: string, contenu: string, sf?: SourceFile): Finding[];
export function countRegistryIdBranch(rel: string, contenu: string): number;

/** Site de la forme BRUTE « <champ d'identité> === '<littéral>' » — sans condition de liaison. */
export interface RawIdEqualityFinding {
  line: number;
  detail: string;
}

export function scanRawIdEqualities(relPath: string, contenu: string, sf?: SourceFile): RawIdEqualityFinding[];
