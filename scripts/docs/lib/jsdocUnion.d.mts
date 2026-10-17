import type { Node, SourceFile, TypeAliasDeclaration, VariableDeclaration, VariableStatement } from 'typescript/unstable/ast';

export interface ProprieteZod {
  nom?: string;
  spread?: string;
  init?: Node;
  optionnel?: boolean;
  role?: string | null;
  typeSortie?: string;
  literal?: string;
}

export interface ConstanteZod {
  statement: VariableStatement;
  decl: VariableDeclaration;
  sf: SourceFile;
  text: string;
  chemin: string;
  decorateursZod: { has(node: Node): boolean };
  formesFinales?: Map<string, { champs: ProprieteZod[]; base: { pos: number; end: number } }>;
}

export function indexerConstantes(fichiers: string[]): Map<string, ConstanteZod>;
export function proprietesZod(node: Node, entree?: ConstanteZod): ProprieteZod[];
export function noyauZod(node: Node, entree?: ConstanteZod): Node;
export function estOptionnel(node: Node, entree?: ConstanteZod): boolean;

export const ABBR: Set<string>;

export function firstSentence(body: string): string;

export function jsdocBody(between: string): string | null;

export function jsdocRole(between: string): string | null;

export function loadSource(path: string, sourceFile?: SourceFile): { text: string; sf: SourceFile };

export function findAlias(sf: SourceFile, name: string, tool: string, path: string): TypeAliasDeclaration;

export function aliasDoc(text: string, alias: TypeAliasDeclaration, sf: SourceFile): string | null;

export interface UnionMemberRow {
  name: string;
  fieldGroups: string[][];
  role: string | null;
}

export interface ReadUnionMembersOpts {
  allowLiterals?: boolean;
  fallbackRole?: string;
}

export function readZodUnionMembers(
  index: Map<string, ConstanteZod>,
  alias: string,
  discriminant: string,
  tool: string,
  opts?: { nomsDeSpread?: Record<string, string> }
): { rows: UnionMemberRow[]; rawCount: number };

export function readUnionMembers(
  sf: SourceFile,
  text: string,
  alias: TypeAliasDeclaration,
  discriminant: string,
  tool: string,
  opts?: ReadUnionMembersOpts
): { rows: UnionMemberRow[]; rawCount: number };

export function renderFields(fieldGroups: string[][]): string;
