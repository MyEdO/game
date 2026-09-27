import type { SourceFile, TypeAliasDeclaration } from 'typescript';

export const ABBR: Set<string>;

export function firstSentence(body: string): string;

export function jsdocBody(between: string): string | null;

export function jsdocRole(between: string): string | null;

export function loadSource(path: string): { text: string; sf: SourceFile };

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

export function readUnionMembers(
  sf: SourceFile,
  text: string,
  alias: TypeAliasDeclaration,
  discriminant: string,
  tool: string,
  opts?: ReadUnionMembersOpts
): { rows: UnionMemberRow[]; rawCount: number };

export function renderFields(fieldGroups: string[][]): string;

