export interface GameOpField {
  key: string;
  op: string;
  field: string;
  array: boolean;
}

export type GameOpFieldTarget =
  | { registry: string }
  | { nonRef: string }
  | { coveredBy: string };

export interface GameOpRefOffender {
  file: string;
  path: string;
  op: string;
  field: string;
  value: string;
  registry: string;
  key: string;
}

export interface JsonSource {
  file: string;
  data: unknown;
}

/** Un nœud `GameOp` visité par le scan : son document, son path, son op et l'OBJET lui-même. */
export interface NoeudDOp {
  file: string;
  path: string;
  op: string;
  noeud: object;
}

export interface ScanResult {
  offenders: GameOpRefOffender[];
  missingResolvers: string[];
  noeudsDOp: NoeudDOp[];
}

export interface CibleStale {
  key: string;
  raison: string;
}

export const GAMEOP_FIELD_TARGETS: Record<string, GameOpFieldTarget>;

export function gameOpStringFields(root: string): GameOpField[];
export function auditFieldCoverage(
  root: string,
  opts: { champsASlot: Iterable<string> },
): { derived: GameOpField[]; unclassified: string[]; stale: CibleStale[] };
export function scanGameOpRefs(input: {
  sources: JsonSource[];
  resolvers: Record<string, (id: string) => boolean>;
  softIds?: Record<string, readonly string[]>;
  champsASlot?: Iterable<string>;
}): ScanResult;
export function formatOffender(o: GameOpRefOffender): string;
